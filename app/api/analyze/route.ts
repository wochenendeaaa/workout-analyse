import { GoogleGenAI, createPartFromUri, type Part } from "@google/genai";
import { NextResponse } from "next/server";

import {
  buildWorkoutSystemPrompt,
  parseEquipmentContextField,
} from "@/lib/equipment-context";
import { generateWorkoutAnalysisContent } from "@/lib/gemini-workout-generate";
import { geminiHttpErrorResponse } from "@/lib/gemini-route-errors";
import { parseAnalysisJson } from "@/lib/parse-analysis-json";
import { parsePriorExtractedField } from "@/lib/prior-extracted";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getServerMaxPdfBytes } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const maxDuration = 120;

function inlinePdfThresholdBytes(maxUpload: number): number {
  return Math.min(12 * 1024 * 1024, maxUpload);
}

/** Standard: 2.5 Pro für schwer lesbare Handschrift; alternativ GEMINI_MODEL=gemini-2.5-flash */
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-pro";

const SYSTEM_PROMPT = `Du bist ein professioneller Powerlifting- und Fitness-Coach. Im Anhang findest du ein PDF mit handschriftlichen Trainingsaufzeichnungen.

Kumulation (wenn die User-Nachricht einen JSON-Block mit bereits gespeicherten Trainingstagen enthält):
Das PDF beschreibt genau **eine** zusätzliche Trainingseinheit (ein Workout-Tag). Extrahiere aus dem PDF nur diese neue Einheit. Die bestehenden Tage aus dem JSON vollständig übernehmen (gleiche Struktur), den neuen Tag anfügen und extracted_data nach Datum sortieren (wie im Log lesbar). Wenn ein Datum bereits existiert: Übungen aus dem PDF in diesen Tag einarbeiten — bei gleichem Übungsnamen die Zeile aus dem PDF behalten. progressive_overload_analysis, coach_tips und next_session_prescription beziehen sich auf die **gesamte** kombinierte Historie (alter Stand + neuer Tag).

Ohne solchen JSON-Block (Erst-Upload oder „Neue Analyse“): verhalte dich wie ein Einzel-Upload — lies alle Trainingstage aus dem PDF wie gewohnt.

Aufgabe 1: Lies die relevanten Daten aus (Datum, Übung, Sätze, Wiederholungen, Gewicht). Achtung: Die Notizen sind handschriftlich und teils unordentlich.

Aufgabe 2: Analysiere den "Progressive Overload" über die verschiedenen Trainingstage. Wo gab es Steigerungen im Gewicht oder Volumen?

Aufgabe 3: Gib 2-3 konkrete Tipps zur Technik oder Trainingsplanung.

Das Feld alternative_exercises im JSON-Schema kannst du als leeres Array lassen (wird in der App nicht mehr genutzt).

Aufgabe 4: Leite aus den extrahierten Daten und der Progressive-Overload-Analyse konkrete Vorschläge für die NÄCHSTE Trainingseinheit ab. Fülle das Array next_session_prescription: für jede betroffene Übung aus dem Log Einträge mit exercise_name, target_sets, target_reps (Zahl oder Spanne als Text, z.B. "8-10"), suggested_weight (z.B. "62,5 kg" oder "gleich wie letzte Session"), rationale (kurz: Progression, RPE, Deload, Technik). Nutze konservative Steigerungen; wenn unsicher, eher einen Bereich oder "unverändert" statt riskanter Sprünge. Wenn aus dem PDF nichts Sinnvolles ableitbar ist, gib ein leeres Array.

Aufgabe 5: Erzeuge coach_big_picture als kompakten Meta-Block:
- headline: 1 klarer Satz (max ~140 Zeichen), der den Gesamttrend der letzten Sessions zusammenfasst.
- watch_outs: 2 bis 4 kurze Punkte mit Risiken/Fokus für die nächste Zeit (z. B. Technik, Ermüdung, Regeneration, Lastsprünge).
- Keine Floskeln, konkret aus den Daten ableiten.

Antwortformat: reines JSON ohne Markdown-Fences (das Ausgabe-Schema ist API-seitig fest vorgegeben).

Wenn Werte nicht lesbar sind, nutze eine leere Zeichenkette oder "unleserlich" und erwähne das knapp in progressive_overload_analysis.`;

function buildUserFollowup(priorCount: number, priorJson: string): string {
  const base =
    "Bitte analysiere das beigefügte PDF vollständig gemäß den Systemanweisungen. Antworte ausschließlich mit dem JSON-Objekt.";
  if (priorCount === 0) return base;
  return `${base}

Bereits gespeicherte Trainingstage (JSON — in extracted_data übernehmen und um die neue Einheit aus dem PDF ergänzen):
${priorJson}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pdfToParts(
  ai: GoogleGenAI,
  buffer: Buffer,
  inlineLimit: number,
): Promise<{ parts: Part[]; cleanup: () => Promise<void> }> {
  if (buffer.byteLength <= inlineLimit) {
    const part: Part = {
      inlineData: {
        mimeType: "application/pdf",
        data: buffer.toString("base64"),
      },
    };
    return { parts: [part], cleanup: async () => {} };
  }

  const uploaded = await ai.files.upload({
    file: new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
    config: {
      mimeType: "application/pdf",
      displayName: "training-plan.pdf",
    },
  });

  const name = uploaded.name;
  if (!name) {
    throw new Error("FILE_UPLOAD_NO_NAME");
  }

  let meta = uploaded;
  for (let i = 0; i < 90; i++) {
    if (meta.state === "ACTIVE" && meta.uri && meta.mimeType) {
      return {
        parts: [createPartFromUri(meta.uri, meta.mimeType)],
        cleanup: async () => {
          try {
            await ai.files.delete({ name });
          } catch {
            /* ignore */
          }
        },
      };
    }
    if (meta.state === "FAILED") {
      throw new Error("FILE_PROCESSING_FAILED");
    }
    await sleep(2000);
    meta = await ai.files.get({ name });
  }

  throw new Error("FILE_NOT_READY");
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Server-Konfiguration: GEMINI_API_KEY fehlt. Lege sie in .env.local an.",
        code: "MISSING_API_KEY",
      },
      { status: 500 },
    );
  }

  let cleanup: (() => Promise<void>) | null = null;

  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Erwarte multipart/form-data mit Feld „file“.", code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    const maxPdfBytes = getServerMaxPdfBytes();
    const inlineLimit = inlinePdfThresholdBytes(maxPdfBytes);

    const rl = checkRateLimit(`analyze:${getClientIp(request)}`);
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: `Zu viele Anfragen. Bitte in ${rl.retryAfterSec}s erneut versuchen.`,
          code: "RATE_LIMIT",
          retryAfterSec: rl.retryAfterSec,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        },
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Keine Datei im Feld „file“.", code: "NO_FILE" },
        { status: 400 },
      );
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Nur PDF-Dateien sind erlaubt.", code: "NOT_PDF" },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const pdfHeader = buf.subarray(0, 5).toString("utf8");
    if (pdfHeader !== "%PDF-") {
      return NextResponse.json(
        { error: "Die Datei ist kein gültiges PDF.", code: "NOT_PDF" },
        { status: 400 },
      );
    }
    if (buf.byteLength === 0) {
      return NextResponse.json(
        { error: "Die Datei ist leer.", code: "EMPTY_FILE" },
        { status: 400 },
      );
    }
    if (buf.byteLength > maxPdfBytes) {
      return NextResponse.json(
        {
          error: `PDF zu groß (max. ${maxPdfBytes / (1024 * 1024)} MB).`,
          code: "FILE_TOO_LARGE",
        },
        { status: 413 },
      );
    }

    const equipmentNarrative = parseEquipmentContextField(
      form.get("equipment_context"),
    );
    const priorExtracted = parsePriorExtractedField(form.get("prior_extracted_data"));
    const systemPrompt = buildWorkoutSystemPrompt(
      SYSTEM_PROMPT,
      equipmentNarrative,
    );

    const ai = new GoogleGenAI({ apiKey });
    const { parts, cleanup: doCleanup } = await pdfToParts(ai, buf, inlineLimit);
    cleanup = doCleanup;

    const userFollowup = buildUserFollowup(
      priorExtracted.length,
      JSON.stringify(priorExtracted),
    );

    const response = await generateWorkoutAnalysisContent(
      ai,
      MODEL,
      parts,
      userFollowup,
      systemPrompt,
    );

    const raw = response.text;
    if (!raw?.trim()) {
      return NextResponse.json(
        {
          error:
            "Das Modell hat keine nutzbare Antwort geliefert (evtl. Sicherheitsfilter oder unlesbares PDF).",
          code: "EMPTY_MODEL_RESPONSE",
        },
        { status: 502 },
      );
    }

    let data;
    try {
      data = parseAnalysisJson(raw);
    } catch (e) {
      const hint =
        e instanceof Error && e.message === "MODEL_JSON_PARSE"
          ? "Ungültiges JSON."
          : "JSON-Struktur entspricht nicht dem erwarteten Schema.";
      return NextResponse.json(
        {
          error: `Antwort der KI konnte nicht verarbeitet werden (${hint})`,
          code: "PARSE_ERROR",
          rawPreview: raw.slice(0, 800),
        },
        { status: 502 },
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (message === "FILE_PROCESSING_FAILED") {
      return NextResponse.json(
        {
          error: "Die PDF-Datei konnte auf der Gemini-Seite nicht verarbeitet werden.",
          code: "FILE_PROCESSING_FAILED",
        },
        { status: 502 },
      );
    }
    if (message === "FILE_NOT_READY") {
      return NextResponse.json(
        {
          error: "Zeitüberschreitung beim Verarbeiten der PDF-Datei. Bitte erneut versuchen oder kleinere Datei nutzen.",
          code: "FILE_TIMEOUT",
        },
        { status: 504 },
      );
    }

    const mapped = geminiHttpErrorResponse(err, MODEL);
    return NextResponse.json(mapped.body, { status: mapped.status });
  } finally {
    if (cleanup) {
      await cleanup().catch(() => {});
    }
  }
}

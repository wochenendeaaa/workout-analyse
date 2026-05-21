import { GoogleGenAI, createPartFromUri, type Part } from "@google/genai";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import {
  buildWorkoutSystemPrompt,
  parseEquipmentContextField,
} from "@/lib/equipment-context";
import {
  buildCoachMemoryContextBlock,
  buildCoachProfileContextBlock,
  parseCoachMemoryField,
  parseCoachProfileField,
} from "@/lib/coach-memory-local";
import { generateWorkoutAnalysisContent } from "@/lib/gemini-workout-generate";
import { geminiHttpErrorResponse } from "@/lib/gemini-route-errors";
import { parseAnalysisJson } from "@/lib/parse-analysis-json";
import { parsePriorExtractedField } from "@/lib/prior-extracted";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getServerMaxPdfBytes } from "@/lib/upload-limits";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 120;

function inlinePdfThresholdBytes(maxUpload: number): number {
  return Math.min(12 * 1024 * 1024, maxUpload);
}

const MODEL_FLASH = process.env.GEMINI_MODEL_FLASH?.trim() || "gemini-2.5-flash";
const MODEL_PRO = process.env.GEMINI_MODEL_PRO?.trim() || "gemini-2.5-pro";

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

Aufgabe 6: Erzeuge coach_followup:
- required: true nur wenn dir wichtige Infos für bessere Coaching-Qualität fehlen (z. B. Schmerzen, Schlaf/Stress, Equipment-Limits, Zeitbudget, RPE-Unsicherheit). Sonst false.
- reason: kurzer Satz warum Follow-up nötig ist (oder warum nicht).
- questions: bei required=true 2 bis 4 Fragen, empathisch und konkret; bei required=false leeres Array.
- kinds:
  - text: freie Antwort
  - scale: z. B. Belastung 1-10
  - choice: mit 2-5 kurzen choices
- Keine redundanten Fragen, wenn Kontext schon vorhanden ist.

Aufgabe 7: Fülle post_workout_debrief im Erstlauf standardmäßig mit null (wird nach Upload per User-Debrief gesetzt).

Aufgabe 8: Erzeuge tomorrow_plan auch ohne Debrief:
- status: "as_planned" oder "light_adjustment" je nach Risiko.
- summary: 1 klarer Satz für die nächste Session.
- top_priorities: 2-3 konkrete Fokuspunkte.
- caution_flags: 0-3 kurze Warnhinweise.

Antwortformat: reines JSON ohne Markdown-Fences (das Ausgabe-Schema ist API-seitig fest vorgegeben).

Wichtig für extracted_data:
- "sets": Anzahl der Arbeitssätze als Zahl-String, z.B. "4" oder "3". Notation wie "4x5" → sets="4", reps="5".
- "reps": Wiederholungen als Zahl oder Spanne, z.B. "8" oder "8-10".
- "weight": Gewicht mit Einheit, z.B. "80 kg" oder "175 lbs". Wenn nur Körpergewicht: "BW". Wenn unleserlich: "?".
- Übungsnamen auf Deutsch, wenn im Log Deutsch; sonst wie geschrieben.

Wenn Werte nicht lesbar sind, nutze eine leere Zeichenkette oder "unleserlich" und erwähne das knapp in progressive_overload_analysis.

Beispiel extracted_data (zeigt erwartetes Format):
[
  {
    "date": "2024-03-15",
    "exercises": [
      {"name": "Bankdrücken", "sets": "4", "reps": "6", "weight": "100 kg"},
      {"name": "Schulterdrücken", "sets": "3", "reps": "8-10", "weight": "60 kg"},
      {"name": "Klimmzüge", "sets": "3", "reps": "8", "weight": "BW"}
    ]
  },
  {
    "date": "2024-03-18",
    "exercises": [
      {"name": "Kniebeuge", "sets": "5", "reps": "5", "weight": "120 kg"},
      {"name": "Kreuzheben", "sets": "3", "reps": "3", "weight": "160 kg"}
    ]
  }
]`;

function buildUserFollowup(args: {
  priorCount: number;
  priorJson: string;
  coachMemoryJson: string;
  coachProfileJson: string;
}): string {
  const base =
    "Bitte analysiere das beigefügte PDF vollständig gemäß den Systemanweisungen. Antworte ausschließlich mit dem JSON-Objekt.";
  const parts: string[] = [base];
  if (args.priorCount > 0) {
    parts.push(`Bereits gespeicherte Trainingstage (JSON — in extracted_data übernehmen und um die neue Einheit aus dem PDF ergänzen):
${args.priorJson}`);
  }
  parts.push(`Lokales Coach-Profil (falls ausgefüllt):
${args.coachProfileJson}`);
  parts.push(`Langzeit-Memory (backlog summary + trends + recent sessions):
${args.coachMemoryJson}`);

  return parts.join("\n\n");
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

    const pdfHash = createHash("sha256").update(buf).digest("hex");

    // ── Hash cache check (logged-in users only) ──────────────────────────────
    if (process.env.DATABASE_URL?.trim()) {
      try {
        const userSession = await getSession();
        if (userSession) {
          const cached = await prisma.session.findFirst({
            where: { userId: userSession.userId, pdfHash },
            select: { rawGeminiJson: true },
          });
          if (cached) {
            const data = parseAnalysisJson(cached.rawGeminiJson);
            return NextResponse.json(data, {
              headers: { "X-Cache": "HIT", "X-PDF-Hash": pdfHash },
            });
          }
        }
      } catch {
        /* cache miss on error — fall through to Gemini */
      }
    }

    const equipmentNarrative = parseEquipmentContextField(
      form.get("equipment_context"),
    );
    const priorExtracted = parsePriorExtractedField(form.get("prior_extracted_data"));
    const coachMemory = parseCoachMemoryField(form.get("coach_memory_local"));
    const coachProfile = parseCoachProfileField(form.get("coach_profile_local"));
    const systemPrompt = buildWorkoutSystemPrompt(
      SYSTEM_PROMPT,
      equipmentNarrative,
    );

    const ai = new GoogleGenAI({ apiKey });
    const { parts, cleanup: doCleanup } = await pdfToParts(ai, buf, inlineLimit);
    cleanup = doCleanup;

    const userFollowup = buildUserFollowup({
      priorCount: priorExtracted.length,
      priorJson: JSON.stringify(priorExtracted),
      coachMemoryJson: buildCoachMemoryContextBlock(coachMemory),
      coachProfileJson: buildCoachProfileContextBlock(coachProfile),
    });

    // ── Flash-first routing: try cheap model, fall back to Pro ───────────────
    let data: ReturnType<typeof parseAnalysisJson> | null = null;
    let lastParseError: unknown = null;

    for (const model of [MODEL_FLASH, MODEL_PRO]) {
      let raw: string | undefined;
      try {
        const response = await generateWorkoutAnalysisContent(
          ai,
          model,
          parts,
          userFollowup,
          systemPrompt,
        );
        raw = response.text ?? undefined;
      } catch (err) {
        if (model === MODEL_PRO) throw err;
        console.warn(`[analyze] ${model} request failed, falling back to Pro:`, err);
        continue;
      }

      if (!raw?.trim()) {
        if (model === MODEL_PRO) {
          return NextResponse.json(
            {
              error:
                "Das Modell hat keine nutzbare Antwort geliefert (evtl. Sicherheitsfilter oder unlesbares PDF).",
              code: "EMPTY_MODEL_RESPONSE",
            },
            { status: 502 },
          );
        }
        continue;
      }

      try {
        const parsed = parseAnalysisJson(raw);

        // Quality gate: if Flash returns too many unknown values, upgrade to Pro
        if (model === MODEL_FLASH) {
          const allEx = parsed.extracted_data.flatMap((d) => d.exercises);
          const badCount = allEx.filter(
            (ex) => !ex.weight || ex.weight === "?" || !ex.reps || ex.reps === "?",
          ).length;
          if (allEx.length > 0 && badCount > 2) {
            console.info(`[analyze] Flash quality too low (${badCount} unknown fields), retrying with Pro`);
            continue;
          }
        }

        data = parsed;
        break;
      } catch (e) {
        lastParseError = e;
        if (model === MODEL_PRO) break;
        console.warn(`[analyze] ${model} parse failed, retrying with Pro`);
      }
    }

    if (!data) {
      const hint =
        lastParseError instanceof Error && lastParseError.message === "MODEL_JSON_PARSE"
          ? "Ungültiges JSON."
          : "JSON-Struktur entspricht nicht dem erwarteten Schema.";
      return NextResponse.json(
        {
          error: `Antwort der KI konnte nicht verarbeitet werden (${hint})`,
          code: "PARSE_ERROR",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(data, { headers: { "X-PDF-Hash": pdfHash } });
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

    const mapped = geminiHttpErrorResponse(err, MODEL_PRO);
    return NextResponse.json(mapped.body, { status: mapped.status });
  } finally {
    if (cleanup) {
      await cleanup().catch(() => {});
    }
  }
}

import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { parseEquipmentContextField } from "@/lib/equipment-context";
import { geminiHttpErrorResponse } from "@/lib/gemini-route-errors";
import { generateExerciseReplacementContent } from "@/lib/gemini-exercise-replacement-generate";
import { parseExerciseReplacementJson } from "@/lib/parse-exercise-replacement-json";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-pro";

const SYSTEM_PROMPT = `Du bist ein professioneller Kraft- und Fitness-Coach. Der Nutzer möchte eine bestimmte Übung ersetzen (z. B. weil er sie nicht mag, sie schmerzt oder nicht zu seiner Ausstattung passt).

Antworte ausschließlich mit dem vorgegebenen JSON-Objekt (keine Markdown-Fences).

Regeln:
- Schlage genau EINE alternative Übung vor, die dieselbe grobe Rolle im Plan erfüllt (z. B. Rücken-Zug, Brustdrücken, Beinbeuger).
- Berücksichtige die genannte Ausstattung: nur Übungen, die damit realistisch sind.
- prescription_hint: kurz wie Sätze/Wdh./Gewicht angepasst werden könnten (z. B. "3x8–10, gleiches Gewicht wie bei der Originalübung starten").
- execution_tip: 1–2 Sätze zur Ausführung.
- why_it_fits: kurz warum die Alternative passt (Muskeln, Bewegung, Equipment).
- Antworte auf Deutsch.`;

const bodySchema = z.object({
  exercise_name: z.string().min(1).max(200),
  equipment_context: z.string().max(4000).optional(),
  reason: z.string().max(1000).optional(),
  /** Optional: Kurzkontext aus der Analyse (z. B. Overload-Text). */
  analysis_context: z.string().max(4000).optional(),
});

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

  const rl = checkRateLimit(`exercise-replacement:${getClientIp(request)}`);
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON", code: "BAD_JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültiger Body (exercise_name erforderlich).", code: "BAD_BODY" },
      { status: 400 },
    );
  }

  const { exercise_name, reason, analysis_context } = parsed.data;
  const equipmentNarrative = parseEquipmentContextField(
    parsed.data.equipment_context ?? null,
  );

  const parts: string[] = [
    `Zu ersetzende Übung: "${exercise_name.trim()}".`,
  ];
  if (reason?.trim()) {
    parts.push(`Nutzer-Grund / Wunsch: ${reason.trim()}`);
  }
  if (analysis_context?.trim()) {
    parts.push(`Kontext aus der Analyse (Auszug): ${analysis_context.trim()}`);
  }
  if (equipmentNarrative) {
    parts.push(`Verfügbare Ausstattung:\n${equipmentNarrative}`);
  }
  parts.push(
    "Bitte liefere genau ein JSON-Objekt gemäß Schema mit alternative_exercise, why_it_fits, execution_tip, prescription_hint.",
  );

  const userPrompt = parts.join("\n\n");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await generateExerciseReplacementContent(
      ai,
      MODEL,
      userPrompt,
      SYSTEM_PROMPT,
    );
    const raw = response.text;
    if (!raw?.trim()) {
      return NextResponse.json(
        {
          error: "Das Modell hat keine nutzbare Antwort geliefert.",
          code: "EMPTY_MODEL_RESPONSE",
        },
        { status: 502 },
      );
    }

    let data;
    try {
      data = parseExerciseReplacementJson(raw);
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
    const mapped = geminiHttpErrorResponse(err, MODEL);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

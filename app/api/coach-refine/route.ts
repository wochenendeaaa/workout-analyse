import {
  coachMemoryLocalSchema,
  coachProfileLocalSchema,
  postWorkoutDebriefInputSchema,
  workoutAnalysisResultSchema,
} from "@/lib/analysis-zod";
import {
  buildCoachMemoryContextBlock,
  buildCoachProfileContextBlock,
} from "@/lib/coach-memory-local";
import { generateContentWithRetry } from "@/lib/gemini-retry";
import { geminiHttpErrorResponse } from "@/lib/gemini-route-errors";
import { parseAnalysisJson } from "@/lib/parse-analysis-json";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenAI, createUserContent } from "@google/genai";
import { WORKOUT_RESPONSE_JSON_SCHEMA } from "@/lib/workout-response-json-schema";

export const runtime = "nodejs";

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-pro";

const bodySchema = z.object({
  result: workoutAnalysisResultSchema,
  answers: z
    .array(
      z.object({
        question_id: z.string(),
        answer: z.string(),
      }),
    )
    .max(8),
  coachProfile: coachProfileLocalSchema.optional().default({}),
  coachMemory: coachMemoryLocalSchema.optional().default({}),
  postWorkoutDebrief: postWorkoutDebriefInputSchema.optional().default({
    session_effort_1_10: null,
    pain_notes: "",
    recovery_flags: "",
    free_note: "",
  }),
});

const SYSTEM = `Du bist ein empathischer Strength-Coach.
Du erhältst:
- aktuelles Analyse-JSON
- Follow-up Antworten des Users
- lokales Coach-Profil + Langzeitmemory

Aufgabe:
1) Verfeinere coach_tips, next_session_prescription und coach_big_picture spürbar.
2) extracted_data unverändert lassen.
3) progressive_overload_analysis darf präzisiert werden, aber konsistent bleiben.
4) coach_followup neu bewerten:
   - required=true nur wenn trotz Antworten wichtige Lücken bleiben.
   - maximal 2 Fragen im nächsten Schritt.
5) Setze post_workout_debrief exakt auf den übergebenen Debrief.
6) Erzeuge/aktualisiere tomorrow_plan mit:
   - status: as_planned | light_adjustment | deload_signal
   - summary: 1 Satz
   - top_priorities: 2-3 Punkte
   - caution_flags: 0-3 Punkte
7) Antworte ausschließlich als gültiges JSON gemäß Schema.`;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server-Konfiguration: GEMINI_API_KEY fehlt.", code: "MISSING_API_KEY" },
      { status: 500 },
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
    return NextResponse.json({ error: "Ungültiger Body", code: "BAD_BODY" }, { status: 400 });
  }

  const { result, answers, coachProfile, coachMemory, postWorkoutDebrief } = parsed.data;
  const answersText =
    answers.length === 0
      ? "Keine zusätzlichen Antworten."
      : answers
          .map((a, i) => `${i + 1}. [${a.question_id}] ${a.answer}`)
          .join("\n");

  const userPrompt = `Aktueller Stand (JSON):
${JSON.stringify(result)}

Follow-up Antworten:
${answersText}

Coach-Profil:
${buildCoachProfileContextBlock(coachProfile)}

Coach-Memory:
${buildCoachMemoryContextBlock(coachMemory)}

Post-Workout Debrief:
${JSON.stringify(postWorkoutDebrief)}
`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await generateContentWithRetry(ai, {
      model: MODEL,
      contents: createUserContent([userPrompt]),
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: JSON.parse(
          JSON.stringify(WORKOUT_RESPONSE_JSON_SCHEMA),
        ) as Record<string, unknown>,
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    });

    const raw = response.text;
    if (!raw?.trim()) {
      return NextResponse.json(
        { error: "Keine nutzbare Antwort vom Modell.", code: "EMPTY_MODEL_RESPONSE" },
        { status: 502 },
      );
    }
    const out = parseAnalysisJson(raw);
    return NextResponse.json(out);
  } catch (err: unknown) {
    const mapped = geminiHttpErrorResponse(err, MODEL);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

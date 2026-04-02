import type { GoogleGenAI } from "@google/genai";
import { createUserContent } from "@google/genai";

import { generateContentWithRetry } from "@/lib/gemini-retry";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

const SYSTEM = `Du schreibst eine kurze Telegram-Bildunterschrift zu einem PDF mit Trainingslog und Vorschlägen für die nächste Session.
Sprache: Deutsch. Genau 2–4 Sätze. Sachlich, freundlich. Keine Hashtags, keine Aufzählungszeichen am Zeilenanfang, kein Markdown.
Erkläre knapp, was in der Datei steht (z. B. nächste Übungen, Progression, Coach-Tipps). Maximal 800 Zeichen.`;

export async function generateTelegramPdfCaption(
  ai: GoogleGenAI,
  model: string,
  result: WorkoutAnalysisResult,
): Promise<string> {
  const payload = {
    next_session_prescription: result.next_session_prescription,
    coach_tips: result.coach_tips.slice(0, 5),
    progressive_overload_analysis: result.progressive_overload_analysis.slice(0, 1200),
    extracted_days: result.extracted_data.map((d) => ({
      date: d.date,
      exercise_count: d.exercises.length,
    })),
  };

  const response = await generateContentWithRetry(ai, {
    model,
    contents: createUserContent([
      `${SYSTEM}\n\nAnalyse (JSON, gekürzt):\n${JSON.stringify(payload)}`,
    ]),
    config: {
      temperature: 0.35,
      maxOutputTokens: 512,
    },
  });

  const raw = response.text?.trim() ?? "";
  if (!raw) throw new Error("EMPTY_CAPTION");
  const cleaned = raw.replace(/^["']|["']$/g, "").trim();
  return cleaned.length > 1024 ? `${cleaned.slice(0, 1021)}…` : cleaned;
}

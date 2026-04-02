import type { GoogleGenAI } from "@google/genai";
import { createUserContent } from "@google/genai";

import { generateContentWithRetry } from "@/lib/gemini-retry";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

const SYSTEM = `Du bist der Coach und schreibst eine SEHR kurze Telegram-Nachricht zum mitgeschickten PDF (Workoutplan / Log).
Stil: locker wie „Hey Chef, hier dein neuer Workoutplan“ — Du-Form, 2–3 kurze Sätze insgesamt.
Inhalt: Plan ist drin; ein Satz was sich im Kern geändert hat; bei welcher Übung ihr Gewicht oder Volumen angezogen habt — konkret aus den Daten (Übungsname + Zielgewicht bzw. Progression).
Optional Schluss „Have Fun!“ oder „Viel Spaß!“ — nur eines.
Keine Markdown-Liste, keine Hashtags, keine Nummerierung, kein „Caption:“-Prefix.
Maximal 380 Zeichen.`;

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
      temperature: 0.4,
      maxOutputTokens: 220,
    },
  });

  const raw = response.text?.trim() ?? "";
  if (!raw) throw new Error("EMPTY_CAPTION");
  const cleaned = raw.replace(/^["']|["']$/g, "").trim();
  const max = 420;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

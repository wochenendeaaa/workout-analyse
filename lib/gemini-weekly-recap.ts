import type { GoogleGenAI } from "@google/genai";
import { createUserContent } from "@google/genai";

import { generateContentWithRetry } from "@/lib/gemini-retry";

const SYSTEM = `Du bist ein motivierender Coach. Schreibe eine Telegram-Nachricht, die die Trainingswoche des Nutzers zusammenfasst. Verwende die Du-Form. 3–5 Sätze. Fasse zusammen: Anzahl der Trainingseinheiten, Gesamtvolumen (Tonnage), neue persönliche Rekorde und die aktuelle Trainingsserie. Beende mit einem motivierenden Satz. Maximal 400 Zeichen. Kein Markdown, keine Hashtags.`;

export interface WeekStats {
  sessionCount: number;
  totalTonnageKg: number;
  newPrCount: number;
  topExercise: string | null;
  currentStreak: number;
}

export async function generateWeeklyRecapMessage(
  ai: GoogleGenAI,
  model: string,
  stats: WeekStats,
): Promise<string> {
  const payload = {
    trainingseinheiten: stats.sessionCount,
    gesamtvolumen_kg: Math.round(stats.totalTonnageKg),
    neue_prs: stats.newPrCount,
    top_uebung: stats.topExercise ?? "–",
    aktuelle_serie: stats.currentStreak,
  };

  const response = await generateContentWithRetry(ai, {
    model,
    contents: createUserContent([
      `${SYSTEM}\n\nWochenstatistik (JSON):\n${JSON.stringify(payload)}`,
    ]),
    config: {
      temperature: 0.5,
      maxOutputTokens: 220,
    },
  });

  const raw = response.text?.trim() ?? "";
  if (!raw) throw new Error("EMPTY_WEEKLY_RECAP");
  const cleaned = raw.replace(/^["']|["']$/g, "").trim();
  const max = 400;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

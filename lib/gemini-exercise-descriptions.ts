import type { GoogleGenAI } from "@google/genai";
import { createUserContent } from "@google/genai";

import { generateContentWithRetry } from "@/lib/gemini-retry";

export type ExerciseDescriptionEntry = { name: string; description: string };

const SYSTEM = `Du bist Trainingscoach. Für jede genannte Übung liefere eine kurze deutsche Beschreibung (2–4 Sätze): welche Muskelgruppen, grobe Ausführung, ein häufiger Fehler oder Tipp.
Sachlich, Du-Form oder neutral. Kein Markdown, keine Aufzählungszeichen, keine Nummerierung im Text.`;

/**
 * Liefert für jede Übung einen Kurztext für die PDF-Anhangsseite.
 */
export async function generateExerciseDescriptionsForPdf(
  ai: GoogleGenAI,
  model: string,
  exerciseNames: string[],
): Promise<ExerciseDescriptionEntry[]> {
  const unique = [...new Set(exerciseNames.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const response = await generateContentWithRetry(ai, {
    model,
    contents: createUserContent([
      `${SYSTEM}\n\nAntworte ausschließlich mit JSON: ein Objekt mit Schlüssel "exercises" (Array). Jedes Element: { "name": string, "description": string }. Jede Übung aus der Liste genau einmal, gleiche Schreibweise wie unten.\n\nÜbungen:\n${unique.map((n) => `- ${n}`).join("\n")}`,
    ]),
    config: {
      temperature: 0.25,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const raw = response.text?.trim();
  if (!raw) {
    return unique.map((name) => ({ name, description: "" }));
  }

  let parsed: { exercises?: ExerciseDescriptionEntry[] };
  try {
    parsed = JSON.parse(raw) as { exercises?: ExerciseDescriptionEntry[] };
  } catch {
    return unique.map((name) => ({ name, description: "" }));
  }

  const arr = parsed.exercises ?? [];
  return unique.map((name) => {
    const hit = arr.find(
      (e) => e.name && e.name.trim().toLowerCase() === name.toLowerCase(),
    );
    return {
      name,
      description: hit?.description?.trim() ?? "",
    };
  });
}

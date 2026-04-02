import { workoutAnalysisResultSchema } from "@/lib/analysis-zod";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

/**
 * Entfernt optionale ```json-Fences, parst JSON und validiert mit Zod.
 */
export function parseAnalysisJson(raw: string): WorkoutAnalysisResult {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(text);
  if (fence) text = fence[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("MODEL_JSON_PARSE");
  }

  const out = workoutAnalysisResultSchema.safeParse(parsed);
  if (!out.success) {
    throw new Error("MODEL_JSON_SHAPE");
  }

  return out.data;
}

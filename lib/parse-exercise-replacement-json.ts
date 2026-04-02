import { exerciseReplacementResultSchema } from "@/lib/exercise-replacement-zod";
import type { ExerciseReplacementResult } from "@/lib/exercise-replacement-zod";

export function parseExerciseReplacementJson(raw: string): ExerciseReplacementResult {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(text);
  if (fence) text = fence[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("MODEL_JSON_PARSE");
  }

  const out = exerciseReplacementResultSchema.safeParse(parsed);
  if (!out.success) {
    throw new Error("MODEL_JSON_SHAPE");
  }

  return out.data;
}

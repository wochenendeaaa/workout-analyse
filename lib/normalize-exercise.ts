import type { ExtractedExercise } from "@/lib/types/analysis";

export interface NormalizedExercise {
  name: string;
  weightKg: number | null;
  reps: number | null;
  sets: number;
}

/** Converts lbs to kg, handles comma-decimal, strips non-numeric suffix. */
export function parseWeightKgStrict(raw: string): number | null {
  const s = String(raw).replace(",", ".");
  const lbs = /(\d+(?:\.\d+)?)\s*(?:lbs?|lb\.?|pounds?)/i.exec(s);
  if (lbs) {
    const v = parseFloat(lbs[1]) * 0.453592;
    return Math.round(v * 10) / 10;
  }
  const m = /(\d+(?:\.\d+)?)/.exec(s);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function parseRepsStrict(raw: string): number | null {
  // Handle ranges like "8-10" → take lower bound
  const range = /(\d+)\s*[-–]\s*\d+/.exec(String(raw));
  if (range) return parseInt(range[1], 10);
  const m = /(\d+)/.exec(String(raw).replace(",", "."));
  return m ? parseInt(m[1], 10) : null;
}

export function parseSetsStrict(raw: string): number {
  // Handle "4x3" notation
  const times = /(\d+)\s*[xX×]/.exec(String(raw));
  if (times) return parseInt(times[1], 10);
  const m = /(\d+)/.exec(String(raw));
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}

export function normalizeExercise(ex: ExtractedExercise): NormalizedExercise {
  return {
    name: ex.name.trim(),
    weightKg: parseWeightKgStrict(ex.weight),
    reps: parseRepsStrict(ex.reps),
    sets: parseSetsStrict(ex.sets),
  };
}

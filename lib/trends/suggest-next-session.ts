import { bestE1RM } from "@/lib/trends/e1rm";

export interface ExerciseHistoryEntry {
  date: string;
  weightKg: number;
  reps: number;
  sets: number;
  rpe?: number;
}

export interface NextSessionSuggestion {
  targetWeightKg: number;
  targetReps: number;
  targetSets: number;
  rationale: string;
  deloadFlag: boolean;
}

const DEFAULT_PLATE_KG = 2.5;
const DELOAD_FACTOR = 0.9;

function avgRpe(entries: ExerciseHistoryEntry[]): number {
  const withRpe = entries.filter((e) => e.rpe != null && e.rpe > 0);
  if (withRpe.length === 0) return 0;
  return withRpe.reduce((s, e) => s + (e.rpe ?? 0), 0) / withRpe.length;
}

function e1rmTrend(entries: ExerciseHistoryEntry[]): number[] {
  return entries.map((e) => bestE1RM(e.weightKg, e.reps));
}

function isStalled(e1rms: number[]): boolean {
  if (e1rms.length < 3) return false;
  const last3 = e1rms.slice(-3);
  const max = Math.max(...last3);
  const min = Math.min(...last3);
  return max === 0 || (max - min) / max < 0.02;
}

/**
 * Suggests the next session parameters for an exercise given its history.
 *
 * scheme "linear":
 *   Increase weight by plateIncrementKg when last session hit or exceeded
 *   repRangeMax. Hold weight when within range. Deload if stalled + high RPE.
 *
 * scheme "double_progression":
 *   Work within repRangeMin–repRangeMax. When all sets hit repRangeMax,
 *   increase weight and reset rep target to repRangeMin.
 */
export function suggestNextSession(
  history: ExerciseHistoryEntry[],
  scheme: "linear" | "double_progression",
  options: {
    repRangeMin?: number;
    repRangeMax?: number;
    plateIncrementKg?: number;
  } = {},
): NextSessionSuggestion {
  const { repRangeMin = 5, repRangeMax = 8, plateIncrementKg = DEFAULT_PLATE_KG } = options;

  if (history.length === 0) {
    return {
      targetWeightKg: 0,
      targetReps: repRangeMin,
      targetSets: 3,
      rationale: "Keine Vorhistorie — starte konservativ.",
      deloadFlag: false,
    };
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const last = sorted[sorted.length - 1];
  const e1rms = e1rmTrend(sorted);
  const stalled = isStalled(e1rms);
  const highRpe = avgRpe(sorted.slice(-3)) >= 8.5;

  // Deload: stalled e1RM + high RPE
  if (stalled && highRpe) {
    const deloadWeight = Math.round((last.weightKg * DELOAD_FACTOR) / plateIncrementKg) * plateIncrementKg;
    return {
      targetWeightKg: deloadWeight,
      targetReps: repRangeMax,
      targetSets: last.sets,
      rationale: `Deload: e1RM seit 3 Sessions stagniert und RPE hoch. Gewicht um 10 % reduziert.`,
      deloadFlag: true,
    };
  }

  if (scheme === "linear") {
    const hitTop = last.reps >= repRangeMax;
    const targetWeight = hitTop
      ? last.weightKg + plateIncrementKg
      : last.weightKg;
    return {
      targetWeightKg: targetWeight,
      targetReps: repRangeMin,
      targetSets: last.sets,
      rationale: hitTop
        ? `${repRangeMax} Wdh. erreicht → +${plateIncrementKg} kg.`
        : `Ziel noch nicht erreicht → Gewicht halten, Wdh. steigern.`,
      deloadFlag: false,
    };
  }

  // double_progression
  const hitTopAll = last.reps >= repRangeMax;
  if (hitTopAll) {
    return {
      targetWeightKg: last.weightKg + plateIncrementKg,
      targetReps: repRangeMin,
      targetSets: last.sets,
      rationale: `Alle Sätze mit ${repRangeMax} Wdh. → Gewichtssteigerung, Wdh. zurück auf ${repRangeMin}.`,
      deloadFlag: false,
    };
  }

  return {
    targetWeightKg: last.weightKg,
    targetReps: Math.min(last.reps + 1, repRangeMax),
    targetSets: last.sets,
    rationale: `Noch im Wiederholungsbereich (${repRangeMin}–${repRangeMax}) → gleiche Last, +1 Wdh. anstreben.`,
    deloadFlag: false,
  };
}

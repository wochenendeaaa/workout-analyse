import { parseWeightKg } from "@/lib/volume-stats";
import { bestE1RM } from "@/lib/trends/e1rm";
import type { StoredAnalysis } from "@/lib/analysis-history";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

export type PRType = "weight" | "e1rm";

export interface DetectedPR {
  exerciseName: string;
  prType: PRType;
  newValue: number;
  previousBest: number;
}

function parseReps(s: string): number {
  const m = String(s).replace(",", ".").match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

interface ExerciseBest {
  weightKg: number;
  e1rm: number;
  hasPriorData: boolean;
}

function bestFromHistory(
  exerciseName: string,
  history: StoredAnalysis[],
): ExerciseBest {
  let bestWeight = 0;
  let bestE1rm = 0;
  let hasPriorData = false;
  const needle = exerciseName.trim().toLowerCase();

  for (const entry of history) {
    for (const day of entry.result.extracted_data) {
      for (const ex of day.exercises) {
        if (ex.name.trim().toLowerCase() !== needle) continue;
        const w = parseWeightKg(ex.weight);
        if (!w || w <= 0) continue;
        hasPriorData = true;
        const r = parseReps(ex.reps);
        if (w > bestWeight) bestWeight = w;
        if (r > 0) {
          const e = bestE1RM(w, r);
          if (e > bestE1rm) bestE1rm = e;
        }
      }
    }
  }

  return { weightKg: bestWeight, e1rm: bestE1rm, hasPriorData };
}

/**
 * Compares the current analysis result against the full localStorage history
 * and returns any new personal records found.
 * The current result must NOT already be in history (call before appendHistory).
 */
export function detectPRsFromLocalHistory(
  current: WorkoutAnalysisResult,
  history: StoredAnalysis[],
): DetectedPR[] {
  const prs: DetectedPR[] = [];

  for (const day of current.extracted_data) {
    for (const ex of day.exercises) {
      const w = parseWeightKg(ex.weight);
      if (!w || w <= 0) continue;
      const r = parseReps(ex.reps);

      const prev = bestFromHistory(ex.name, history);

      // No prior data means this is the first time — not a PR, just a first entry
      if (!prev.hasPriorData) continue;

      if (w > prev.weightKg) {
        prs.push({
          exerciseName: ex.name,
          prType: "weight",
          newValue: w,
          previousBest: prev.weightKg,
        });
      } else if (r > 0) {
        const currentE1rm = bestE1RM(w, r);
        if (currentE1rm > prev.e1rm) {
          prs.push({
            exerciseName: ex.name,
            prType: "e1rm",
            newValue: currentE1rm,
            previousBest: prev.e1rm,
          });
        }
      }
    }
  }

  // Deduplicate: keep the best PR per exercise (prefer weight PR over e1RM PR)
  const seen = new Map<string, DetectedPR>();
  for (const pr of prs) {
    const key = pr.exerciseName.trim().toLowerCase();
    const existing = seen.get(key);
    if (!existing || pr.prType === "weight") {
      seen.set(key, pr);
    }
  }

  return [...seen.values()];
}

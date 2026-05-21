import type { StoredAnalysis } from "@/lib/analysis-history";
import { computeStreakFromDates } from "@/lib/trends/compute-streak";

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  graceDaysUsed: number;
  lastSessionDate: string | null;
};

function collectSessionDates(history: StoredAnalysis[]): Date[] {
  const seen = new Set<string>();
  const dates: Date[] = [];

  for (const entry of history) {
    let added = false;
    for (const day of entry.result.extracted_data) {
      if (day.date && day.date.length >= 10) {
        const key = day.date.slice(0, 10);
        if (!seen.has(key)) {
          const d = new Date(key);
          if (!isNaN(d.getTime())) {
            seen.add(key);
            dates.push(d);
            added = true;
          }
        }
      }
    }
    if (!added && entry.savedAt) {
      const key = entry.savedAt.slice(0, 10);
      if (!seen.has(key)) {
        const d = new Date(key);
        if (!isNaN(d.getTime())) {
          seen.add(key);
          dates.push(d);
        }
      }
    }
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

export function computeStreakFromLocalHistory(
  history: StoredAnalysis[],
): StreakState {
  const dates = collectSessionDates(history);
  return computeStreakFromDates(dates);
}

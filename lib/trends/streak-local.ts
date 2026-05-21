import type { StoredAnalysis } from "@/lib/analysis-history";

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  graceDaysUsed: number;
  lastSessionDate: string | null;
}

const GRACE_MAX = 2;
const STREAK_WINDOW_DAYS = 7;
const GRACE_WINDOW_DAYS = 10;

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Extracts distinct workout date strings (YYYY-MM-DD) from localStorage history.
 * Uses the dates found in extracted_data; falls back to savedAt if no dates present.
 */
function collectSessionDates(history: StoredAnalysis[]): string[] {
  const dates = new Set<string>();

  for (const entry of history) {
    let added = false;
    for (const day of entry.result.extracted_data) {
      if (day.date && day.date.length >= 10) {
        dates.add(toDateOnly(day.date));
        added = true;
      }
    }
    if (!added && entry.savedAt) {
      dates.add(toDateOnly(entry.savedAt));
    }
  }

  return [...dates].sort();
}

/**
 * Computes streak state from the localStorage analysis history.
 * A streak increments for each session within STREAK_WINDOW_DAYS (7) of the previous.
 * A gap of 8–10 days consumes a grace day but keeps the streak alive.
 * A gap > 10 days resets the streak to 1.
 */
export function computeStreakFromLocalHistory(
  history: StoredAnalysis[],
): StreakState {
  const dates = collectSessionDates(history);

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, graceDaysUsed: 0, lastSessionDate: null };
  }

  let currentStreak = 1;
  let longestStreak = 1;
  let graceDaysUsed = 0;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const gap = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);

    if (gap <= STREAK_WINDOW_DAYS) {
      currentStreak += 1;
    } else if (gap <= GRACE_WINDOW_DAYS && graceDaysUsed < GRACE_MAX) {
      graceDaysUsed += 1;
      currentStreak += 1;
    } else {
      currentStreak = 1;
      graceDaysUsed = 0;
    }

    if (currentStreak > longestStreak) longestStreak = currentStreak;
  }

  return {
    currentStreak,
    longestStreak,
    graceDaysUsed,
    lastSessionDate: dates[dates.length - 1],
  };
}

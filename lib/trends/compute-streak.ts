const GRACE_MAX = 2;
const STREAK_WINDOW_DAYS = 7;
const GRACE_WINDOW_DAYS = 10;

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  graceDaysUsed: number;
  lastSessionDate: string | null;
}

/**
 * Pure streak computation from an array of Date objects (sorted ascending).
 * Shared by both the localStorage layer (after converting string dates)
 * and the SQL layer (after querying Session.date).
 */
export function computeStreakFromDates(dates: Date[]): StreakResult {
  // Deduplicate by date-only string
  const seen = new Set<string>();
  const unique: Date[] = [];
  for (const d of dates) {
    if (isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(d);
    }
  }
  unique.sort((a, b) => a.getTime() - b.getTime());

  if (unique.length === 0) {
    return { currentStreak: 0, longestStreak: 0, graceDaysUsed: 0, lastSessionDate: null };
  }

  let currentStreak = 1;
  let longestStreak = 1;
  let graceDaysUsed = 0;

  for (let i = 1; i < unique.length; i++) {
    const gap = Math.round(
      (unique[i].getTime() - unique[i - 1].getTime()) / 86_400_000,
    );

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
    lastSessionDate: unique[unique.length - 1].toISOString().slice(0, 10),
  };
}

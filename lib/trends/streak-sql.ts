import { computeStreakFromDates } from "@/lib/trends/compute-streak";
import type { StreakState } from "@/lib/trends/streak-local";
import type { PrismaClient } from "@prisma/client";

export type { StreakState };

/**
 * Queries all session dates for a user from the DB, computes streak,
 * upserts StreakState, and returns the result.
 */
export async function computeAndSaveStreakForUser(
  userId: string,
  prismaClient: PrismaClient,
): Promise<StreakState> {
  const sessions = await prismaClient.session.findMany({
    where: { userId },
    select: { date: true },
    orderBy: { date: "asc" },
  });

  const dates = sessions.map((s) => s.date);
  const streak = computeStreakFromDates(dates);

  await prismaClient.streakState.upsert({
    where: { userId },
    create: {
      userId,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      graceDaysUsedThisMonth: streak.graceDaysUsed,
      lastSessionDate: streak.lastSessionDate ? new Date(streak.lastSessionDate) : null,
    },
    update: {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      graceDaysUsedThisMonth: streak.graceDaysUsed,
      lastSessionDate: streak.lastSessionDate ? new Date(streak.lastSessionDate) : null,
    },
  });

  return streak;
}

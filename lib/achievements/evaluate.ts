import { prisma } from "@/lib/prisma";
import { ACHIEVEMENTS } from "@/lib/achievements/catalog";

export interface UnlockedAchievement {
  id: string;
  title: string;
  icon: string;
  isNew: boolean;
}

export async function evaluateAchievements(
  userId: string,
  sessionId: string,
): Promise<UnlockedAchievement[]> {
  try {
    // 1. Load already-unlocked achievement IDs for this user
    const existing = await prisma.achievement.findMany({ where: { userId } });
    const alreadyUnlocked = new Set(existing.map((a) => a.achievementId));

    // 2. Compute which achievements are now earned
    const earned = new Set<string>();

    // first_upload: always true after a session is saved
    const sessionCount = await prisma.session.count({ where: { userId } });
    if (sessionCount >= 1) earned.add("first_upload");

    // first_pr
    const prCount = await prisma.personalRecord.count({ where: { userId } });
    if (prCount >= 1) earned.add("first_pr");

    // streak_5 / streak_10
    const streakState = await prisma.streakState.findUnique({ where: { userId } });
    if (streakState) {
      if (streakState.currentStreak >= 5) earned.add("streak_5");
      if (streakState.currentStreak >= 10) earned.add("streak_10");
    }

    // bench_100: look for e1rm PRs on bench-press exercises >= 100 kg
    const benchPrs = await prisma.personalRecord.findMany({
      where: { userId, prType: "e1rm" },
      select: { exerciseName: true, value: true },
    });
    const hasBench100 = benchPrs.some(
      (pr) =>
        (pr.exerciseName.toLowerCase().includes("bank") ||
          pr.exerciseName.toLowerCase().includes("bench")) &&
        pr.value >= 100,
    );
    if (hasBench100) earned.add("bench_100");

    // ton_day: sum all setEntry.weightKg * setEntry.reps for current session
    const instances = await prisma.exerciseInstance.findMany({
      where: { sessionId },
      include: { sets: true },
    });
    let totalTonnage = 0;
    for (const instance of instances) {
      for (const set of instance.sets) {
        const w = set.weightKg ?? 0;
        const r = set.reps ?? 0;
        totalTonnage += w * r;
      }
    }
    if (totalTonnage >= 1000) earned.add("ton_day");

    // sessions_10 / sessions_50
    if (sessionCount >= 10) earned.add("sessions_10");
    if (sessionCount >= 50) earned.add("sessions_50");

    // 3. For each newly earned achievement, create Achievement rows
    const newlyUnlocked = [...earned].filter((id) => !alreadyUnlocked.has(id));
    for (const achievementId of newlyUnlocked) {
      try {
        await prisma.achievement.create({
          data: { userId, achievementId, unlockedAt: new Date() },
        });
      } catch {
        // May already exist due to race condition — safe to ignore
      }
    }

    // 4. Return all earned achievements with isNew flag
    const defMap = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
    const result: UnlockedAchievement[] = [];
    for (const id of earned) {
      const def = defMap.get(id);
      if (!def) continue;
      result.push({
        id,
        title: def.title,
        icon: def.icon,
        isNew: newlyUnlocked.includes(id),
      });
    }

    return result;
  } catch (err) {
    console.error("[evaluateAchievements] error", err);
    return [];
  }
}

import { bestE1RM } from "@/lib/trends/e1rm";
import type { DetectedPR } from "@/lib/trends/detect-prs-local";
import type { PrismaClient } from "@prisma/client";

export type { DetectedPR };

interface ExerciseBest {
  weightKg: number;
  e1rm: number;
}

async function bestForExerciseBeforeSession(
  exerciseName: string,
  userId: string,
  excludeSessionId: string,
  prismaClient: PrismaClient,
): Promise<ExerciseBest> {
  const rows = await prismaClient.setEntry.findMany({
    where: {
      weightKg: { not: null },
      instance: {
        rawName: exerciseName,
        session: {
          userId,
          id: { not: excludeSessionId },
        },
      },
    },
    select: { weightKg: true, reps: true },
  });

  let bestWeight = 0;
  let bestE1rm = 0;

  for (const row of rows) {
    const w = row.weightKg ?? 0;
    if (w > bestWeight) bestWeight = w;
    const r = row.reps ?? 0;
    if (r > 0) {
      const e = bestE1RM(w, r);
      if (e > bestE1rm) bestE1rm = e;
    }
  }

  return { weightKg: bestWeight, e1rm: bestE1rm };
}

/**
 * Detects PRs for a newly saved session by comparing against all prior
 * sessions for the same user. Writes PersonalRecord rows and returns them.
 */
export async function detectPRsForSession(
  sessionId: string,
  userId: string,
  prismaClient: PrismaClient,
): Promise<DetectedPR[]> {
  const instances = await prismaClient.exerciseInstance.findMany({
    where: { sessionId },
    include: { sets: true },
    orderBy: { orderInSession: "asc" },
  });

  const prs: DetectedPR[] = [];
  const seen = new Set<string>();

  for (const instance of instances) {
    const name = instance.rawName;
    if (seen.has(name.toLowerCase())) continue;

    // Check if any prior data exists for this exercise
    const priorCount = await prismaClient.setEntry.count({
      where: {
        instance: {
          rawName: name,
          session: { userId, id: { not: sessionId } },
        },
      },
    });
    if (priorCount === 0) continue;

    const prev = await bestForExerciseBeforeSession(name, userId, sessionId, prismaClient);

    let bestCurrentWeight = 0;
    let bestCurrentE1rm = 0;

    for (const set of instance.sets) {
      const w = set.weightKg ?? 0;
      if (w > bestCurrentWeight) bestCurrentWeight = w;
      const r = set.reps ?? 0;
      if (w > 0 && r > 0) {
        const e = bestE1RM(w, r);
        if (e > bestCurrentE1rm) bestCurrentE1rm = e;
      }
    }

    let pr: DetectedPR | null = null;

    if (bestCurrentWeight > prev.weightKg) {
      pr = {
        exerciseName: name,
        prType: "weight",
        newValue: bestCurrentWeight,
        previousBest: prev.weightKg,
      };
    } else if (bestCurrentE1rm > prev.e1rm) {
      pr = {
        exerciseName: name,
        prType: "e1rm",
        newValue: Math.round(bestCurrentE1rm * 10) / 10,
        previousBest: Math.round(prev.e1rm * 10) / 10,
      };
    }

    if (pr) {
      prs.push(pr);
      seen.add(name.toLowerCase());

      await prismaClient.personalRecord.create({
        data: {
          userId,
          catalogId: instance.catalogId ?? null,
          exerciseName: name,
          prType: pr.prType,
          value: pr.newValue,
          achievedAt: new Date(),
          sessionId,
        },
      });
    }
  }

  return prs;
}

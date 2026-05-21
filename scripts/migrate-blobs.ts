/**
 * One-time migration: reads all WorkoutAnalysis JSON blobs and projects them
 * into the new relational Session / ExerciseInstance / SetEntry tables.
 *
 * Usage:
 *   DATABASE_URL="file:./dev.db" npx tsx scripts/migrate-blobs.ts
 *
 * Safe to re-run: sessions are skipped if a row with the same
 * (userId, date, fileName) already exists.
 */

import { PrismaClient } from "@prisma/client";
import { workoutAnalysisResultSchema } from "../lib/analysis-zod";
import { parseWeightKg } from "../lib/volume-stats";

const prisma = new PrismaClient();

function parseReps(s: string): number | null {
  const m = String(s).replace(",", ".").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

async function main() {
  const blobs = await prisma.workoutAnalysis.findMany({
    where: { userId: { not: null } },
  });

  console.log(`Found ${blobs.length} blob(s) to migrate.`);
  let created = 0;
  let skipped = 0;

  for (const blob of blobs) {
    const parsed = workoutAnalysisResultSchema.safeParse(
      JSON.parse(blob.payload),
    );
    if (!parsed.success) {
      console.warn(`  [skip] blob ${blob.id}: Zod validation failed`);
      skipped++;
      continue;
    }

    const result = parsed.data;
    const userId = blob.userId!;

    for (const day of result.extracted_data) {
      const rawDate = day.date?.trim();
      const date = rawDate
        ? new Date(rawDate)
        : new Date(blob.createdAt);

      if (isNaN(date.getTime())) {
        console.warn(`  [skip] blob ${blob.id}: unparseable date "${rawDate}"`);
        skipped++;
        continue;
      }

      // Idempotency: skip if session already exists for this user/date/file
      const existing = await prisma.session.findFirst({
        where: {
          userId,
          date,
          fileName: blob.fileName ?? null,
        },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const session = await prisma.session.create({
        data: {
          userId,
          date,
          fileName: blob.fileName ?? null,
          rawGeminiJson: blob.payload,
        },
      });

      for (let eIdx = 0; eIdx < day.exercises.length; eIdx++) {
        const ex = day.exercises[eIdx];
        const instance = await prisma.exerciseInstance.create({
          data: {
            sessionId: session.id,
            rawName: ex.name,
            orderInSession: eIdx,
          },
        });

        const w = parseWeightKg(ex.weight);
        const r = parseReps(ex.reps);
        const setsCount = parseInt(String(ex.sets).match(/\d+/)?.[0] ?? "1", 10) || 1;

        for (let sIdx = 0; sIdx < setsCount; sIdx++) {
          await prisma.setEntry.create({
            data: {
              instanceId: instance.id,
              setNumber: sIdx + 1,
              weightKg: w ?? null,
              reps: r ?? null,
            },
          });
        }
      }

      created++;
    }
  }

  console.log(`Done. Created ${created} session(s), skipped ${skipped}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

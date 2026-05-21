/**
 * Seeds ExerciseCatalog with common lifts and their DE/EN aliases.
 * Usage: DATABASE_URL="file:./dev.db" npx tsx prisma/seed-exercise-catalog.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXERCISES: {
  canonicalName: string;
  aliases: string[];
  muscleGroup?: string;
}[] = [
  // Push
  { canonicalName: "Bankdrücken", aliases: ["bench press", "barbell bench", "flat bench", "bp"], muscleGroup: "chest" },
  { canonicalName: "Schrägbankdrücken", aliases: ["incline bench", "incline press", "incline bp"], muscleGroup: "chest" },
  { canonicalName: "Kurzhantel Bankdrücken", aliases: ["dumbbell bench", "db bench", "db press"], muscleGroup: "chest" },
  { canonicalName: "Schulterdrücken", aliases: ["overhead press", "ohp", "shoulder press", "military press", "mp"], muscleGroup: "shoulders" },
  { canonicalName: "Kurzhantel Schulterdrücken", aliases: ["dumbbell ohp", "db overhead press", "db shoulder press"], muscleGroup: "shoulders" },
  { canonicalName: "Trizeps Strecken", aliases: ["tricep extension", "skull crushers", "trizeps", "triceps"], muscleGroup: "triceps" },
  { canonicalName: "Dips", aliases: ["chest dips", "tricep dips", "parallel bars dips"], muscleGroup: "triceps" },
  { canonicalName: "Seitheben", aliases: ["lateral raise", "side raise", "lateral raise dumbbell"], muscleGroup: "shoulders" },

  // Pull
  { canonicalName: "Kreuzheben", aliases: ["deadlift", "dl", "conventional deadlift"], muscleGroup: "back" },
  { canonicalName: "Rumänisches Kreuzheben", aliases: ["romanian deadlift", "rdl", "stiff leg deadlift"], muscleGroup: "hamstrings" },
  { canonicalName: "Klimmzüge", aliases: ["pull-ups", "pullups", "chinups", "chin-ups", "klimmzug"], muscleGroup: "back" },
  { canonicalName: "Latzug", aliases: ["lat pulldown", "lat pull down", "cable lat pulldown"], muscleGroup: "back" },
  { canonicalName: "Rudern", aliases: ["barbell row", "bent over row", "bb row", "rudern"], muscleGroup: "back" },
  { canonicalName: "Kabelrudern", aliases: ["cable row", "seated cable row", "low cable row"], muscleGroup: "back" },
  { canonicalName: "Kurzhantel Rudern", aliases: ["dumbbell row", "db row", "one arm row"], muscleGroup: "back" },
  { canonicalName: "Bizepscurl", aliases: ["bicep curl", "barbell curl", "bb curl", "curl"], muscleGroup: "biceps" },
  { canonicalName: "Kurzhantel Curl", aliases: ["dumbbell curl", "db curl", "hammer curl"], muscleGroup: "biceps" },
  { canonicalName: "Face Pull", aliases: ["face pull", "facepull", "cable face pull"], muscleGroup: "shoulders" },

  // Legs
  { canonicalName: "Kniebeuge", aliases: ["squat", "barbell squat", "back squat", "bs"], muscleGroup: "quads" },
  { canonicalName: "Frontkniebeuge", aliases: ["front squat", "fs", "front squat barbell"], muscleGroup: "quads" },
  { canonicalName: "Goblet Squat", aliases: ["goblet squat", "kettlebell squat", "kb squat"], muscleGroup: "quads" },
  { canonicalName: "Beinpresse", aliases: ["leg press", "45 degree leg press"], muscleGroup: "quads" },
  { canonicalName: "Ausfallschritte", aliases: ["lunges", "lunge", "split squat", "walking lunges"], muscleGroup: "quads" },
  { canonicalName: "Beinstrecker", aliases: ["leg extension", "quad extension"], muscleGroup: "quads" },
  { canonicalName: "Beinbeuger", aliases: ["leg curl", "hamstring curl", "lying leg curl"], muscleGroup: "hamstrings" },
  { canonicalName: "Wadenheben", aliases: ["calf raise", "standing calf raise", "seated calf raise"], muscleGroup: "calves" },
  { canonicalName: "Hip Thrust", aliases: ["hip thrust", "barbell hip thrust", "glute bridge"], muscleGroup: "glutes" },

  // Core / Compound
  { canonicalName: "Plank", aliases: ["plank", "forearm plank", "brett"], muscleGroup: "core" },
  { canonicalName: "Crunch", aliases: ["crunch", "ab crunch", "sit-up", "situp"], muscleGroup: "core" },
  { canonicalName: "Russian Twist", aliases: ["russian twist", "oblique twist"], muscleGroup: "core" },
  { canonicalName: "Farmer's Walk", aliases: ["farmer walk", "farmers walk", "farmer carry"], muscleGroup: "core" },

  // Cardio / Conditioning
  { canonicalName: "Laufen", aliases: ["run", "running", "jog", "jogging"], muscleGroup: "cardio" },
  { canonicalName: "Radfahren", aliases: ["cycling", "bike", "bicycle", "stationary bike"], muscleGroup: "cardio" },
  { canonicalName: "Rudermaschine", aliases: ["rowing machine", "erg", "concept2", "rowing"], muscleGroup: "cardio" },
];

async function main() {
  console.log(`Seeding ${EXERCISES.length} exercises…`);
  let created = 0;
  let skipped = 0;

  for (const ex of EXERCISES) {
    const existing = await prisma.exerciseCatalog.findUnique({
      where: { canonicalName: ex.canonicalName },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.exerciseCatalog.create({
      data: {
        canonicalName: ex.canonicalName,
        aliases: JSON.stringify(ex.aliases),
        muscleGroup: ex.muscleGroup ?? null,
      },
    });
    created++;
  }

  console.log(`Done. Created ${created}, skipped ${skipped}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

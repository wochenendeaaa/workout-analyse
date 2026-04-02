import { z } from "zod";

const extractedExerciseSchema = z.object({
  name: z.string(),
  sets: z.string(),
  reps: z.string(),
  weight: z.string(),
});

export const extractedDaySchema = z.object({
  date: z.string(),
  exercises: z.array(extractedExerciseSchema),
});

const nextSessionPrescriptionItemSchema = z.object({
  exercise_name: z.string(),
  target_sets: z.string(),
  target_reps: z.string(),
  suggested_weight: z.string(),
  rationale: z.string(),
});

export const workoutAnalysisResultSchema = z.object({
  extracted_data: z.array(extractedDaySchema),
  progressive_overload_analysis: z.string(),
  coach_tips: z.array(z.string()),
  alternative_exercises: z.array(
    z.object({
      original: z.string(),
      alternative: z.string(),
      reason: z.string(),
    }),
  ),
  /** Fehlt in älteren gespeicherten Snapshots → leeres Array. */
  next_session_prescription: z
    .array(nextSessionPrescriptionItemSchema)
    .default([]),
});

export type WorkoutAnalysisParsed = z.infer<typeof workoutAnalysisResultSchema>;

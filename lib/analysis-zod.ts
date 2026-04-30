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

const coachBigPictureSchema = z.object({
  headline: z.string(),
  watch_outs: z.array(z.string()),
});

const coachFollowupQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  kind: z.enum(["text", "scale", "choice"]),
  choices: z.array(z.string()).optional(),
});

const coachFollowupSchema = z.object({
  required: z.boolean(),
  reason: z.string(),
  questions: z.array(coachFollowupQuestionSchema).max(4).default([]),
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
  /** Optional bei älteren gespeicherten Snapshots. */
  coach_big_picture: coachBigPictureSchema.nullable().default(null),
  /** Optional bei älteren gespeicherten Snapshots. */
  coach_followup: coachFollowupSchema.nullable().default(null),
});

export type WorkoutAnalysisParsed = z.infer<typeof workoutAnalysisResultSchema>;

export const coachProfileLocalSchema = z.object({
  goal_priority: z.string().default(""),
  recurring_pain_notes: z.string().default(""),
  recovery_notes: z.string().default(""),
  schedule_constraints: z.string().default(""),
  preferred_training_days: z.string().default(""),
});

export const coachRefineAnswerSchema = z.object({
  question_id: z.string(),
  answer: z.string(),
});

export const coachTrendStatsSchema = z.object({
  total_sessions_seen: z.number().int().min(0).default(0),
  unique_exercises_seen: z.number().int().min(0).default(0),
  approximate_total_sets: z.number().int().min(0).default(0),
});

export const coachMemoryLocalSchema = z.object({
  recent_sessions: z.array(extractedDaySchema).default([]),
  long_term_summary: z.string().default(""),
  trend_stats: coachTrendStatsSchema.default({
    total_sessions_seen: 0,
    unique_exercises_seen: 0,
    approximate_total_sets: 0,
  }),
  last_updated_at: z.string().default(""),
});

import { z } from "zod";

export const exerciseReplacementResultSchema = z.object({
  alternative_exercise: z.string(),
  why_it_fits: z.string(),
  execution_tip: z.string(),
  prescription_hint: z.string(),
});

export type ExerciseReplacementResult = z.infer<typeof exerciseReplacementResultSchema>;

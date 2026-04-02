import { workoutAnalysisResultSchema } from "@/lib/analysis-zod";
import { z } from "zod";

export const googleCalendarEventBodySchema = z
  .object({
    result: workoutAnalysisResultSchema,
    timeZone: z.string().min(1).max(64),
    start: z.string().min(1),
    end: z.string().optional(),
    durationMinutes: z.number().int().min(15).max(600).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.end === undefined && data.durationMinutes === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "end oder durationMinutes erforderlich",
        path: ["end"],
      });
    }
    if (data.end !== undefined && data.durationMinutes !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "nur eines von end und durationMinutes",
        path: ["durationMinutes"],
      });
    }
  });

export type GoogleCalendarEventBody = z.infer<typeof googleCalendarEventBodySchema>;

export function parseEventStartEnd(data: GoogleCalendarEventBody): {
  start: Date;
  end: Date;
} | { error: string } {
  const start = new Date(data.start);
  if (Number.isNaN(start.getTime())) {
    return { error: "Ungültiges Start-Datum." };
  }
  let end: Date;
  if (data.end !== undefined) {
    end = new Date(data.end);
    if (Number.isNaN(end.getTime())) {
      return { error: "Ungültiges End-Datum." };
    }
  } else {
    const mins = data.durationMinutes ?? 90;
    end = new Date(start.getTime() + mins * 60 * 1000);
  }
  if (end <= start) {
    return { error: "Ende muss nach dem Start liegen." };
  }
  return { start, end };
}

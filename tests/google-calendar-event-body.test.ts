import {
  googleCalendarEventBodySchema,
  parseEventStartEnd,
} from "@/lib/google-calendar-event-body";
import { workoutAnalysisResultSchema } from "@/lib/analysis-zod";
import { describe, expect, it } from "vitest";

const minimalResult = workoutAnalysisResultSchema.parse({
  extracted_data: [],
  progressive_overload_analysis: "",
  coach_tips: [],
  alternative_exercises: [],
  next_session_prescription: [],
});

describe("googleCalendarEventBodySchema", () => {
  it("akzeptiert start + durationMinutes", () => {
    const out = googleCalendarEventBodySchema.safeParse({
      result: minimalResult,
      timeZone: "Europe/Berlin",
      start: "2026-04-02T16:00:00.000Z",
      durationMinutes: 90,
    });
    expect(out.success).toBe(true);
  });

  it("akzeptiert start + end", () => {
    const out = googleCalendarEventBodySchema.safeParse({
      result: minimalResult,
      timeZone: "Europe/Zurich",
      start: "2026-04-02T16:00:00.000Z",
      end: "2026-04-02T17:30:00.000Z",
    });
    expect(out.success).toBe(true);
  });

  it("lehnt fehlendes end und duration ab", () => {
    const out = googleCalendarEventBodySchema.safeParse({
      result: minimalResult,
      timeZone: "UTC",
      start: "2026-04-02T16:00:00.000Z",
    });
    expect(out.success).toBe(false);
  });
});

describe("parseEventStartEnd", () => {
  it("berechnet Ende aus Dauer", () => {
    const p = googleCalendarEventBodySchema.parse({
      result: minimalResult,
      timeZone: "Europe/Berlin",
      start: "2026-04-02T16:00:00.000Z",
      durationMinutes: 60,
    });
    const r = parseEventStartEnd(p);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.end.getTime() - r.start.getTime()).toBe(60 * 60 * 1000);
  });

  it("lehnt end vor start ab", () => {
    const raw = {
      result: minimalResult,
      timeZone: "UTC",
      start: "2026-04-02T18:00:00.000Z",
      end: "2026-04-02T16:00:00.000Z",
    };
    const p = googleCalendarEventBodySchema.parse(raw);
    const r = parseEventStartEnd(p);
    expect("error" in r).toBe(true);
  });
});

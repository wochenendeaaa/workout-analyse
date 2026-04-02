import {
  buildNextSessionCalendarDescription,
  buildNextSessionCalendarSummary,
} from "@/lib/build-next-session-calendar-event";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";
import { describe, expect, it } from "vitest";

const sample: WorkoutAnalysisResult = {
  extracted_data: [],
  progressive_overload_analysis: "Mehr Volumen bei Bankdrücken.",
  coach_tips: [],
  alternative_exercises: [],
  next_session_prescription: [
    {
      exercise_name: "Bankdrücken",
      target_sets: "3",
      target_reps: "8-10",
      suggested_weight: "62,5 kg",
      rationale: "Progression",
    },
  ],
};

describe("buildNextSessionCalendarSummary", () => {
  it("nutzt einen Titel mit erster Übung", () => {
    expect(buildNextSessionCalendarSummary(sample)).toBe("Training: Bankdrücken");
  });

  it("Fallback ohne Prescription", () => {
    expect(
      buildNextSessionCalendarSummary({
        ...sample,
        next_session_prescription: [],
      }),
    ).toBe("Training — nächste Session");
  });
});

describe("buildNextSessionCalendarDescription", () => {
  it("enthält Übungszeilen und Progression", () => {
    const d = buildNextSessionCalendarDescription(sample);
    expect(d).toContain("Bankdrücken");
    expect(d).toContain("Progression:");
    expect(d).toContain("Mehr Volumen");
  });
});

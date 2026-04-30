import { describe, expect, it } from "vitest";

import { workoutAnalysisResultSchema } from "@/lib/analysis-zod";

describe("workoutAnalysisResultSchema", () => {
  it("accepts minimal valid payload with empty next_session_prescription", () => {
    const minimal = {
      extracted_data: [],
      progressive_overload_analysis: "",
      coach_tips: [],
      alternative_exercises: [],
      next_session_prescription: [],
      coach_big_picture: null,
    };
    const out = workoutAnalysisResultSchema.safeParse(minimal);
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.data.next_session_prescription).toEqual([]);
    }
  });

  it("fills default next_session_prescription when key missing (legacy JSON)", () => {
    const legacy = {
      extracted_data: [],
      progressive_overload_analysis: "",
      coach_tips: [],
      alternative_exercises: [],
    };
    const out = workoutAnalysisResultSchema.safeParse(legacy);
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.data.next_session_prescription).toEqual([]);
      expect(out.data.coach_big_picture).toBeNull();
    }
  });

  it("accepts prescription rows", () => {
    const row = {
      extracted_data: [],
      progressive_overload_analysis: "x",
      coach_tips: ["a"],
      alternative_exercises: [
        { original: "A", alternative: "B", reason: "c" },
      ],
      next_session_prescription: [
        {
          exercise_name: "Bankdrücken",
          target_sets: "3",
          target_reps: "8-10",
          suggested_weight: "60 kg",
          rationale: "Progression",
        },
      ],
      coach_big_picture: {
        headline: "Stabile Progression bei Push, Unterkörper braucht Feinschliff.",
        watch_outs: ["Kniebeuge-Tiefe konsistent halten", "Deload einplanen bei RPE-Spitze"],
      },
    };
    expect(workoutAnalysisResultSchema.safeParse(row).success).toBe(true);
  });
});

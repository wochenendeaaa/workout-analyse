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
      coach_followup: null,
      post_workout_debrief: null,
      tomorrow_plan: null,
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
      expect(out.data.coach_followup).toBeNull();
      expect(out.data.post_workout_debrief).toBeNull();
      expect(out.data.tomorrow_plan).toBeNull();
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
      coach_followup: {
        required: true,
        reason: "Belastungsgefühl fehlt.",
        questions: [
          { id: "rpe", prompt: "Wie schwer fühlte es sich an?", kind: "scale" },
        ],
      },
      post_workout_debrief: null,
      tomorrow_plan: {
        status: "light_adjustment",
        summary: "Morgen mit leicht reduzierter Last starten.",
        top_priorities: ["Technik vor Last", "RPE <= 8 halten"],
        caution_flags: ["Bei Schmerz sofort abbrechen"],
      },
    };
    expect(workoutAnalysisResultSchema.safeParse(row).success).toBe(true);
  });
});

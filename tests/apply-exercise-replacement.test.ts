import { describe, expect, it } from "vitest";

import { applyExerciseReplacementInPrescription } from "@/lib/apply-exercise-replacement";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

const baseResult = (): WorkoutAnalysisResult => ({
  extracted_data: [],
  progressive_overload_analysis: "",
  coach_tips: [],
  alternative_exercises: [],
  next_session_prescription: [
    {
      exercise_name: "Langhantel-Rudern",
      target_sets: "3",
      target_reps: "8-10",
      suggested_weight: "60 kg",
      rationale: "Progression",
    },
    {
      exercise_name: "Bankdrücken",
      target_sets: "4",
      target_reps: "6",
      suggested_weight: "80 kg",
      rationale: "Kraft",
    },
  ],
});

describe("applyExerciseReplacementInPrescription", () => {
  it("ersetzt die passende Zeile und setzt rationale aus Ersatzdaten", () => {
    const result = baseResult();
    const repl = {
      alternative_exercise: "  Kabelzug-Rudern  ",
      why_it_fits: "Gleiche Zugbewegung.",
      execution_tip: "Schultern zurück.",
      prescription_hint: "3x8-10",
    };
    const out = applyExerciseReplacementInPrescription(
      result,
      "langhantel-rudern",
      repl,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.next_session_prescription?.[0].exercise_name).toBe(
      "Kabelzug-Rudern",
    );
    expect(out.result.next_session_prescription?.[0].rationale).toContain(
      "Ersatz für „langhantel-rudern“",
    );
    expect(out.result.next_session_prescription?.[1].exercise_name).toBe(
      "Bankdrücken",
    );
  });

  it("scheitert bei leerer next_session_prescription", () => {
    const result: WorkoutAnalysisResult = {
      ...baseResult(),
      next_session_prescription: [],
    };
    const out = applyExerciseReplacementInPrescription(
      result,
      "Bankdrücken",
      {
        alternative_exercise: "X",
        why_it_fits: "y",
        execution_tip: "z",
        prescription_hint: "1",
      },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.message).toMatch(/Nächste Session/);
  });

  it("scheitert wenn keine Übung zur Auswahl passt", () => {
    const out = applyExerciseReplacementInPrescription(
      baseResult(),
      "Nicht im Plan",
      {
        alternative_exercise: "X",
        why_it_fits: "y",
        execution_tip: "z",
        prescription_hint: "1",
      },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.message).toMatch(/passende Zeile/);
  });

  it("scheitert bei leerem Übungsnamen", () => {
    const out = applyExerciseReplacementInPrescription(
      baseResult(),
      "   ",
      {
        alternative_exercise: "X",
        why_it_fits: "y",
        execution_tip: "z",
        prescription_hint: "1",
      },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.message).toMatch(/Keine Übung/);
  });
});

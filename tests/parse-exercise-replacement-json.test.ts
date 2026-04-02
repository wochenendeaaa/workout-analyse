import { describe, expect, it } from "vitest";

import { parseExerciseReplacementJson } from "@/lib/parse-exercise-replacement-json";

describe("parseExerciseReplacementJson", () => {
  it("parst nacktes JSON", () => {
    const raw = JSON.stringify({
      alternative_exercise: "Latzug",
      why_it_fits: "Zug für den Rücken.",
      execution_tip: "Brust raus.",
      prescription_hint: "3x10",
    });
    const out = parseExerciseReplacementJson(raw);
    expect(out.alternative_exercise).toBe("Latzug");
  });

  it("parst JSON in Markdown-Fence", () => {
    const inner = {
      alternative_exercise: "Rudern am Kabel",
      why_it_fits: "a",
      execution_tip: "b",
      prescription_hint: "c",
    };
    const raw = "```json\n" + JSON.stringify(inner) + "\n```";
    const out = parseExerciseReplacementJson(raw);
    expect(out.alternative_exercise).toBe("Rudern am Kabel");
  });
});

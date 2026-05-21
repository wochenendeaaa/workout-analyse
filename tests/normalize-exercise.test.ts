import { describe, expect, it } from "vitest";
import { parseWeightKgStrict, parseRepsStrict, parseSetsStrict, normalizeExercise } from "@/lib/normalize-exercise";

describe("parseWeightKgStrict", () => {
  it("parses kg value", () => expect(parseWeightKgStrict("80 kg")).toBe(80));
  it("parses comma-decimal", () => expect(parseWeightKgStrict("82,5 kg")).toBe(82.5));
  it("converts lbs to kg", () => expect(parseWeightKgStrict("175 lbs")).toBeCloseTo(79.4, 0));
  it("converts lb (no s)", () => expect(parseWeightKgStrict("100lb")).toBeCloseTo(45.4, 0));
  it("returns null for BW", () => expect(parseWeightKgStrict("BW")).toBeNull());
  it("returns null for empty string", () => expect(parseWeightKgStrict("")).toBeNull());
  it("returns null for zero", () => expect(parseWeightKgStrict("0 kg")).toBeNull());
  it("handles period-decimal", () => expect(parseWeightKgStrict("102.5 kg")).toBe(102.5));
});

describe("parseRepsStrict", () => {
  it("parses plain number", () => expect(parseRepsStrict("8")).toBe(8));
  it("takes lower bound of range", () => expect(parseRepsStrict("8-10")).toBe(8));
  it("takes lower bound with em-dash", () => expect(parseRepsStrict("8–10")).toBe(8));
  it("returns null for empty", () => expect(parseRepsStrict("")).toBeNull());
  it("handles comma decimal", () => expect(parseRepsStrict("6")).toBe(6));
});

describe("parseSetsStrict", () => {
  it("parses plain number", () => expect(parseSetsStrict("3")).toBe(3));
  it("parses 4x3 notation → 4", () => expect(parseSetsStrict("4x3")).toBe(4));
  it("parses 5X5 uppercase", () => expect(parseSetsStrict("5X5")).toBe(5));
  it("defaults to 1 for empty", () => expect(parseSetsStrict("")).toBe(1));
});

describe("normalizeExercise", () => {
  it("normalizes a standard exercise", () => {
    const result = normalizeExercise({ name: "Bankdrücken", sets: "4", reps: "6", weight: "100 kg" });
    expect(result).toEqual({ name: "Bankdrücken", weightKg: 100, reps: 6, sets: 4 });
  });

  it("normalizes lbs weight", () => {
    const result = normalizeExercise({ name: "Squat", sets: "3", reps: "5", weight: "225 lbs" });
    expect(result.weightKg).toBeCloseTo(102.1, 0);
    expect(result.reps).toBe(5);
    expect(result.sets).toBe(3);
  });

  it("handles BW exercises", () => {
    const result = normalizeExercise({ name: "Klimmzüge", sets: "3", reps: "8-10", weight: "BW" });
    expect(result.weightKg).toBeNull();
    expect(result.reps).toBe(8);
  });
});

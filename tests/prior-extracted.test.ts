import {
  MAX_PRIOR_EXTRACTED_DAYS,
  parsePriorExtractedField,
} from "@/lib/prior-extracted";
import { describe, expect, it } from "vitest";

describe("parsePriorExtractedField", () => {
  it("leeres Array bei fehlendem Feld", () => {
    expect(parsePriorExtractedField(null)).toEqual([]);
    expect(parsePriorExtractedField("")).toEqual([]);
  });

  it("parst gültiges JSON", () => {
    const raw = JSON.stringify([
      {
        date: "1.1.2026",
        exercises: [
          { name: "Kniebeuge", sets: "3", reps: "5", weight: "100" },
        ],
      },
    ]);
    expect(parsePriorExtractedField(raw)).toHaveLength(1);
  });

  it("kürzt auf die letzten MAX_PRIOR_EXTRACTED_DAYS Einträge", () => {
    const many = Array.from({ length: MAX_PRIOR_EXTRACTED_DAYS + 5 }, (_, i) => ({
      date: `Tag ${i}`,
      exercises: [],
    }));
    const out = parsePriorExtractedField(JSON.stringify(many));
    expect(out).toHaveLength(MAX_PRIOR_EXTRACTED_DAYS);
    expect(out[0]?.date).toBe("Tag 5");
  });

  it("ungültiges JSON → leer", () => {
    expect(parsePriorExtractedField("not json")).toEqual([]);
  });
});

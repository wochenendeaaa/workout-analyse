import { describe, expect, it } from "vitest";
import { canonicalize, type CatalogEntry } from "@/lib/exercise-canon";

const CATALOG: CatalogEntry[] = [
  { id: "1", canonicalName: "Bankdrücken", aliases: JSON.stringify(["bench press", "barbell bench", "bp", "flat bench"]) },
  { id: "2", canonicalName: "Kniebeuge", aliases: JSON.stringify(["squat", "barbell squat", "back squat"]) },
  { id: "3", canonicalName: "Kreuzheben", aliases: JSON.stringify(["deadlift", "dl", "conventional deadlift"]) },
  { id: "4", canonicalName: "Schulterdrücken", aliases: JSON.stringify(["overhead press", "ohp", "shoulder press"]) },
  { id: "5", canonicalName: "Klimmzüge", aliases: JSON.stringify(["pull-ups", "pullups", "chinups"]) },
];

describe("canonicalize", () => {
  it("returns high confidence on exact canonical name match", () => {
    const r = canonicalize("Bankdrücken", CATALOG);
    expect(r?.catalogId).toBe("1");
    expect(r?.confidence).toBe("high");
  });

  it("returns high confidence on exact alias match", () => {
    const r = canonicalize("bench press", CATALOG);
    expect(r?.catalogId).toBe("1");
    expect(r?.confidence).toBe("high");
  });

  it("is case-insensitive", () => {
    expect(canonicalize("SQUAT", CATALOG)?.catalogId).toBe("2");
    expect(canonicalize("kniebeuge", CATALOG)?.catalogId).toBe("2");
  });

  it("fuzzy-matches close misspellings", () => {
    const r = canonicalize("Deadlift", CATALOG);
    expect(r?.catalogId).toBe("3");
  });

  it("matches short aliases like 'OHP'", () => {
    const r = canonicalize("ohp", CATALOG);
    expect(r?.catalogId).toBe("4");
  });

  it("returns null for completely unrecognized name", () => {
    expect(canonicalize("Zumba", CATALOG)).toBeNull();
    expect(canonicalize("Xyz123abc", CATALOG)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(canonicalize("", CATALOG)).toBeNull();
  });

  it("returns null when catalog is empty", () => {
    expect(canonicalize("Bankdrücken", [])).toBeNull();
  });

  it("handles typo with 1-char distance as high confidence", () => {
    const r = canonicalize("Squat", CATALOG);
    expect(r?.catalogId).toBe("2");
    expect(r?.confidence).toBe("high");
  });

  it("marks high-distance fuzzy match as low confidence", () => {
    // "pullups" is in the alias list — direct match
    const exact = canonicalize("pullups", CATALOG);
    expect(exact?.confidence).toBe("high");
    // "pull up" (with space) is close but not exact
    const approx = canonicalize("pull up", CATALOG);
    expect(approx?.catalogId).toBe("5");
  });
});

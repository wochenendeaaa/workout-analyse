import { describe, expect, it } from "vitest";
import { suggestNextSession, type ExerciseHistoryEntry } from "@/lib/trends/suggest-next-session";

function entry(date: string, weightKg: number, reps: number, sets = 3, rpe?: number): ExerciseHistoryEntry {
  return { date, weightKg, reps, sets, rpe };
}

describe("suggestNextSession — no history", () => {
  it("returns zero-weight suggestion for empty history", () => {
    const r = suggestNextSession([], "linear");
    expect(r.targetWeightKg).toBe(0);
    expect(r.deloadFlag).toBe(false);
  });
});

describe("suggestNextSession — linear scheme", () => {
  it("increases weight when top of rep range is hit", () => {
    const history = [
      entry("2024-01-01", 100, 5),
      entry("2024-01-08", 100, 8), // hit repRangeMax (default 8)
    ];
    const r = suggestNextSession(history, "linear", { repRangeMax: 8, plateIncrementKg: 2.5 });
    expect(r.targetWeightKg).toBe(102.5);
    expect(r.deloadFlag).toBe(false);
  });

  it("holds weight when below top of rep range", () => {
    const history = [entry("2024-01-01", 100, 6)];
    const r = suggestNextSession(history, "linear", { repRangeMax: 8 });
    expect(r.targetWeightKg).toBe(100);
    expect(r.deloadFlag).toBe(false);
  });

  it("flags deload when e1RM stalled and RPE high", () => {
    const history = [
      entry("2024-01-01", 100, 5, 3, 9),
      entry("2024-01-08", 100, 5, 3, 9),
      entry("2024-01-15", 100, 5, 3, 9),
    ];
    const r = suggestNextSession(history, "linear");
    expect(r.deloadFlag).toBe(true);
    expect(r.targetWeightKg).toBeLessThan(100);
  });

  it("does not deload when stalled but RPE is low", () => {
    const history = [
      entry("2024-01-01", 100, 5, 3, 6),
      entry("2024-01-08", 100, 5, 3, 6),
      entry("2024-01-15", 100, 5, 3, 6),
    ];
    const r = suggestNextSession(history, "linear");
    expect(r.deloadFlag).toBe(false);
  });

  it("uses last session weight as base", () => {
    const history = [
      entry("2024-01-01", 80, 5),
      entry("2024-01-08", 90, 4),
    ];
    const r = suggestNextSession(history, "linear", { repRangeMax: 8 });
    expect(r.targetWeightKg).toBe(90); // last session weight held, 4 < 8
  });
});

describe("suggestNextSession — double progression scheme", () => {
  it("increases weight and resets reps when top of range hit", () => {
    const history = [entry("2024-01-01", 60, 10)];
    const r = suggestNextSession(history, "double_progression", {
      repRangeMin: 8,
      repRangeMax: 10,
      plateIncrementKg: 2,
    });
    expect(r.targetWeightKg).toBe(62);
    expect(r.targetReps).toBe(8); // reset to min
  });

  it("holds weight and adds 1 rep when below top", () => {
    const history = [entry("2024-01-01", 60, 8)];
    const r = suggestNextSession(history, "double_progression", {
      repRangeMin: 8,
      repRangeMax: 10,
    });
    expect(r.targetWeightKg).toBe(60);
    expect(r.targetReps).toBe(9);
  });
});

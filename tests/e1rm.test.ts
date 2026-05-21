import { describe, expect, it } from "vitest";
import { bestE1RM, brzycki, epley } from "@/lib/trends/e1rm";

describe("epley", () => {
  it("returns weight unchanged for 1 rep", () => {
    expect(epley(100, 1)).toBe(100);
  });

  it("returns 0 for 0 reps", () => {
    expect(epley(100, 0)).toBe(0);
  });

  it("returns 0 for negative reps", () => {
    expect(epley(100, -1)).toBe(0);
  });

  it("computes 100 kg × 5 reps correctly", () => {
    // 100 × (1 + 5/30) = 100 × 1.1667 ≈ 116.67
    expect(epley(100, 5)).toBeCloseTo(116.67, 1);
  });

  it("computes 80 kg × 8 reps correctly", () => {
    // 80 × (1 + 8/30) = 80 × 1.2667 ≈ 101.33
    expect(epley(80, 8)).toBeCloseTo(101.33, 1);
  });
});

describe("brzycki", () => {
  it("returns weight unchanged for 1 rep", () => {
    expect(brzycki(100, 1)).toBe(100);
  });

  it("returns 0 for 0 reps", () => {
    expect(brzycki(100, 0)).toBe(0);
  });

  it("returns 0 for negative reps", () => {
    expect(brzycki(100, -1)).toBe(0);
  });

  it("returns 0 when reps >= 37", () => {
    expect(brzycki(100, 37)).toBe(0);
    expect(brzycki(100, 40)).toBe(0);
  });

  it("computes 100 kg × 5 reps correctly", () => {
    // 100 × 36 / (37 - 5) = 100 × 36/32 = 112.5
    expect(brzycki(100, 5)).toBeCloseTo(112.5, 1);
  });

  it("computes 80 kg × 8 reps correctly", () => {
    // 80 × 36 / (37 - 8) = 80 × 36/29 ≈ 99.31
    expect(brzycki(80, 8)).toBeCloseTo(99.31, 1);
  });
});

describe("bestE1RM", () => {
  it("returns 0 for 0 weight", () => {
    expect(bestE1RM(0, 5)).toBe(0);
  });

  it("returns 0 for 0 reps", () => {
    expect(bestE1RM(100, 0)).toBe(0);
  });

  it("returns weight for 1 rep", () => {
    expect(bestE1RM(100, 1)).toBe(100);
  });

  it("returns the higher of Epley and Brzycki", () => {
    // For 100 kg × 5: Epley ≈ 116.7, Brzycki = 112.5 → takes Epley
    expect(bestE1RM(100, 5)).toBeCloseTo(116.7, 0);
  });

  it("rounds to 1 decimal", () => {
    const result = bestE1RM(82.5, 6);
    expect(Number.isFinite(result)).toBe(true);
    const decimals = result.toString().split(".")[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(1);
  });

  it("increases with heavier weight at same reps", () => {
    expect(bestE1RM(90, 5)).toBeGreaterThan(bestE1RM(80, 5));
  });

  it("increases with more reps at same weight (up to ~12)", () => {
    expect(bestE1RM(80, 10)).toBeGreaterThan(bestE1RM(80, 5));
  });
});

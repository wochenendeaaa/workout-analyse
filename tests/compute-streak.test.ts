import { describe, expect, it } from "vitest";
import { computeStreakFromDates } from "@/lib/trends/compute-streak";

function d(iso: string): Date {
  return new Date(iso);
}

describe("computeStreakFromDates", () => {
  it("returns zeros for empty array", () => {
    const r = computeStreakFromDates([]);
    expect(r.currentStreak).toBe(0);
    expect(r.longestStreak).toBe(0);
    expect(r.lastSessionDate).toBeNull();
  });

  it("returns 1 for a single date", () => {
    const r = computeStreakFromDates([d("2024-01-01")]);
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
    expect(r.lastSessionDate).toBe("2024-01-01");
  });

  it("increments for sessions within 7 days", () => {
    const r = computeStreakFromDates([
      d("2024-01-01"),
      d("2024-01-04"),
      d("2024-01-07"),
    ]);
    expect(r.currentStreak).toBe(3);
  });

  it("handles sessions exactly 7 days apart", () => {
    const r = computeStreakFromDates([d("2024-01-01"), d("2024-01-08")]);
    expect(r.currentStreak).toBe(2);
  });

  it("grace: gap of 9 days keeps streak and increments graceDaysUsed", () => {
    const r = computeStreakFromDates([d("2024-01-01"), d("2024-01-10")]);
    expect(r.currentStreak).toBe(2);
    expect(r.graceDaysUsed).toBe(1);
  });

  it("resets after gap > 10 days", () => {
    const r = computeStreakFromDates([
      d("2024-01-01"),
      d("2024-01-04"),
      d("2024-01-20"), // 16-day gap
    ]);
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(2);
  });

  it("deduplicates same-day entries", () => {
    const r = computeStreakFromDates([
      d("2024-01-01"),
      d("2024-01-01T18:00:00Z"),
      d("2024-01-03"),
    ]);
    expect(r.currentStreak).toBe(2);
  });

  it("handles unsorted input", () => {
    const r = computeStreakFromDates([
      d("2024-01-07"),
      d("2024-01-01"),
      d("2024-01-04"),
    ]);
    expect(r.currentStreak).toBe(3);
  });

  it("tracks longest streak across a reset", () => {
    const r = computeStreakFromDates([
      d("2024-01-01"),
      d("2024-01-04"),
      d("2024-01-07"), // streak 3
      d("2024-02-01"), // big gap → reset
      d("2024-02-04"), // streak 2
    ]);
    expect(r.currentStreak).toBe(2);
    expect(r.longestStreak).toBe(3);
  });

  it("sets lastSessionDate to the most recent date", () => {
    const r = computeStreakFromDates([d("2024-01-01"), d("2024-01-10")]);
    expect(r.lastSessionDate).toBe("2024-01-10");
  });
});

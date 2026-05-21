import { describe, expect, it } from "vitest";
import { weeklyVolume, type VolumeSession } from "@/lib/trends/volume";

const groupMap = new Map([
  ["bankdrücken", "chest"],
  ["kniebeuge", "quads"],
  ["schulterdrücken", "shoulders"],
]);

function makeSession(date: string, exercises: VolumeSession["exercises"]): VolumeSession {
  return { date, exercises };
}

describe("weeklyVolume", () => {
  it("computes tonnage for a single session", () => {
    const sessions = [
      makeSession("2024-01-15", [
        { name: "Bankdrücken", sets: 4, reps: 6, weightKg: 100 },
      ]),
    ];
    const result = weeklyVolume(sessions, groupMap);
    expect(result).toHaveLength(1);
    // 4 sets × 6 reps × 100 kg = 2400 kg
    expect(result[0].tonnageKg).toBe(2400);
    expect(result[0].muscleGroup).toBe("chest");
    expect(result[0].weekStart).toBe("2024-01-15");
  });

  it("groups sessions in the same week by muscle group", () => {
    const sessions = [
      makeSession("2024-01-15", [{ name: "Bankdrücken", sets: 3, reps: 8, weightKg: 80 }]),
      makeSession("2024-01-17", [{ name: "Bankdrücken", sets: 4, reps: 6, weightKg: 100 }]),
    ];
    const result = weeklyVolume(sessions, groupMap);
    // Both in the week of 2024-01-15 (Monday)
    expect(result).toHaveLength(1);
    // (3×8×80) + (4×6×100) = 1920 + 2400 = 4320
    expect(result[0].tonnageKg).toBe(4320);
  });

  it("separates sessions in different weeks", () => {
    const sessions = [
      makeSession("2024-01-15", [{ name: "Kniebeuge", sets: 5, reps: 5, weightKg: 100 }]),
      makeSession("2024-01-22", [{ name: "Kniebeuge", sets: 5, reps: 5, weightKg: 105 }]),
    ];
    const result = weeklyVolume(sessions, groupMap);
    expect(result).toHaveLength(2);
    expect(result[0].tonnageKg).toBe(2500);
    expect(result[1].tonnageKg).toBe(2625);
  });

  it("separates different muscle groups in the same week", () => {
    const sessions = [
      makeSession("2024-01-15", [
        { name: "Bankdrücken", sets: 3, reps: 8, weightKg: 80 },
        { name: "Kniebeuge", sets: 4, reps: 6, weightKg: 120 },
      ]),
    ];
    const result = weeklyVolume(sessions, groupMap);
    expect(result).toHaveLength(2);
    const chest = result.find((r) => r.muscleGroup === "chest")!;
    const quads = result.find((r) => r.muscleGroup === "quads")!;
    expect(chest.tonnageKg).toBe(1920);
    expect(quads.tonnageKg).toBe(2880);
  });

  it("uses 'other' for unrecognized exercises", () => {
    const sessions = [
      makeSession("2024-01-15", [{ name: "SomeUnknownExercise", sets: 2, reps: 10, weightKg: 50 }]),
    ];
    const result = weeklyVolume(sessions, groupMap);
    expect(result[0].muscleGroup).toBe("other");
    expect(result[0].tonnageKg).toBe(1000);
  });

  it("skips exercises with null weight or reps", () => {
    const sessions = [
      makeSession("2024-01-15", [
        { name: "Bankdrücken", sets: 3, reps: null, weightKg: 80 },
        { name: "Kniebeuge", sets: 3, reps: 5, weightKg: null },
        { name: "Schulterdrücken", sets: 3, reps: 8, weightKg: 60 },
      ]),
    ];
    const result = weeklyVolume(sessions, groupMap);
    expect(result).toHaveLength(1);
    expect(result[0].muscleGroup).toBe("shoulders");
  });

  it("returns empty array for empty input", () => {
    expect(weeklyVolume([], groupMap)).toEqual([]);
  });
});

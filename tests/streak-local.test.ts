import { describe, expect, it } from "vitest";
import { computeStreakFromLocalHistory } from "@/lib/trends/streak-local";
import type { StoredAnalysis } from "@/lib/analysis-history";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

function makeEntry(date: string): StoredAnalysis {
  const result: WorkoutAnalysisResult = {
    extracted_data: [{ date, exercises: [] }],
    progressive_overload_analysis: "",
    coach_tips: [],
    alternative_exercises: [],
    next_session_prescription: [],
    coach_big_picture: null,
    coach_followup: null,
    post_workout_debrief: null,
    tomorrow_plan: null,
  };
  return {
    id: `entry-${date}`,
    savedAt: date + "T12:00:00Z",
    fileName: null,
    result,
  };
}

describe("computeStreakFromLocalHistory", () => {
  it("returns zeros for empty history", () => {
    const state = computeStreakFromLocalHistory([]);
    expect(state.currentStreak).toBe(0);
    expect(state.longestStreak).toBe(0);
    expect(state.lastSessionDate).toBeNull();
  });

  it("returns streak of 1 for a single session", () => {
    const state = computeStreakFromLocalHistory([makeEntry("2024-01-01")]);
    expect(state.currentStreak).toBe(1);
    expect(state.longestStreak).toBe(1);
  });

  it("increments streak for sessions within 7 days", () => {
    const history = [
      makeEntry("2024-01-01"),
      makeEntry("2024-01-03"),
      makeEntry("2024-01-06"),
    ];
    const state = computeStreakFromLocalHistory(history);
    expect(state.currentStreak).toBe(3);
    expect(state.longestStreak).toBe(3);
  });

  it("sessions exactly 7 days apart keep the streak", () => {
    const history = [
      makeEntry("2024-01-01"),
      makeEntry("2024-01-08"),
    ];
    const state = computeStreakFromLocalHistory(history);
    expect(state.currentStreak).toBe(2);
  });

  it("gap of 9 days uses a grace day and continues streak", () => {
    const history = [
      makeEntry("2024-01-01"),
      makeEntry("2024-01-10"), // 9-day gap
    ];
    const state = computeStreakFromLocalHistory(history);
    expect(state.currentStreak).toBe(2);
    expect(state.graceDaysUsed).toBe(1);
  });

  it("gap of 11 days resets streak to 1", () => {
    const history = [
      makeEntry("2024-01-01"),
      makeEntry("2024-01-05"),
      makeEntry("2024-01-20"), // 15-day gap
    ];
    const state = computeStreakFromLocalHistory(history);
    expect(state.currentStreak).toBe(1);
    expect(state.longestStreak).toBe(2);
  });

  it("uses longest streak correctly after a reset", () => {
    const history = [
      makeEntry("2024-01-01"),
      makeEntry("2024-01-03"),
      makeEntry("2024-01-05"), // streak of 3
      makeEntry("2024-02-01"), // large gap → resets to 1
      makeEntry("2024-02-03"), // streak 2
    ];
    const state = computeStreakFromLocalHistory(history);
    expect(state.currentStreak).toBe(2);
    expect(state.longestStreak).toBe(3);
  });

  it("deduplicates same-date sessions", () => {
    const history = [
      makeEntry("2024-01-01"),
      makeEntry("2024-01-01"), // duplicate date
      makeEntry("2024-01-03"),
    ];
    const state = computeStreakFromLocalHistory(history);
    expect(state.currentStreak).toBe(2);
  });

  it("sets lastSessionDate to the most recent date", () => {
    const history = [
      makeEntry("2024-01-01"),
      makeEntry("2024-01-05"),
    ];
    const state = computeStreakFromLocalHistory(history);
    expect(state.lastSessionDate).toBe("2024-01-05");
  });

  it("uses savedAt date when extracted_data has no date", () => {
    const entry: StoredAnalysis = {
      id: "x",
      savedAt: "2024-03-15T10:00:00Z",
      fileName: null,
      result: {
        extracted_data: [{ date: "", exercises: [] }],
        progressive_overload_analysis: "",
        coach_tips: [],
        alternative_exercises: [],
        next_session_prescription: [],
        coach_big_picture: null,
        coach_followup: null,
        post_workout_debrief: null,
        tomorrow_plan: null,
      },
    };
    const state = computeStreakFromLocalHistory([entry]);
    expect(state.currentStreak).toBe(1);
    expect(state.lastSessionDate).toBe("2024-03-15");
  });
});

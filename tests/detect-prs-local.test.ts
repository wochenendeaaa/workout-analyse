import { describe, expect, it } from "vitest";
import { detectPRsFromLocalHistory } from "@/lib/trends/detect-prs-local";
import type { StoredAnalysis } from "@/lib/analysis-history";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

function makeResult(exercises: { name: string; sets: string; reps: string; weight: string }[]): WorkoutAnalysisResult {
  return {
    extracted_data: [{ date: "2024-01-10", exercises }],
    progressive_overload_analysis: "",
    coach_tips: [],
    alternative_exercises: [],
    next_session_prescription: [],
    coach_big_picture: null,
    coach_followup: null,
    post_workout_debrief: null,
    tomorrow_plan: null,
  };
}

function makeHistory(entries: { date: string; exercises: { name: string; sets: string; reps: string; weight: string }[] }[]): StoredAnalysis[] {
  return entries.map((entry, i) => ({
    id: `hist-${i}`,
    savedAt: entry.date + "T12:00:00Z",
    fileName: `session-${i}.pdf`,
    result: makeResult(entry.exercises),
  }));
}

describe("detectPRsFromLocalHistory", () => {
  it("returns empty array when history is empty", () => {
    const current = makeResult([
      { name: "Bankdrücken", sets: "3", reps: "5", weight: "80 kg" },
    ]);
    expect(detectPRsFromLocalHistory(current, [])).toEqual([]);
  });

  it("detects weight PR when current session has heavier lift", () => {
    const history = makeHistory([
      { date: "2024-01-01", exercises: [{ name: "Bankdrücken", sets: "3", reps: "5", weight: "80 kg" }] },
    ]);
    const current = makeResult([
      { name: "Bankdrücken", sets: "3", reps: "3", weight: "90 kg" },
    ]);
    const prs = detectPRsFromLocalHistory(current, history);
    expect(prs).toHaveLength(1);
    expect(prs[0].prType).toBe("weight");
    expect(prs[0].newValue).toBe(90);
    expect(prs[0].previousBest).toBe(80);
    expect(prs[0].exerciseName).toBe("Bankdrücken");
  });

  it("detects e1RM PR when same weight but higher estimated max", () => {
    // Prior: 80 kg × 3 → e1RM ≈ 88
    // Current: 80 kg × 8 → e1RM ≈ 101
    const history = makeHistory([
      { date: "2024-01-01", exercises: [{ name: "Kniebeuge", sets: "3", reps: "3", weight: "80 kg" }] },
    ]);
    const current = makeResult([
      { name: "Kniebeuge", sets: "3", reps: "8", weight: "80 kg" },
    ]);
    const prs = detectPRsFromLocalHistory(current, history);
    expect(prs).toHaveLength(1);
    expect(prs[0].prType).toBe("e1rm");
    expect(prs[0].newValue).toBeGreaterThan(prs[0].previousBest);
  });

  it("does not report PR when current weight is lower than history", () => {
    const history = makeHistory([
      { date: "2024-01-01", exercises: [{ name: "Bankdrücken", sets: "3", reps: "5", weight: "100 kg" }] },
    ]);
    const current = makeResult([
      { name: "Bankdrücken", sets: "3", reps: "5", weight: "90 kg" },
    ]);
    expect(detectPRsFromLocalHistory(current, history)).toHaveLength(0);
  });

  it("does not report PR when e1RM is equal or lower", () => {
    // Prior: 100 kg × 5 → Epley ≈ 116.7
    // Current: 100 kg × 5 (same)
    const history = makeHistory([
      { date: "2024-01-01", exercises: [{ name: "Kreuzheben", sets: "1", reps: "5", weight: "100 kg" }] },
    ]);
    const current = makeResult([
      { name: "Kreuzheben", sets: "1", reps: "5", weight: "100 kg" },
    ]);
    expect(detectPRsFromLocalHistory(current, history)).toHaveLength(0);
  });

  it("deduplicates — returns only one PR per exercise (weight preferred)", () => {
    const history = makeHistory([
      { date: "2024-01-01", exercises: [{ name: "OHP", sets: "3", reps: "3", weight: "50 kg" }] },
    ]);
    // New session: heavier AND higher e1RM — should produce 1 entry, prType weight
    const current = makeResult([
      { name: "OHP", sets: "3", reps: "8", weight: "60 kg" },
    ]);
    const prs = detectPRsFromLocalHistory(current, history);
    expect(prs).toHaveLength(1);
    expect(prs[0].prType).toBe("weight");
  });

  it("handles exercises with no parseable weight gracefully", () => {
    const history = makeHistory([
      { date: "2024-01-01", exercises: [{ name: "Klimmzug", sets: "3", reps: "8", weight: "BW" }] },
    ]);
    const current = makeResult([
      { name: "Klimmzug", sets: "3", reps: "10", weight: "BW" },
    ]);
    // BW weight is not parseable, so no PR should be detected
    expect(detectPRsFromLocalHistory(current, history)).toHaveLength(0);
  });

  it("detects PRs for multiple exercises independently", () => {
    const history = makeHistory([
      {
        date: "2024-01-01",
        exercises: [
          { name: "Bankdrücken", sets: "3", reps: "5", weight: "80 kg" },
          { name: "Kniebeuge", sets: "3", reps: "5", weight: "100 kg" },
        ],
      },
    ]);
    const current = makeResult([
      { name: "Bankdrücken", sets: "3", reps: "5", weight: "82.5 kg" },
      { name: "Kniebeuge", sets: "3", reps: "5", weight: "90 kg" }, // lower — no PR
    ]);
    const prs = detectPRsFromLocalHistory(current, history);
    expect(prs).toHaveLength(1);
    expect(prs[0].exerciseName).toBe("Bankdrücken");
  });
});

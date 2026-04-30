import {
  ingestSessionsIntoCoachMemory,
  MAX_RECENT_MEMORY_SESSIONS,
  parseCoachMemoryField,
  parseCoachProfileField,
} from "@/lib/coach-memory-local";
import { describe, expect, it } from "vitest";

describe("coach-memory-local", () => {
  it("parses profile field safely", () => {
    const p = parseCoachProfileField(JSON.stringify({ goal_priority: "Hypertrophie" }));
    expect(p.goal_priority).toBe("Hypertrophie");
    expect(p.recovery_notes).toBe("");
  });

  it("parses malformed memory as empty default", () => {
    const m = parseCoachMemoryField("not-json");
    expect(m.recent_sessions).toEqual([]);
    expect(m.trend_stats.total_sessions_seen).toBe(0);
  });

  it("keeps only recent window and appends long-term summary", () => {
    const incoming = Array.from({ length: MAX_RECENT_MEMORY_SESSIONS + 3 }, (_, i) => ({
      date: `Tag ${i + 1}`,
      exercises: [{ name: "Bankdrücken", sets: "3", reps: "8", weight: "60" }],
    }));
    const out = ingestSessionsIntoCoachMemory(
      {
        recent_sessions: [],
        long_term_summary: "",
        trend_stats: {
          total_sessions_seen: 0,
          unique_exercises_seen: 0,
          approximate_total_sets: 0,
        },
        last_updated_at: "",
      },
      incoming,
    );
    expect(out.recent_sessions.length).toBe(MAX_RECENT_MEMORY_SESSIONS);
    expect(out.long_term_summary.length).toBeGreaterThan(0);
    expect(out.trend_stats.total_sessions_seen).toBe(MAX_RECENT_MEMORY_SESSIONS + 3);
  });
});

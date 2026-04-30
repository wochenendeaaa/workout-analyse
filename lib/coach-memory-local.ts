import {
  coachMemoryLocalSchema,
  coachProfileLocalSchema,
  extractedDaySchema,
} from "@/lib/analysis-zod";
import type {
  CoachMemoryLocal,
  CoachProfileLocal,
  ExtractedDay,
} from "@/lib/types/analysis";
import { z } from "zod";

export const COACH_PROFILE_LOCAL_STORAGE_KEY = "coach-profile-local-v1";
export const COACH_MEMORY_LOCAL_STORAGE_KEY = "coach-memory-local-v1";
export const MAX_RECENT_MEMORY_SESSIONS = 32;

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function parseCoachProfileLocal(raw: unknown): CoachProfileLocal {
  const out = coachProfileLocalSchema.safeParse(raw);
  if (!out.success) return coachProfileLocalSchema.parse({});
  return out.data;
}

export function parseCoachMemoryLocal(raw: unknown): CoachMemoryLocal {
  const out = coachMemoryLocalSchema.safeParse(raw);
  if (!out.success) return coachMemoryLocalSchema.parse({});
  return out.data;
}

export function loadCoachProfileLocal(): CoachProfileLocal {
  if (typeof window === "undefined") return coachProfileLocalSchema.parse({});
  const raw = localStorage.getItem(COACH_PROFILE_LOCAL_STORAGE_KEY);
  if (!raw) return coachProfileLocalSchema.parse({});
  return parseCoachProfileLocal(safeJsonParse(raw));
}

export function saveCoachProfileLocal(profile: CoachProfileLocal): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COACH_PROFILE_LOCAL_STORAGE_KEY, JSON.stringify(profile));
}

export function loadCoachMemoryLocal(): CoachMemoryLocal {
  if (typeof window === "undefined") return coachMemoryLocalSchema.parse({});
  const raw = localStorage.getItem(COACH_MEMORY_LOCAL_STORAGE_KEY);
  if (!raw) return coachMemoryLocalSchema.parse({});
  return parseCoachMemoryLocal(safeJsonParse(raw));
}

export function saveCoachMemoryLocal(memory: CoachMemoryLocal): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COACH_MEMORY_LOCAL_STORAGE_KEY, JSON.stringify(memory));
}

function parseSetsApprox(value: string): number {
  const n = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function buildTrendStats(days: ExtractedDay[]) {
  const exerciseNames = new Set<string>();
  let sets = 0;
  for (const day of days) {
    for (const ex of day.exercises) {
      const name = ex.name.trim().toLowerCase();
      if (name) exerciseNames.add(name);
      sets += parseSetsApprox(ex.sets);
    }
  }
  return {
    total_sessions_seen: days.length,
    unique_exercises_seen: exerciseNames.size,
    approximate_total_sets: sets,
  };
}

function summarizeDays(days: ExtractedDay[]): string {
  if (days.length === 0) return "";
  const recent = days.slice(-8);
  const bits = recent.map((d) => {
    const names = d.exercises
      .slice(0, 4)
      .map((x) => x.name.trim())
      .filter(Boolean)
      .join(", ");
    return `${d.date || "?"}: ${names || "ohne Übungen"}`;
  });
  return bits.join(" | ");
}

function dedupeDay(day: ExtractedDay): ExtractedDay {
  return extractedDaySchema.parse(day);
}

export function ingestSessionsIntoCoachMemory(
  prev: CoachMemoryLocal,
  incoming: ExtractedDay[],
): CoachMemoryLocal {
  const cleanIncoming = incoming.map(dedupeDay);
  if (cleanIncoming.length === 0) return prev;

  const mergedRecent = [...prev.recent_sessions, ...cleanIncoming];
  const overflowCount = Math.max(0, mergedRecent.length - MAX_RECENT_MEMORY_SESSIONS);
  const overflow = overflowCount > 0 ? mergedRecent.slice(0, overflowCount) : [];
  const recent_sessions =
    overflowCount > 0 ? mergedRecent.slice(overflowCount) : mergedRecent;

  const summaryAdd = summarizeDays(overflow);
  const long_term_summary = [prev.long_term_summary.trim(), summaryAdd.trim()]
    .filter(Boolean)
    .join(" || ")
    .slice(-5000);

  const allForStats = [...recent_sessions, ...overflow];
  const statsBase = buildTrendStats(allForStats);
  return {
    recent_sessions,
    long_term_summary,
    trend_stats: {
      total_sessions_seen:
        (prev.trend_stats.total_sessions_seen || 0) + cleanIncoming.length,
      unique_exercises_seen: Math.max(
        prev.trend_stats.unique_exercises_seen || 0,
        statsBase.unique_exercises_seen,
      ),
      approximate_total_sets:
        (prev.trend_stats.approximate_total_sets || 0) + statsBase.approximate_total_sets,
    },
    last_updated_at: new Date().toISOString(),
  };
}

const coachMemoryFormSchema = z.object({
  recent_sessions: z.array(extractedDaySchema).default([]),
  long_term_summary: z.string().default(""),
  trend_stats: z.object({
    total_sessions_seen: z.number().int().min(0).default(0),
    unique_exercises_seen: z.number().int().min(0).default(0),
    approximate_total_sets: z.number().int().min(0).default(0),
  }),
  last_updated_at: z.string().default(""),
});

export function parseCoachMemoryField(raw: unknown): CoachMemoryLocal {
  if (typeof raw !== "string" || raw.trim() === "") {
    return coachMemoryLocalSchema.parse({});
  }
  const parsed = safeJsonParse(raw);
  const out = coachMemoryFormSchema.safeParse(parsed);
  if (!out.success) return coachMemoryLocalSchema.parse({});
  return parseCoachMemoryLocal(out.data);
}

export function parseCoachProfileField(raw: unknown): CoachProfileLocal {
  if (typeof raw !== "string" || raw.trim() === "") {
    return coachProfileLocalSchema.parse({});
  }
  return parseCoachProfileLocal(safeJsonParse(raw));
}

export function buildCoachMemoryContextBlock(memory: CoachMemoryLocal): string {
  return JSON.stringify({
    trend_stats: memory.trend_stats,
    long_term_summary: memory.long_term_summary,
    recent_sessions: memory.recent_sessions,
    last_updated_at: memory.last_updated_at,
  });
}

export function buildCoachProfileContextBlock(profile: CoachProfileLocal): string {
  return JSON.stringify(profile);
}

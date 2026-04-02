import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

const HISTORY_KEY = "workout-analysis-history";
const SESSION_KEY = "workout-analysis-session";
const MAX_HISTORY = 15;

export type StoredAnalysis = {
  id: string;
  savedAt: string;
  fileName: string | null;
  result: WorkoutAnalysisResult;
};

function safeParseStored(json: string): StoredAnalysis[] {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (x): x is StoredAnalysis =>
        x &&
        typeof x === "object" &&
        typeof (x as StoredAnalysis).id === "string" &&
        typeof (x as StoredAnalysis).savedAt === "string" &&
        (x as StoredAnalysis).result != null,
    );
  } catch {
    return [];
  }
}

export function loadHistory(): StoredAnalysis[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  return safeParseStored(raw);
}

export function appendHistory(
  fileName: string | null,
  result: WorkoutAnalysisResult,
): void {
  if (typeof window === "undefined") return;
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const savedAt = new Date().toISOString();
  const next = [{ id, savedAt, fileName, result }, ...loadHistory()].slice(
    0,
    MAX_HISTORY,
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}

export function saveSessionSnapshot(
  fileName: string | null,
  result: WorkoutAnalysisResult,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ fileName, result }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function loadSessionSnapshot(): {
  fileName: string | null;
  result: WorkoutAnalysisResult;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as {
      fileName?: string | null;
      result?: WorkoutAnalysisResult;
    };
    if (!o?.result) return null;
    return { fileName: o.fileName ?? null, result: o.result };
  } catch {
    return null;
  }
}

export function clearSessionSnapshot(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

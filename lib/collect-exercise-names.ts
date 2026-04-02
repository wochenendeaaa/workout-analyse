import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

/** Eindeutige Übungsnamen aus Analyse (Vorschlag, Log, Alternativen). */
export function collectExerciseNames(result: WorkoutAnalysisResult): string[] {
  const s = new Set<string>();
  for (const p of result.next_session_prescription ?? []) {
    const n = p.exercise_name.trim();
    if (n) s.add(n);
  }
  for (const d of result.extracted_data) {
    for (const e of d.exercises) {
      const n = e.name.trim();
      if (n) s.add(n);
    }
  }
  for (const a of result.alternative_exercises) {
    const n = a.original.trim();
    if (n) s.add(n);
  }
  return [...s].sort((a, b) => a.localeCompare(b, "de"));
}

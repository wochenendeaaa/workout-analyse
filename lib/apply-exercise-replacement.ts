import type { ExerciseReplacementResult } from "@/lib/exercise-replacement-zod";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Ersetzt in `next_session_prescription` die erste Zeile, deren Übungsname zur Auswahl passt.
 */
export function applyExerciseReplacementInPrescription(
  result: WorkoutAnalysisResult,
  selectedExerciseName: string,
  repl: ExerciseReplacementResult,
): { ok: true; result: WorkoutAnalysisResult } | { ok: false; message: string } {
  const target = norm(selectedExerciseName);
  if (!target) {
    return { ok: false, message: "Keine Übung ausgewählt." };
  }

  const rx = [...(result.next_session_prescription ?? [])];
  if (rx.length === 0) {
    return {
      ok: false,
      message:
        "Es gibt keine Zeilen unter „Nächste Session“. Bitte zuerst eine Analyse mit Vorschlagszeilen nutzen.",
    };
  }

  const idx = rx.findIndex((r) => norm(r.exercise_name) === target);
  if (idx === -1) {
    return {
      ok: false,
      message:
        "Keine passende Zeile in „Nächste Session“. Schreibweise prüfen oder exakt wie in der Tabelle oben eintragen.",
    };
  }

  const rationale = [
    `Ersatz für „${selectedExerciseName.trim()}“. ${repl.why_it_fits}`,
    repl.execution_tip,
    `Vorgabe: ${repl.prescription_hint}`,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);

  rx[idx] = {
    ...rx[idx],
    exercise_name: repl.alternative_exercise.trim(),
    rationale,
  };

  return {
    ok: true,
    result: { ...result, next_session_prescription: rx },
  };
}

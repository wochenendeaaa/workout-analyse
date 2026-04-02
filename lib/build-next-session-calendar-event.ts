import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

const MAX_DESC = 8000;

export function buildNextSessionCalendarSummary(result: WorkoutAnalysisResult): string {
  const rx = result.next_session_prescription ?? [];
  if (rx.length === 0) return "Training — nächste Session";
  if (rx.length === 1) return `Training: ${rx[0].exercise_name}`;
  return `Training: ${rx[0].exercise_name} + ${rx.length - 1} weitere`;
}

export function buildNextSessionCalendarDescription(result: WorkoutAnalysisResult): string {
  const lines: string[] = [];
  for (const row of result.next_session_prescription ?? []) {
    lines.push(
      `• ${row.exercise_name}: ${row.target_sets}×${row.target_reps} @ ${row.suggested_weight} — ${row.rationale}`,
    );
  }
  const po = result.progressive_overload_analysis?.trim();
  if (po) {
    lines.push("");
    lines.push("Progression:");
    lines.push(po);
  }
  const s = lines.join("\n");
  return s.length > MAX_DESC ? `${s.slice(0, MAX_DESC - 1)}…` : s;
}

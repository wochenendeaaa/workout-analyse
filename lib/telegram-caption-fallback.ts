import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

/** Kurze Coach-Stil-Caption ohne Gemini (Telegram-Limit 1024). */
export function buildFallbackTelegramCaption(result: WorkoutAnalysisResult): string {
  const rx = result.next_session_prescription;
  const first = rx[0];
  const second = rx[1];
  const bits: string[] = ["Hey Chef, hier dein neuer Workoutplan im PDF."];
  if (first) {
    bits.push(
      `Bei ${first.exercise_name} zielst du auf ${first.suggested_weight || "die nächste Stufe"} (${first.target_sets}×${first.target_reps}).`,
    );
  } else if (result.progressive_overload_analysis.trim()) {
    bits.push(
      result.progressive_overload_analysis.replace(/\s+/g, " ").trim().slice(0, 140) +
        (result.progressive_overload_analysis.length > 140 ? "…" : ""),
    );
  }
  if (second) {
    bits.push(`Und bei ${second.exercise_name}: ${second.suggested_weight || "Progression"}.`);
  }
  bits.push("Have Fun!");
  const s = bits.join(" ");
  return s.length > 420 ? `${s.slice(0, 417)}…` : s;
}

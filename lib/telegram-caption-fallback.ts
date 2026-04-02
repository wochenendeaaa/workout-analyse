import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

/** Kurze Caption ohne Gemini (Telegram-Limit 1024). */
export function buildFallbackTelegramCaption(result: WorkoutAnalysisResult): string {
  const n = result.next_session_prescription.length;
  const names = result.next_session_prescription
    .slice(0, 4)
    .map((x) => x.exercise_name)
    .filter(Boolean);
  const tips = result.coach_tips.slice(0, 2).join(" · ");
  const parts: string[] = [];
  parts.push("Neues Trainings-Log-PDF");
  if (n > 0) {
    parts.push(
      `Nächste Session: ${n} Übung${n === 1 ? "" : "en"}${names.length ? ` (${names.join(", ")}${n > 4 ? ", …" : ""})` : ""}.`,
    );
  }
  if (tips) parts.push(`Tipps: ${tips}`);
  const s = parts.join(" ");
  return s.length > 1000 ? `${s.slice(0, 997)}…` : s;
}

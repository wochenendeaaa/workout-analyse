/** Für Content-Disposition / Download: keine Windows-verbotenen Zeichen. */
const INVALID = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * z. B. `New-Trainingplan-starting-02.04.2026.pdf` — Datum nach Europe/Berlin (heute).
 */
export function buildWorkoutLogPdfFilename(now = new Date()): string {
  const dateStr = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(now);
  const safe = dateStr.replace(/\//g, ".");
  const base = `New-Trainingplan-starting-${safe}`;
  return `${base.replace(INVALID, "-").replace(/\s+/g, "-")}.pdf`;
}

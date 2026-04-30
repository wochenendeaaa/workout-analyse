/** Für Content-Disposition / Download: keine Windows-verbotenen Zeichen. */
const INVALID = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * z. B. `workout-log-2026-04-30.pdf` — Datum nach Europe/Berlin (heute).
 * Kurz + ASCII-only, damit Telegram/Clients den Namen eher unverändert übernehmen.
 */
export function buildWorkoutLogPdfFilename(now = new Date()): string {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(now);
  const safe = dateStr.replace(/\//g, "-");
  const base = `workout-log-${safe}`;
  return `${base.replace(INVALID, "-").replace(/\s+/g, "-")}.pdf`;
}

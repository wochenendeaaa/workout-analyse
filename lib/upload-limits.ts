/**
 * Maximale PDF-Größe (Server).
 * Auf Vercel Serverless ist der Request-Body oft auf ~4.5 MB begrenzt — ohne MAX_PDF_MB wird dann 4 MB genutzt.
 */
export function getServerMaxPdfBytes(): number {
  const raw = process.env.MAX_PDF_MB?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      return Math.floor(n * 1024 * 1024);
    }
  }
  if (process.env.VERCEL) {
    return 4 * 1024 * 1024;
  }
  return 50 * 1024 * 1024;
}

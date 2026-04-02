/**
 * Clientseitiges Limit (Build-Zeit: NEXT_PUBLIC_MAX_UPLOAD_MB).
 * next.config setzt bei Vercel-Build standardmäßig 4, lokal 50.
 */
export function getClientMaxPdfBytes(): number {
  const raw = process.env.NEXT_PUBLIC_MAX_UPLOAD_MB?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      return Math.floor(n * 1024 * 1024);
    }
  }
  return 50 * 1024 * 1024;
}

export function getClientMaxPdfMbRounded(): number {
  return Math.round(getClientMaxPdfBytes() / (1024 * 1024));
}

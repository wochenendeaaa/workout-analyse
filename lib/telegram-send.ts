/**
 * Sendet ein PDF an den privaten Telegram-Bot-Chat (sendDocument).
 * Token und chat_id nur serverseitig setzen.
 */
export async function sendWorkoutPdfToTelegram(
  pdfBytes: Uint8Array,
  filename: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    return { ok: false, reason: "not_configured" };
  }

  const form = new FormData();
  form.append("chat_id", chatId);
  const buf = Buffer.from(pdfBytes);
  form.append("document", new Blob([buf], { type: "application/pdf" }), filename);

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendDocument`,
    { method: "POST", body: form },
  );

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { description?: string };
      if (j.description) detail = j.description;
    } catch {
      try {
        detail = (await res.text()).slice(0, 200);
      } catch {
        /* ignore */
      }
    }
    return { ok: false, reason: detail };
  }

  return { ok: true };
}

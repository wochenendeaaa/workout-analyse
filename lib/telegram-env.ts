/**
 * Liest TELEGRAM_* aus process.env und bereinigt typische Copy-Paste-Fehler
 * (Anführungszeichen, Zeilenumbrüche, BOM), die sonst zu Telegram 401 führen.
 */
function stripSurroundingQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return t.slice(1, -1).trim();
    }
  }
  return t;
}

export function normalizeTelegramToken(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let s = raw.replace(/^\uFEFF/, "");
  s = s.replace(/\r/g, "").replace(/\n/g, "");
  s = stripSurroundingQuotes(s);
  s = s.replace(/：/g, ":"); // full-width colon
  return s || undefined;
}

export function normalizeTelegramChatId(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let s = raw.replace(/^\uFEFF/, "");
  s = s.replace(/\r/g, "").replace(/\n/g, "");
  s = stripSurroundingQuotes(s);
  return s || undefined;
}

export function getTelegramEnv(): { token?: string; chatId?: string } {
  return {
    token: normalizeTelegramToken(process.env.TELEGRAM_BOT_TOKEN),
    chatId: normalizeTelegramChatId(process.env.TELEGRAM_CHAT_ID),
  };
}

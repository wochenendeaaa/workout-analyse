import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Liefert nur, ob Telegram serverseitig konfiguriert ist (keine Secrets). */
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const configured = Boolean(token && chatId);
  return NextResponse.json({ configured });
}

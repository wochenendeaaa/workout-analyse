import { getTelegramEnv } from "@/lib/telegram-env";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Liefert nur, ob Telegram serverseitig konfiguriert ist (keine Secrets). */
export async function GET() {
  const { token, chatId } = getTelegramEnv();
  const configured = Boolean(token && chatId);
  return NextResponse.json({ configured });
}

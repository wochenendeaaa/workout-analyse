import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  telegramChatId: z.string().trim().max(32).nullable(),
});

export async function PATCH(request: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL nicht gesetzt" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const json: unknown = await request.json().catch(() => null);
  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: { telegramChatId: body.data.telegramChatId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
}

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ telegramChatId: null });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ telegramChatId: null });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { telegramChatId: true },
    });
    return NextResponse.json({ telegramChatId: user?.telegramChatId ?? null });
  } catch {
    return NextResponse.json({ telegramChatId: null });
  }
}

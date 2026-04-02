import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Nicht angemeldet.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: { googleCalendarRefreshEnc: null },
    });
  } catch {
    return NextResponse.json(
      { error: "Datenbankfehler.", code: "INTERNAL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

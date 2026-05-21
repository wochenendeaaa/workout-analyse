import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ enabled: false });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ enabled: false }, { status: 401 });
  }

  try {
    const row = await prisma.streakState.findUnique({
      where: { userId: session.userId },
    });

    if (!row) {
      return NextResponse.json({
        enabled: true,
        currentStreak: 0,
        longestStreak: 0,
        graceDaysUsed: 0,
        lastSessionDate: null,
      });
    }

    return NextResponse.json({
      enabled: true,
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      graceDaysUsed: row.graceDaysUsedThisMonth,
      lastSessionDate: row.lastSessionDate?.toISOString().slice(0, 10) ?? null,
    });
  } catch (err) {
    console.error("[/api/streak] error", err);
    return NextResponse.json({ enabled: false }, { status: 500 });
  }
}

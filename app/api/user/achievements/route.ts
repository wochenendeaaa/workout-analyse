import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { ACHIEVEMENTS } from "@/lib/achievements/catalog";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ enabled: false, unlocked: [], catalog: ACHIEVEMENTS });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ enabled: false, unlocked: [], catalog: ACHIEVEMENTS });
  }

  try {
    const rows = await prisma.achievement.findMany({
      where: { userId: session.userId },
      orderBy: { unlockedAt: "desc" },
    });

    const unlocked = rows.map((r) => {
      const def = ACHIEVEMENTS.find((a) => a.id === r.achievementId);
      return {
        id: r.achievementId,
        title: def?.title ?? r.achievementId,
        icon: def?.icon ?? "🏅",
        description: def?.description ?? "",
        unlockedAt: r.unlockedAt.toISOString(),
      };
    });

    return NextResponse.json({ enabled: true, unlocked, catalog: ACHIEVEMENTS });
  } catch {
    return NextResponse.json({ enabled: false, unlocked: [], catalog: ACHIEVEMENTS });
  }
}

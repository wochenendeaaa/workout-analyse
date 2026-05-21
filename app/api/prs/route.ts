import { detectPRsForSession } from "@/lib/trends/detect-prs-sql";
import { computeAndSaveStreakForUser } from "@/lib/trends/streak-sql";
import { evaluateAchievements } from "@/lib/achievements/evaluate";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string(),
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ ok: false, prs: [] });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, prs: [] }, { status: 401 });
  }

  const json: unknown = await request.json();
  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  try {
    const [prs] = await Promise.all([
      detectPRsForSession(body.data.sessionId, session.userId, prisma),
      computeAndSaveStreakForUser(session.userId, prisma),
    ]);

    const achievements = await evaluateAchievements(session.userId, body.data.sessionId);

    return NextResponse.json({ ok: true, prs, achievements });
  } catch (err) {
    console.error("[/api/prs] error", err);
    return NextResponse.json({ ok: false, prs: [], achievements: [] }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { friendCode: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    const friendships = await prisma.friendship.findMany({
      where: { userId: session.userId },
      include: {
        friend: {
          select: {
            id: true,
            email: true,
            streakState: { select: { currentStreak: true } },
            personalRecords: {
              orderBy: { achievedAt: "desc" },
              take: 1,
              select: { exerciseName: true, value: true, prType: true },
            },
          },
        },
      },
    });

    const friends = friendships.map((f) => {
      const latestPr = f.friend.personalRecords[0] ?? null;
      return {
        id: f.friend.id,
        email: f.friend.email,
        currentStreak: f.friend.streakState?.currentStreak ?? 0,
        latestPrExercise: latestPr?.exerciseName ?? null,
        latestPrValue: latestPr?.value ?? null,
        latestPrType: latestPr?.prType ?? null,
      };
    });

    return NextResponse.json({ friendCode: user.friendCode, friends });
  } catch (err) {
    console.error("[/api/friends GET] error", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

const postBodySchema = z.object({
  code: z.string().min(1),
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let code: string;
  try {
    const json: unknown = await request.json();
    const body = postBodySchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }
    code = body.data.code;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    // Find user by friendCode (not self)
    const targetUser = await prisma.user.findFirst({
      where: { friendCode: code, id: { not: session.userId } },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    // Check if friendship already exists
    const existing = await prisma.friendship.findUnique({
      where: {
        userId_friendId: { userId: session.userId, friendId: targetUser.id },
      },
    });

    if (existing) {
      return NextResponse.json({ ok: true, alreadyFriends: true });
    }

    // Create friendship bidirectionally
    await prisma.$transaction([
      prisma.friendship.create({
        data: { userId: session.userId, friendId: targetUser.id },
      }),
      prisma.friendship.create({
        data: { userId: targetUser.id, friendId: session.userId },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/friends POST] error", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

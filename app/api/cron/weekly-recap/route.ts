import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { prisma } from "@/lib/prisma";
import { getTelegramEnv } from "@/lib/telegram-env";
import { generateWeeklyRecapMessage, type WeekStats } from "@/lib/gemini-weekly-recap";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Auth: check CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  // Check required env vars
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ skipped: true, reason: "not_configured" });
  }

  const { token } = getTelegramEnv();
  if (!token) {
    return NextResponse.json({ skipped: true, reason: "not_configured" });
  }

  const geminiKey =
    process.env.GOOGLE_GENAI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    return NextResponse.json({ skipped: true, reason: "not_configured" });
  }

  // Compute week start (7 days ago)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  // Query all users who have a telegramChatId set
  let users: { id: string; telegramChatId: string }[];
  try {
    const rawUsers = await prisma.user.findMany({
      where: { telegramChatId: { not: null } },
      select: { id: true, telegramChatId: true },
    });
    users = rawUsers.filter(
      (u): u is { id: string; telegramChatId: string } => u.telegramChatId != null,
    );
  } catch (err) {
    console.error("[/api/cron/weekly-recap] failed to load users", err);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  let usersNotified = 0;

  for (const user of users) {
    try {
      // Query sessions from the past 7 days
      const sessions = await prisma.session.findMany({
        where: { userId: user.id, date: { gte: weekStart } },
        select: { id: true },
      });

      if (sessions.length === 0) continue;

      const sessionIds = sessions.map((s) => s.id);

      // Compute total tonnage
      const setEntries = await prisma.setEntry.findMany({
        where: {
          instance: {
            sessionId: { in: sessionIds },
          },
        },
        select: { weightKg: true, reps: true },
      });
      const totalTonnageKg = setEntries.reduce((sum, se) => {
        return sum + (se.weightKg ?? 0) * (se.reps ?? 0);
      }, 0);

      // New PRs this week
      const newPrs = await prisma.personalRecord.findMany({
        where: { userId: user.id, achievedAt: { gte: weekStart } },
        select: { exerciseName: true },
      });
      const newPrCount = newPrs.length;

      // Top exercise: most frequent exerciseName in new PRs this week
      const prFreq = new Map<string, number>();
      for (const pr of newPrs) {
        prFreq.set(pr.exerciseName, (prFreq.get(pr.exerciseName) ?? 0) + 1);
      }
      let topExercise: string | null = null;
      let topFreq = 0;
      for (const [name, freq] of prFreq) {
        if (freq > topFreq) {
          topFreq = freq;
          topExercise = name;
        }
      }

      // Current streak
      const streakState = await prisma.streakState.findUnique({
        where: { userId: user.id },
        select: { currentStreak: true },
      });
      const currentStreak = streakState?.currentStreak ?? 0;

      const stats: WeekStats = {
        sessionCount: sessions.length,
        totalTonnageKg,
        newPrCount,
        topExercise,
        currentStreak,
      };

      const message = await generateWeeklyRecapMessage(ai, "gemini-2.0-flash", stats);

      // Send via Telegram
      const tgRes = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: user.telegramChatId,
            text: message,
          }),
        },
      );

      if (!tgRes.ok) {
        const detail = await tgRes.text().catch(() => tgRes.statusText);
        console.error(
          `[/api/cron/weekly-recap] Telegram send failed for user ${user.id}: ${detail}`,
        );
        continue;
      }

      usersNotified++;
    } catch (err) {
      console.error(`[/api/cron/weekly-recap] error for user ${user.id}`, err);
    }
  }

  return NextResponse.json({ ok: true, usersNotified });
}

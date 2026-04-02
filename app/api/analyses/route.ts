import { workoutAnalysisResultSchema } from "@/lib/analysis-zod";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const postBodySchema = z.object({
  fileName: z.string().nullable().optional(),
  result: workoutAnalysisResultSchema,
});

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ enabled: false, items: [] satisfies unknown[] });
  }
  const session = await getSession();

  try {
    const rows = await prisma.workoutAnalysis.findMany({
      where: session
        ? { userId: session.userId }
        : { userId: null },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const items: {
      id: string;
      savedAt: string;
      fileName: string | null;
      result: WorkoutAnalysisResult;
    }[] = [];
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.payload) as unknown;
        const out = workoutAnalysisResultSchema.safeParse(parsed);
        if (!out.success) continue;
        items.push({
          id: `db-${r.id}`,
          savedAt: r.createdAt.toISOString(),
          fileName: r.fileName,
          result: out.data,
        });
      } catch {
        /* skip corrupt row */
      }
    }
    return NextResponse.json({
      enabled: true,
      items,
    });
  } catch {
    return NextResponse.json({ enabled: false, items: [] });
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL nicht gesetzt" },
      { status: 503 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Server-Historie erfordert Anmeldung. Bitte registrieren oder einloggen.",
        code: "AUTH_REQUIRED",
      },
      { status: 401 },
    );
  }

  try {
    const json: unknown = await request.json();
    const body = postBodySchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json({ ok: false, error: "Ungültiger Body" }, { status: 400 });
    }
    const { fileName, result } = body.data;
    await prisma.workoutAnalysis.create({
      data: {
        fileName: fileName ?? null,
        payload: JSON.stringify(result),
        userId: session.userId,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ ok: true });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Anmeldung erforderlich.", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }
  try {
    await prisma.workoutAnalysis.deleteMany({ where: { userId: session.userId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

import { workoutAnalysisResultSchema } from "@/lib/analysis-zod";
import { getSession } from "@/lib/auth-session";
import { canonicalize } from "@/lib/exercise-canon";
import { normalizeExercise } from "@/lib/normalize-exercise";
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
    // Legacy blob write (kept until PR 6 removes it)
    await prisma.workoutAnalysis.create({
      data: {
        fileName: fileName ?? null,
        payload: JSON.stringify(result),
        userId: session.userId,
      },
    });

    // Relational write: Session + ExerciseInstance + SetEntry
    let sessionId: string | null = null;
    try {
      // Load catalog once for canonicalization
      const catalog = await prisma.exerciseCatalog.findMany({
        select: { id: true, canonicalName: true, aliases: true },
      });

      for (const day of result.extracted_data) {
        const rawDate = day.date?.trim();
        const date = rawDate ? new Date(rawDate) : new Date();
        if (isNaN(date.getTime())) continue;

        const sessionRow = await prisma.session.create({
          data: {
            userId: session.userId,
            date,
            fileName: fileName ?? null,
            rawGeminiJson: JSON.stringify(result),
          },
        });
        if (!sessionId) sessionId = sessionRow.id;

        for (let eIdx = 0; eIdx < day.exercises.length; eIdx++) {
          const ex = day.exercises[eIdx];
          const norm = normalizeExercise(ex);
          const canon = canonicalize(ex.name, catalog);

          const instance = await prisma.exerciseInstance.create({
            data: {
              sessionId: sessionRow.id,
              rawName: ex.name,
              catalogId: canon?.catalogId ?? null,
              orderInSession: eIdx,
            },
          });

          for (let sIdx = 0; sIdx < norm.sets; sIdx++) {
            await prisma.setEntry.create({
              data: {
                instanceId: instance.id,
                setNumber: sIdx + 1,
                weightKg: norm.weightKg ?? null,
                reps: norm.reps ?? null,
              },
            });
          }
        }
      }
    } catch (relErr) {
      // Relational write failure is non-fatal; blob is already saved
      console.error("[analyses POST] relational write failed", relErr);
    }

    return NextResponse.json({ ok: true, sessionId });
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

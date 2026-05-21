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
  pdfHash: z.string().optional(),
});

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ enabled: false, items: [] satisfies unknown[] });
  }
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ enabled: false, items: [] });
  }

  try {
    const items: {
      id: string;
      savedAt: string;
      fileName: string | null;
      result: WorkoutAnalysisResult;
    }[] = [];

    // New path: Sessions written post-PR6 (deduped by pdfHash in JS to avoid SQLite distinct+orderBy limitations)
    const sessionRows = await prisma.session.findMany({
      where: { userId: session.userId, pdfHash: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: { id: true, createdAt: true, fileName: true, rawGeminiJson: true, pdfHash: true },
    });
    const seenHashes = new Set<string>();
    for (const r of sessionRows) {
      if (r.pdfHash && seenHashes.has(r.pdfHash)) continue;
      if (r.pdfHash) seenHashes.add(r.pdfHash);
      try {
        const out = workoutAnalysisResultSchema.safeParse(JSON.parse(r.rawGeminiJson));
        if (!out.success) continue;
        items.push({ id: `sess-${r.id}`, savedAt: r.createdAt.toISOString(), fileName: r.fileName, result: out.data });
      } catch { /* skip */ }
    }

    // Legacy path: WorkoutAnalysis blob table (pre-PR6 uploads)
    const blobRows = await prisma.workoutAnalysis.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    for (const r of blobRows) {
      try {
        const out = workoutAnalysisResultSchema.safeParse(JSON.parse(r.payload));
        if (!out.success) continue;
        items.push({ id: `db-${r.id}`, savedAt: r.createdAt.toISOString(), fileName: r.fileName, result: out.data });
      } catch { /* skip */ }
    }

    // Sort newest first, cap at 30
    items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return NextResponse.json({ enabled: true, items: items.slice(0, 30) });
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
    const { fileName, result, pdfHash } = body.data;

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
            pdfHash: pdfHash ?? null,
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
    await Promise.all([
      prisma.workoutAnalysis.deleteMany({ where: { userId: session.userId } }),
      prisma.session.deleteMany({ where: { userId: session.userId } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

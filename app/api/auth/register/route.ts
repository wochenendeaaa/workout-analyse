import { authConfigured, createSession } from "@/lib/auth-session";
import { hashPassword } from "@/lib/auth-password";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json(
      {
        error:
          "AUTH_SECRET fehlt oder zu kurz (min. 32 Zeichen). Siehe .env.example.",
        code: "AUTH_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL nicht gesetzt.", code: "NO_DATABASE" },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON", code: "BAD_JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "E-Mail oder Passwort ungültig (Passwort min. 8 Zeichen).", code: "BAD_BODY" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });
    await createSession(user.id, user.email);
    return NextResponse.json({ ok: true, email: user.email });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Diese E-Mail ist bereits registriert.", code: "EMAIL_TAKEN" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Registrierung fehlgeschlagen.", code: "INTERNAL" }, { status: 500 });
  }
}

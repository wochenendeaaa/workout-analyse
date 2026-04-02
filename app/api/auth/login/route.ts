import { authConfigured, createSession } from "@/lib/auth-session";
import { verifyPassword } from "@/lib/auth-password";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
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
    return NextResponse.json({ error: "Ungültiger Body", code: "BAD_BODY" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: "E-Mail oder Passwort falsch.", code: "INVALID_CREDENTIALS" },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "E-Mail oder Passwort falsch.", code: "INVALID_CREDENTIALS" },
      { status: 401 },
    );
  }

  await createSession(user.id, user.email);
  return NextResponse.json({ ok: true, email: user.email });
}

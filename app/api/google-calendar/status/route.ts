import { getSession } from "@/lib/auth-session";
import { googleOAuthConfigured } from "@/lib/google-oauth-config";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = googleOAuthConfigured();
  const session = await getSession();
  const loggedIn = !!session;
  let connected = false;
  if (session) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { googleCalendarRefreshEnc: true },
      });
      connected = !!user?.googleCalendarRefreshEnc?.trim();
    } catch {
      connected = false;
    }
  }
  return NextResponse.json({ configured, connected, loggedIn });
}

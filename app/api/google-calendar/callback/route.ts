import { authConfigured } from "@/lib/auth-session";
import { createOAuth2Client } from "@/lib/google-calendar";
import { verifyGoogleOAuthState } from "@/lib/google-oauth-state";
import { encryptGoogleRefreshToken } from "@/lib/google-token-crypto";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function redirectHome(request: Request, query: Record<string, string>) {
  const u = new URL(request.url);
  u.pathname = "/";
  u.search = "";
  for (const [k, v] of Object.entries(query)) {
    u.searchParams.set(k, v);
  }
  return NextResponse.redirect(u.toString());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  if (err) {
    return redirectHome(request, { calendar: "error", reason: err });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return redirectHome(request, { calendar: "error", reason: "missing_params" });
  }

  const parsed = await verifyGoogleOAuthState(state);
  if (!parsed) {
    return redirectHome(request, { calendar: "error", reason: "bad_state" });
  }

  if (!authConfigured()) {
    return redirectHome(request, { calendar: "error", reason: "no_auth_secret" });
  }

  let refreshToken: string;
  try {
    const oauth2 = createOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      return redirectHome(request, { calendar: "error", reason: "no_refresh_token" });
    }
    refreshToken = tokens.refresh_token;
  } catch {
    return redirectHome(request, { calendar: "error", reason: "token_exchange" });
  }

  let enc: string;
  try {
    enc = encryptGoogleRefreshToken(refreshToken);
  } catch {
    return redirectHome(request, { calendar: "error", reason: "encrypt_failed" });
  }

  try {
    await prisma.user.update({
      where: { id: parsed.userId },
      data: { googleCalendarRefreshEnc: enc },
    });
  } catch {
    return redirectHome(request, { calendar: "error", reason: "save_failed" });
  }

  return redirectHome(request, { calendar: "connected" });
}

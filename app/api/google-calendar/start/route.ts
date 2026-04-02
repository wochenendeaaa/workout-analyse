import { getSession } from "@/lib/auth-session";
import {
  getGoogleClientId,
  getGoogleOAuthRedirectUri,
  googleOAuthConfigured,
} from "@/lib/google-oauth-config";
import { signGoogleOAuthState } from "@/lib/google-oauth-state";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";

export async function GET() {
  if (!googleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "Google OAuth nicht konfiguriert.",
        code: "GOOGLE_OAUTH_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Bitte zuerst anmelden.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const clientId = getGoogleClientId();
  const redirectUri = getGoogleOAuthRedirectUri();
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Google OAuth nicht konfiguriert.", code: "GOOGLE_OAUTH_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const state = await signGoogleOAuthState(session.userId);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(url);
}

/**
 * Redirect-URI muss exakt mit Google Cloud Console übereinstimmen.
 * Lokal typisch: http://localhost:3000/api/google-calendar/callback
 */
export function getGoogleOAuthRedirectUri(): string | null {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (base) {
    return `${base.replace(/\/$/, "")}/api/google-calendar/callback`;
  }
  return null;
}

export function googleOAuthConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirect = getGoogleOAuthRedirectUri();
  return !!(id && secret && redirect);
}

export function getGoogleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID?.trim() || null;
}

export function getGoogleClientSecret(): string | null {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || null;
}

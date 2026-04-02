import { SignJWT, jwtVerify } from "jose";
import { secretKey } from "@/lib/auth-secret";

const STATE_SUB = "google-oauth-state";

export async function signGoogleOAuthState(userId: string): Promise<string> {
  const key = secretKey();
  if (!key) throw new Error("AUTH_SECRET_MISSING");
  return await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(STATE_SUB)
    .setExpirationTime("5m")
    .sign(key);
}

export async function verifyGoogleOAuthState(
  token: string,
): Promise<{ userId: string } | null> {
  const key = secretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    if (payload.sub !== STATE_SUB) return null;
    const uid = typeof (payload as { uid?: unknown }).uid === "string"
      ? (payload as { uid: string }).uid
      : null;
    if (!uid) return null;
    return { userId: uid };
  } catch {
    return null;
  }
}

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "wo_session";

function secretKey(): Uint8Array | null {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s);
}

export function authConfigured(): boolean {
  return secretKey() !== null;
}

export async function createSession(userId: string, email: string): Promise<void> {
  const key = secretKey();
  if (!key) throw new Error("AUTH_SECRET_MISSING");

  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime("30d")
    .sign(key);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSession(): Promise<{ userId: string; email: string } | null> {
  const key = secretKey();
  if (!key) return null;

  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key);
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!sub || !email) return null;
    return { userId: sub, email };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

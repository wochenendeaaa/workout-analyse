/** Gemeinsamer HS256-Schlüssel für Session-Cookie und OAuth-State. */
export function secretKey(): Uint8Array | null {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s);
}

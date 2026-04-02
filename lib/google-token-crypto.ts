import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const HKDF_INFO = "workout-app-google-cal-refresh-v1";

function deriveKey(): Buffer {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET_MISSING");
  }
  return Buffer.from(hkdfSync("sha256", s, "", HKDF_INFO, 32));
}

/** Base64url-Speicherstring: IV | Tag | Ciphertext */
export function encryptGoogleRefreshToken(plain: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptGoogleRefreshToken(blob: string): string {
  const key = deriveKey();
  const buf = Buffer.from(blob, "base64url");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("INVALID_TOKEN_BLOB");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

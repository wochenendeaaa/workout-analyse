type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

const WINDOW_MS_DEFAULT = 60_000;
const MAX_DEFAULT = 12;

function windowMs(): number {
  const n = Number(process.env.RATE_LIMIT_WINDOW_MS);
  return Number.isFinite(n) && n > 0 ? n : WINDOW_MS_DEFAULT;
}

function maxRequests(): number {
  const n = Number(process.env.RATE_LIMIT_MAX);
  return Number.isFinite(n) && n > 0 ? n : MAX_DEFAULT;
}

/** Einfaches festes Fenster pro Schlüssel (pro Server-Instanz). */
export function checkRateLimit(key: string): {
  ok: true;
} | {
  ok: false;
  retryAfterSec: number;
} {
  const now = Date.now();
  const w = windowMs();
  const limit = maxRequests();

  let b = store.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + w };
    store.set(key, b);
  }

  b.count += 1;
  if (b.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }

  if (store.size > 50_000) {
    store.clear();
  }

  return { ok: true };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

import { userMessageForApiCode } from "@/lib/api-error-messages";
import {
  googleCalendarEventBodySchema,
  parseEventStartEnd,
} from "@/lib/google-calendar-event-body";
import { insertNextSessionCalendarEvent } from "@/lib/google-calendar";
import { googleOAuthConfigured } from "@/lib/google-oauth-config";
import { getSession } from "@/lib/auth-session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rl = checkRateLimit(`google-cal-event:${getClientIp(request)}`);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Zu viele Anfragen. Bitte in ${rl.retryAfterSec}s erneut versuchen.`,
        code: "RATE_LIMIT",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON", code: "BAD_JSON" }, { status: 400 });
  }

  const parsed = googleCalendarEventBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültiger Body.", code: "BAD_BODY" },
      { status: 400 },
    );
  }

  const range = parseEventStartEnd(parsed.data);
  if ("error" in range) {
    return NextResponse.json({ error: range.error, code: "BAD_DATES" }, { status: 400 });
  }

  try {
    const out = await insertNextSessionCalendarEvent(session.userId, {
      result: parsed.data.result,
      start: range.start,
      end: range.end,
      timeZone: parsed.data.timeZone,
    });
    return NextResponse.json({
      ok: true,
      eventId: out.eventId,
      htmlLink: out.htmlLink,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "GOOGLE_CALENDAR_NOT_CONNECTED") {
      return NextResponse.json(
        {
          error: "Google-Kalender nicht verbunden.",
          code: "GOOGLE_CALENDAR_NOT_CONNECTED",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: userMessageForApiCode("INTERNAL", msg || "Kalender-Eintrag fehlgeschlagen.", {
          context: "calendar",
        }),
        code: "GOOGLE_CALENDAR_INSERT_FAILED",
      },
      { status: 502 },
    );
  }
}

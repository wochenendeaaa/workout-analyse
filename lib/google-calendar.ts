import { prisma } from "@/lib/prisma";
import {
  buildNextSessionCalendarDescription,
  buildNextSessionCalendarSummary,
} from "@/lib/build-next-session-calendar-event";
import { decryptGoogleRefreshToken } from "@/lib/google-token-crypto";
import {
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleOAuthRedirectUri,
} from "@/lib/google-oauth-config";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";
import { google } from "googleapis";

export function createOAuth2Client() {
  const id = getGoogleClientId();
  const secret = getGoogleClientSecret();
  const redirect = getGoogleOAuthRedirectUri();
  if (!id || !secret || !redirect) {
    throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");
  }
  return new google.auth.OAuth2(id, secret, redirect);
}

export async function getOAuth2ClientForUser(
  userId: string,
): Promise<ReturnType<typeof createOAuth2Client> | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleCalendarRefreshEnc: true },
  });
  if (!user?.googleCalendarRefreshEnc) return null;
  let refresh: string;
  try {
    refresh = decryptGoogleRefreshToken(user.googleCalendarRefreshEnc);
  } catch {
    return null;
  }
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refresh });
  return client;
}

export async function insertNextSessionCalendarEvent(
  userId: string,
  args: {
    result: WorkoutAnalysisResult;
    start: Date;
    end: Date;
    timeZone: string;
  },
): Promise<{ eventId: string; htmlLink: string | null }> {
  const auth = await getOAuth2ClientForUser(userId);
  if (!auth) {
    throw new Error("GOOGLE_CALENDAR_NOT_CONNECTED");
  }
  const summary = buildNextSessionCalendarSummary(args.result);
  const description = buildNextSessionCalendarDescription(args.result);
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      description,
      start: {
        dateTime: args.start.toISOString(),
        timeZone: args.timeZone,
      },
      end: {
        dateTime: args.end.toISOString(),
        timeZone: args.timeZone,
      },
    },
  });
  const id = res.data.id;
  if (!id) {
    throw new Error("GOOGLE_CALENDAR_INSERT_FAILED");
  }
  return { eventId: id, htmlLink: res.data.htmlLink ?? null };
}

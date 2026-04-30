import { workoutAnalysisResultSchema } from "@/lib/analysis-zod";
import { buildWorkoutLogPdf } from "@/lib/build-workout-log-pdf";
import { generateExerciseDescriptionsForPdf } from "@/lib/gemini-exercise-descriptions";
import { generateTelegramPdfCaption } from "@/lib/gemini-telegram-caption";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  buildFallbackTelegramCaption,
  withTelegramFilenameHint,
} from "@/lib/telegram-caption-fallback";
import { sendWorkoutPdfToTelegram } from "@/lib/telegram-send";
import { buildWorkoutLogPdfFilename } from "@/lib/workout-log-filename";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

/** Schnelles Modell für kurze Telegram-Captions; sonst GEMINI_MODEL. */
const CAPTION_MODEL =
  process.env.GEMINI_TELEGRAM_CAPTION_MODEL?.trim() ||
  process.env.GEMINI_MODEL?.trim() ||
  "gemini-2.5-flash";

const PDF_EXERCISE_DESC_MODEL =
  process.env.GEMINI_PDF_EXERCISE_MODEL?.trim() ||
  process.env.GEMINI_MODEL?.trim() ||
  "gemini-2.5-flash";

const bodySchema = z.object({
  result: workoutAnalysisResultSchema,
  sendTelegram: z.boolean().optional(),
  /** Wenn false: nur statische Caption (kein zusätzlicher Gemini-Call). Default: Gemini wenn GEMINI_API_KEY gesetzt. */
  telegramGeminiCaption: z.boolean().optional(),
});

export async function POST(request: Request) {
  const rl = checkRateLimit(`workout-log-pdf:${getClientIp(request)}`);
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON", code: "BAD_JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültiger Body (result erwartet)", code: "BAD_BODY" },
      { status: 400 },
    );
  }

  const { result, sendTelegram, telegramGeminiCaption } = parsed.data;

  const uniqueExerciseNames = [
    ...new Set(
      (result.next_session_prescription ?? [])
        .map((x) => x.exercise_name.trim())
        .filter((n) => n.length > 0 && n !== "—"),
    ),
  ];

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  let exerciseDescriptions: Awaited<
    ReturnType<typeof generateExerciseDescriptionsForPdf>
  > = [];
  if (uniqueExerciseNames.length > 0 && geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      exerciseDescriptions = await generateExerciseDescriptionsForPdf(
        ai,
        PDF_EXERCISE_DESC_MODEL,
        uniqueExerciseNames,
      );
    } catch {
      exerciseDescriptions = uniqueExerciseNames.map((name) => ({ name, description: "" }));
    }
  } else if (uniqueExerciseNames.length > 0) {
    exerciseDescriptions = uniqueExerciseNames.map((name) => ({ name, description: "" }));
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildWorkoutLogPdf(result, {
      exerciseDescriptions:
        exerciseDescriptions.length > 0 ? exerciseDescriptions : undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "PDF-Erzeugung fehlgeschlagen", code: "PDF_BUILD" },
      { status: 500 },
    );
  }

  const filename = buildWorkoutLogPdfFilename();

  let telegramStatus: "sent" | "skipped" | "failed" = "skipped";
  let telegramErrorHeader: string | undefined;
  if (sendTelegram) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const wantGemini =
      telegramGeminiCaption !== false && Boolean(apiKey);
    let caption = buildFallbackTelegramCaption(result);
    if (wantGemini && apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        caption = await generateTelegramPdfCaption(ai, CAPTION_MODEL, result);
      } catch {
        caption = buildFallbackTelegramCaption(result);
      }
    }
    caption = withTelegramFilenameHint(caption, filename);
    const tg = await sendWorkoutPdfToTelegram(pdfBytes, filename, { caption });
    if (tg.ok) telegramStatus = "sent";
    else if (tg.reason === "not_configured") telegramStatus = "skipped";
    else {
      telegramStatus = "failed";
      telegramErrorHeader = encodeURIComponent(tg.reason.slice(0, 400));
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    "X-Log-Pdf-Filename": encodeURIComponent(filename),
    "X-Telegram-Status": telegramStatus,
    "Cache-Control": "no-store",
  };
  if (telegramErrorHeader) {
    headers["X-Telegram-Error"] = telegramErrorHeader;
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers,
  });
}

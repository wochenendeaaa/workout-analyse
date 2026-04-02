import { workoutAnalysisResultSchema } from "@/lib/analysis-zod";
import { buildWorkoutLogPdf } from "@/lib/build-workout-log-pdf";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendWorkoutPdfToTelegram } from "@/lib/telegram-send";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  result: workoutAnalysisResultSchema,
  sendTelegram: z.boolean().optional(),
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

  const { result, sendTelegram } = parsed.data;

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildWorkoutLogPdf(result);
  } catch {
    return NextResponse.json(
      { error: "PDF-Erzeugung fehlgeschlagen", code: "PDF_BUILD" },
      { status: 500 },
    );
  }

  const filename = `training-log-${new Date().toISOString().slice(0, 10)}.pdf`;

  let telegramStatus: "sent" | "skipped" | "failed" = "skipped";
  if (sendTelegram) {
    const tg = await sendWorkoutPdfToTelegram(pdfBytes, filename);
    if (tg.ok) telegramStatus = "sent";
    else if (tg.reason === "not_configured") telegramStatus = "skipped";
    else telegramStatus = "failed";
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Telegram-Status": telegramStatus,
      "Cache-Control": "no-store",
    },
  });
}

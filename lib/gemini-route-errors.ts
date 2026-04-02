export type GeminiRouteErrorBody = { error: string; code: string };

/**
 * Gemeinsame Zuordnung von Gemini-/HTTP-Fehlern für API-Routen (Analyze, Ersatz-Übung).
 */
export function geminiHttpErrorResponse(
  err: unknown,
  model: string,
): { status: number; body: GeminiRouteErrorBody } {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("429")
  ) {
    return {
      status: 429,
      body: {
        error: "API-Limit erreicht. Bitte später erneut versuchen.",
        code: "QUOTA",
      },
    };
  }

  if (lower.includes("api key") || lower.includes("401") || lower.includes("403")) {
    return {
      status: 401,
      body: {
        error: "Ungültiger oder abgelehnter API-Schlüssel.",
        code: "API_KEY",
      },
    };
  }

  if (lower.includes("not found") || lower.includes("404")) {
    return {
      status: 502,
      body: {
        error: `Modell "${model}" nicht gefunden. Prüfe GEMINI_MODEL in .env.local (z.B. gemini-2.5-pro oder gemini-2.5-flash).`,
        code: "MODEL_NOT_FOUND",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: message || "Unbekannter Serverfehler.",
      code: "INTERNAL",
    },
  };
}

import type { GoogleGenAI } from "@google/genai";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("503") ||
    m.includes("resource_exhausted") ||
    m.includes("unavailable") ||
    m.includes("econnreset")
  );
}

type GenerateArgs = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

export async function generateContentWithRetry(
  ai: GoogleGenAI,
  args: GenerateArgs,
  maxAttempts = 3,
): Promise<Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>> {
  let last: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(args);
    } catch (e) {
      last = e;
      if (!isRetryableGeminiError(e) || attempt === maxAttempts - 1) {
        throw e;
      }
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw last;
}

import type { GoogleGenAI } from "@google/genai";
import { createUserContent, type Part } from "@google/genai";

import { generateContentWithRetry } from "@/lib/gemini-retry";
import { WORKOUT_RESPONSE_JSON_SCHEMA } from "@/lib/workout-response-json-schema";

type GenResult = Awaited<
  ReturnType<GoogleGenAI["models"]["generateContent"]>
>;

function shouldRetryWithoutJsonSchema(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("json_schema") ||
    msg.includes("responsejsonschema") ||
    msg.includes("response_schema") ||
    msg.includes("invalid json schema") ||
    msg.includes("schema validation") ||
    (msg.includes("invalid_argument") && msg.includes("schema"))
  );
}

/**
 * Ruft Gemini mit strukturiertem JSON-Schema auf; bei Schema-bezogenem Fehler einmal ohne Schema.
 */
export async function generateWorkoutAnalysisContent(
  ai: GoogleGenAI,
  model: string,
  parts: Part[],
  userFollowup: string,
  systemPrompt: string,
): Promise<GenResult> {
  const responseJsonSchema = JSON.parse(
    JSON.stringify(WORKOUT_RESPONSE_JSON_SCHEMA),
  ) as Record<string, unknown>;

  const baseConfig = {
    systemInstruction: systemPrompt,
    responseMimeType: "application/json" as const,
    temperature: 0.15,
    maxOutputTokens: 8192,
  };

  const contents = createUserContent([...parts, userFollowup]);

  try {
    return await generateContentWithRetry(ai, {
      model,
      contents,
      config: {
        ...baseConfig,
        responseJsonSchema,
      },
    });
  } catch (first: unknown) {
    if (!shouldRetryWithoutJsonSchema(first)) {
      throw first;
    }
    return generateContentWithRetry(ai, {
      model,
      contents,
      config: baseConfig,
    });
  }
}

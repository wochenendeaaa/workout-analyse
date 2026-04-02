import type { GoogleGenAI } from "@google/genai";
import { createUserContent } from "@google/genai";

import { generateContentWithRetry } from "@/lib/gemini-retry";
import { EXERCISE_REPLACEMENT_JSON_SCHEMA } from "@/lib/exercise-replacement-json-schema";

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

export async function generateExerciseReplacementContent(
  ai: GoogleGenAI,
  model: string,
  userPrompt: string,
  systemPrompt: string,
): Promise<GenResult> {
  const responseJsonSchema = JSON.parse(
    JSON.stringify(EXERCISE_REPLACEMENT_JSON_SCHEMA),
  ) as Record<string, unknown>;

  const baseConfig = {
    systemInstruction: systemPrompt,
    responseMimeType: "application/json" as const,
    temperature: 0.2,
    maxOutputTokens: 2048,
  };

  const contents = createUserContent([userPrompt]);

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

/**
 * JSON Schema für Gemini `responseJsonSchema` (Teilmenge laut Google API).
 * @see https://ai.google.dev/gemini-api/docs/structured-output
 */
export const WORKOUT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    extracted_data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                sets: { type: "string" },
                reps: { type: "string" },
                weight: { type: "string" },
              },
              required: ["name", "sets", "reps", "weight"],
            },
          },
        },
        required: ["date", "exercises"],
      },
    },
    progressive_overload_analysis: { type: "string" },
    coach_tips: {
      type: "array",
      items: { type: "string" },
    },
    alternative_exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          alternative: { type: "string" },
          reason: { type: "string" },
        },
        required: ["original", "alternative", "reason"],
      },
    },
    next_session_prescription: {
      type: "array",
      items: {
        type: "object",
        properties: {
          exercise_name: { type: "string" },
          target_sets: { type: "string" },
          target_reps: { type: "string" },
          suggested_weight: { type: "string" },
          rationale: { type: "string" },
        },
        required: [
          "exercise_name",
          "target_sets",
          "target_reps",
          "suggested_weight",
          "rationale",
        ],
      },
    },
    coach_big_picture: {
      type: "object",
      properties: {
        headline: { type: "string" },
        watch_outs: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["headline", "watch_outs"],
    },
  },
  required: [
    "extracted_data",
    "progressive_overload_analysis",
    "coach_tips",
    "alternative_exercises",
    "next_session_prescription",
    "coach_big_picture",
  ],
} as const;

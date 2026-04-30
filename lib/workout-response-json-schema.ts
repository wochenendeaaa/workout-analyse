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
    coach_followup: {
      type: "object",
      properties: {
        required: { type: "boolean" },
        reason: { type: "string" },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              prompt: { type: "string" },
              kind: { type: "string" },
              choices: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["id", "prompt", "kind"],
          },
        },
      },
      required: ["required", "reason", "questions"],
    },
    post_workout_debrief: {
      type: "object",
      properties: {
        session_effort_1_10: { type: "number" },
        pain_notes: { type: "string" },
        recovery_flags: { type: "string" },
        free_note: { type: "string" },
      },
      required: [
        "session_effort_1_10",
        "pain_notes",
        "recovery_flags",
        "free_note",
      ],
    },
    tomorrow_plan: {
      type: "object",
      properties: {
        status: { type: "string" },
        summary: { type: "string" },
        top_priorities: { type: "array", items: { type: "string" } },
        caution_flags: { type: "array", items: { type: "string" } },
      },
      required: ["status", "summary", "top_priorities", "caution_flags"],
    },
  },
  required: [
    "extracted_data",
    "progressive_overload_analysis",
    "coach_tips",
    "alternative_exercises",
    "next_session_prescription",
    "coach_big_picture",
    "coach_followup",
    "post_workout_debrief",
    "tomorrow_plan",
  ],
} as const;

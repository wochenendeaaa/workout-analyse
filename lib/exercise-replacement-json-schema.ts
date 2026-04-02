/** JSON-Schema für Gemini: einzelner Ersatz für eine Übung. */
export const EXERCISE_REPLACEMENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    alternative_exercise: { type: "string" },
    why_it_fits: { type: "string" },
    execution_tip: { type: "string" },
    prescription_hint: { type: "string" },
  },
  required: ["alternative_exercise", "why_it_fits", "execution_tip", "prescription_hint"],
} as const;

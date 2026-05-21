import { describe, expect, it } from "vitest";
import { parseAnalysisJson } from "@/lib/parse-analysis-json";
import session1 from "./fixtures/session-1.json";
import session2 from "./fixtures/session-2.json";
import session3 from "./fixtures/session-3.json";

describe("parser golden tests", () => {
  it("parses session-1 and produces stable output", () => {
    const raw = JSON.stringify(session1);
    const result = parseAnalysisJson(raw);

    expect(result.extracted_data).toHaveLength(1);
    expect(result.extracted_data[0].date).toBe("2024-03-15");
    expect(result.extracted_data[0].exercises).toHaveLength(3);
    expect(result.extracted_data[0].exercises[0].name).toBe("Bankdrücken");
    expect(result.extracted_data[0].exercises[0].weight).toBe("100 kg");
    expect(result.coach_followup?.required).toBe(false);
    expect(result.tomorrow_plan?.status).toBe("as_planned");
  });

  it("parses session-2 and produces stable output", () => {
    const raw = JSON.stringify(session2);
    const result = parseAnalysisJson(raw);

    expect(result.extracted_data[0].exercises).toHaveLength(3);
    expect(result.extracted_data[0].exercises[1].name).toBe("Kreuzheben");
    expect(result.next_session_prescription).toHaveLength(2);
    expect(result.next_session_prescription[0].exercise_name).toBe("Kniebeuge");
  });

  it("parses session-3 with comma-decimal weight", () => {
    const raw = JSON.stringify(session3);
    const result = parseAnalysisJson(raw);

    const bench = result.extracted_data[0].exercises[0];
    expect(bench.weight).toBe("102,5 kg");
    expect(result.coach_followup?.required).toBe(true);
    expect(result.coach_followup?.questions).toHaveLength(1);
  });

  it("strips markdown fences if present", () => {
    const fenced = "```json\n" + JSON.stringify(session1) + "\n```";
    const result = parseAnalysisJson(fenced);
    expect(result.extracted_data).toHaveLength(1);
  });

  it("throws MODEL_JSON_PARSE on invalid JSON", () => {
    expect(() => parseAnalysisJson("{bad json")).toThrow("MODEL_JSON_PARSE");
  });

  it("throws MODEL_JSON_SHAPE on wrong schema", () => {
    expect(() => parseAnalysisJson('{"extracted_data": "not an array"}')).toThrow("MODEL_JSON_SHAPE");
  });
});

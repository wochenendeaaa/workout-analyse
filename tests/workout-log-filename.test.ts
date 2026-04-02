import { describe, expect, it } from "vitest";

import { buildWorkoutLogPdfFilename } from "@/lib/workout-log-filename";

describe("buildWorkoutLogPdfFilename", () => {
  it("ends with .pdf and uses Berlin date parts", () => {
    const d = new Date("2026-04-02T12:00:00.000Z");
    const name = buildWorkoutLogPdfFilename(d);
    expect(name.endsWith(".pdf")).toBe(true);
    expect(name).toMatch(/^New-Trainingplan-starting-/);
    expect(name).toContain("2026");
  });
});

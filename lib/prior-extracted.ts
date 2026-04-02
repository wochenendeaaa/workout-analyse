import { extractedDaySchema } from "@/lib/analysis-zod";
import type { ExtractedDay } from "@/lib/types/analysis";
import { z } from "zod";

/** Private use: genug für viele Wochen Training; schützt Request-Größe. */
export const MAX_PRIOR_EXTRACTED_DAYS = 80;

const MAX_JSON_CHARS = 500_000;

/**
 * Parst optional mitgelieferte frühere Trainingstage (vom Client, localStorage/Session).
 * Ungültiges JSON → leeres Array (Analyse läuft wie ohne Stack).
 * Zu viele Tage → nur die letzten MAX_PRIOR_EXTRACTED_DAYS (jüngste Historie).
 */
export function parsePriorExtractedField(raw: unknown): ExtractedDay[] {
  if (raw == null) return [];
  const str = typeof raw === "string" ? raw.trim() : "";
  if (!str || str.length > MAX_JSON_CHARS) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(str) as unknown;
  } catch {
    return [];
  }
  const out = z.array(extractedDaySchema).safeParse(parsed);
  if (!out.success) return [];
  return out.data.slice(-MAX_PRIOR_EXTRACTED_DAYS);
}

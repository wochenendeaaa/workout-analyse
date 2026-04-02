import { z } from "zod";

import { isValidPresetId, labelForPresetId } from "@/lib/gym-equipment-presets";

export const EQUIPMENT_CONTEXT_MAX_JSON = 4000;

const payloadSchema = z.object({
  presetIds: z.array(z.string()).max(32).optional().default([]),
  notes: z.string().max(2000).optional().default(""),
});

export type EquipmentContextPayload = z.infer<typeof payloadSchema>;

export const EQUIPMENT_LOCAL_STORAGE_KEY = "workout-gym-equipment-v1";

/** Client: localStorage / Props – toleriert alte oder kaputte Werte. */
export function parseEquipmentPayloadLoose(raw: unknown): EquipmentContextPayload {
  const r = payloadSchema.safeParse(raw);
  if (!r.success) return { presetIds: [], notes: "" };
  return r.data;
}

/** Client → FormData-Feld `equipment_context`. */
export function stringifyEquipmentPayload(payload: EquipmentContextPayload): string {
  const safe = payloadSchema.parse(payload);
  return JSON.stringify(safe);
}

/**
 * FormData-Wert parsen und als Fließtext für den System-Prompt formatieren.
 */
export function parseEquipmentContextField(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > EQUIPMENT_CONTEXT_MAX_JSON) return null;
  try {
    const json: unknown = JSON.parse(trimmed);
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) return null;
    const text = buildEquipmentNarrative(parsed.data);
    return text.trim() ? text : null;
  } catch {
    const plain = trimmed.length > 2000 ? trimmed.slice(0, 2000) : trimmed;
    return plain.trim() ? plain : null;
  }
}

export function buildEquipmentNarrative(data: EquipmentContextPayload): string {
  const ids = (data.presetIds ?? []).filter(isValidPresetId);
  const unique = [...new Set(ids)];
  const lines: string[] = [];
  if (unique.length > 0) {
    lines.push("Ausgewählte Ausstattung:");
    for (const id of unique) {
      const label = labelForPresetId(id);
      if (label) lines.push(`- ${label}`);
    }
  }
  const notes = (data.notes ?? "").trim();
  if (notes) {
    if (lines.length) lines.push("");
    lines.push("Zusätzliche Angaben (Gewichte, Hersteller, Raum, Einschränkungen):");
    lines.push(notes);
  }
  const text = lines.join("\n").trim();
  return text || "";
}

export function buildWorkoutSystemPrompt(
  basePrompt: string,
  equipmentNarrative: string | null,
): string {
  if (!equipmentNarrative?.trim()) {
    return basePrompt;
  }
  return `${basePrompt}

---

Kontext – verfügbare Trainingsausstattung des Nutzers:
${equipmentNarrative.trim()}

Wichtig für Aufgabe 3 (Tipps), Aufgabe 4 (Alternativübungen) und Aufgabe 5 (next_session_prescription):
- Schlage nur Übungen vor, die mit dieser Ausstattung realistisch umsetzbar sind, oder erkläre knapp, welches zusätzliche Equipment nötig wäre.
- Bei Kurzhanteln oder Scheiben: wenn der Nutzer Gewichte angegeben hat, respektiere diese Grenzen.
- Wenn das PDF Übungen zeigt, die mit dem Inventar nicht machbar sind, benenne das in den Tipps oder bei den Alternativen transparent.
- Bei Aufgabe 5: schlage nur Gewichte und Übungen vor, die mit der genannten Ausstattung umsetzbar sind (z. B. keine Langhantel-Last, wenn keine Langhantel vorhanden).`;
}

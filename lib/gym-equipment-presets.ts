/** Vordefinierte Ausstattung (IDs stabil für Speicherung / API). */
export const GYM_EQUIPMENT_PRESETS = [
  { id: "power_rack", label: "Power Rack / Squat Rack mit Langhantel" },
  { id: "adjustable_bench", label: "Verstellbare Hantelbank" },
  { id: "flat_bench", label: "Flache Bank" },
  { id: "dumbbells", label: "Kurzhanteln (Gewichtsbereich ggf. unten ergänzen)" },
  { id: "barbell_plates", label: "Langhantel + Hantelscheiben" },
  { id: "cable_machine", label: "Kabelzug / Latzug" },
  { id: "pullup_bar", label: "Klimmzugstange" },
  { id: "resistance_bands", label: "Widerstandsbänder" },
  { id: "kettlebells", label: "Kettlebells" },
  { id: "smith_machine", label: "Multipresse / Smith-Machine" },
  { id: "leg_press", label: "Beinpresse" },
  { id: "leg_curl_extension", label: "Beinbeuger / Beinstrecker (Maschine)" },
  { id: "cardio_treadmill", label: "Laufband" },
  { id: "cardio_bike", label: "Ergometer / Heimtrainer" },
  { id: "foam_roller", label: "Foam Roller / Mobility-Tools" },
  { id: "home_minimal", label: "Nur Körpergewicht / wenig Platz" },
] as const;

export type GymEquipmentPresetId = (typeof GYM_EQUIPMENT_PRESETS)[number]["id"];

const ALLOWED = new Set(
  GYM_EQUIPMENT_PRESETS.map((p) => p.id as string),
);

export function isValidPresetId(id: string): id is GymEquipmentPresetId {
  return ALLOWED.has(id);
}

export function labelForPresetId(id: string): string | undefined {
  return GYM_EQUIPMENT_PRESETS.find((p) => p.id === id)?.label;
}

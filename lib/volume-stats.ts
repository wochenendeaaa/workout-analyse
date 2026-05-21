import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

function parseLooseInt(s: string): number {
  const m = String(s).replace(",", ".").match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

/** Erste Zahl in der Gewichtszeichenkette als kg (heuristisch). Konvertiert lbs automatisch. */
export function parseWeightKg(s: string): number | null {
  const str = String(s).replace(",", ".");
  const lbs = /(\d+(?:\.\d+)?)\s*(?:lbs?|lb\.?|pounds?)/i.exec(str);
  if (lbs) {
    const v = parseFloat(lbs[1]) * 0.453592;
    return Math.round(v * 10) / 10;
  }
  const m = /(\d+(?:\.\d+)?)/.exec(str);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Grobe Trainingsvolumen-Schätzung: Summe (Sätze × Wdh. × Gewicht) pro Übung.
 * Nur Zeilen mit parsbarem Gewicht und >0 Sätze/Wdh.
 */
export function aggregateVolumeByExercise(
  data: WorkoutAnalysisResult,
): { name: string; volume: number }[] {
  const map = new Map<string, number>();
  for (const day of data.extracted_data) {
    for (const ex of day.exercises) {
      const sets = parseLooseInt(ex.sets);
      const reps = parseLooseInt(ex.reps);
      const w = parseWeightKg(ex.weight);
      if (w == null || sets <= 0 || reps <= 0) continue;
      const v = sets * reps * w;
      const key = (ex.name || "").trim() || "Unbenannt";
      map.set(key, (map.get(key) ?? 0) + v);
    }
  }
  return [...map.entries()]
    .map(([name, volume]) => ({ name, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 14);
}

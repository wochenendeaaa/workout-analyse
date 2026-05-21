export interface VolumeSession {
  date: string;
  exercises: {
    name: string;
    sets: number;
    reps: number | null;
    weightKg: number | null;
  }[];
}

export interface WeeklyVolumePoint {
  /** ISO date string of the Monday starting that week. */
  weekStart: string;
  muscleGroup: string;
  tonnageKg: number;
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Computes total tonnage (sets × reps × weight) per muscle group per week.
 *
 * @param sessions   Chronologically ordered session list.
 * @param groupMap   exerciseName (lowercase) → muscleGroup. Unrecognized exercises → "other".
 */
export function weeklyVolume(
  sessions: VolumeSession[],
  groupMap: Map<string, string>,
): WeeklyVolumePoint[] {
  // week+group → total tonnage
  const acc = new Map<string, number>();

  for (const s of sessions) {
    const week = mondayOf(s.date);
    for (const ex of s.exercises) {
      if (!ex.weightKg || ex.weightKg <= 0 || !ex.reps || ex.reps <= 0) continue;
      const group = groupMap.get(ex.name.toLowerCase()) ?? "other";
      const key = `${week}|${group}`;
      const tonnage = ex.sets * ex.reps * ex.weightKg;
      acc.set(key, (acc.get(key) ?? 0) + tonnage);
    }
  }

  return [...acc.entries()]
    .map(([key, tonnageKg]) => {
      const [weekStart, muscleGroup] = key.split("|");
      return { weekStart, muscleGroup, tonnageKg: Math.round(tonnageKg * 10) / 10 };
    })
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

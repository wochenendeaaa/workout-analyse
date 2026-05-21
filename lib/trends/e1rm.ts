/** Epley formula: 1RM ≈ w × (1 + r/30) */
export function epley(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Brzycki formula: 1RM ≈ w × 36 / (37 - r) */
export function brzycki(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  if (reps >= 37) return 0;
  return weightKg * (36 / (37 - reps));
}

/** Returns the higher of Epley and Brzycki, rounded to 1 decimal. */
export function bestE1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  const val = Math.max(epley(weightKg, reps), brzycki(weightKg, reps));
  return Math.round(val * 10) / 10;
}

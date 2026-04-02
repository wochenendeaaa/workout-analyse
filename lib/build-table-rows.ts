import type { WorkoutAnalysisResult } from "@/lib/types/analysis";

export type TableRowT = {
  date: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
};

export function buildTableRows(data: WorkoutAnalysisResult): TableRowT[] {
  return data.extracted_data.flatMap((day) =>
    day.exercises.length === 0
      ? [
          {
            date: day.date || "—",
            name: "—",
            sets: "—",
            reps: "—",
            weight: "—",
          },
        ]
      : day.exercises.map((ex) => ({
          date: day.date || "—",
          name: ex.name || "—",
          sets: ex.sets || "—",
          reps: ex.reps || "—",
          weight: ex.weight || "—",
        })),
  );
}

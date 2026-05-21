import { parseWeightKgStrict } from "@/lib/normalize-exercise";
import type { StoredAnalysis } from "@/lib/analysis-history";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface CompareRow {
  name: string;
  currentKg: number;
  prevKg: number;
  delta: number;
}

function findPrevWeight(name: string, history: StoredAnalysis[]): number | null {
  const needle = name.trim().toLowerCase();
  for (const entry of history) {
    for (const day of entry.result.extracted_data) {
      for (const ex of day.exercises) {
        if (ex.name.trim().toLowerCase() === needle) {
          return parseWeightKgStrict(ex.weight);
        }
      }
    }
  }
  return null;
}

interface Props {
  result: WorkoutAnalysisResult;
  history: StoredAnalysis[];
}

export function SessionCompareTable({ result, history }: Props) {
  const rows: CompareRow[] = [];
  const seen = new Set<string>();

  for (const day of result.extracted_data) {
    for (const ex of day.exercises) {
      const key = ex.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const currKg = parseWeightKgStrict(ex.weight);
      if (!currKg) continue;

      const prevKg = findPrevWeight(ex.name, history);
      if (!prevKg) continue;

      rows.push({ name: ex.name, currentKg: currKg, prevKg, delta: currKg - prevKg });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/30 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Diese Session vs. letzte Session
        </p>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm font-medium text-foreground truncate mr-4">{row.name}</span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground">{row.prevKg} kg</span>
              <span className="text-sm font-semibold text-foreground">{row.currentKg} kg</span>
              <span
                className={`flex items-center gap-0.5 text-xs font-semibold ${
                  row.delta > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : row.delta < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}
              >
                {row.delta > 0 ? (
                  <ArrowUp className="size-3" />
                ) : row.delta < 0 ? (
                  <ArrowDown className="size-3" />
                ) : (
                  <Minus className="size-3" />
                )}
                {row.delta > 0 ? "+" : ""}
                {row.delta !== 0 ? `${row.delta} kg` : "gleich"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

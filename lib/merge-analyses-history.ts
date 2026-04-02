import type { StoredAnalysis } from "@/lib/analysis-history";

/** Server- und lokale Einträge zusammenführen (neueste zuerst, keine doppelten IDs). */
export function mergeAnalysisHistories(
  server: StoredAnalysis[],
  local: StoredAnalysis[],
): StoredAnalysis[] {
  const seen = new Set<string>();
  const out: StoredAnalysis[] = [];
  for (const s of server) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  for (const l of local) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    out.push(l);
  }
  return out.sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}

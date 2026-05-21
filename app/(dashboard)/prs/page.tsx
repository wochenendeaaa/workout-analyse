"use client";

import { useEffect, useState } from "react";
import { loadHistory } from "@/lib/analysis-history";
import { bestE1RM } from "@/lib/trends/e1rm";
import { parseWeightKg } from "@/lib/volume-stats";

interface PREntry {
  name: string;
  bestWeightKg: number;
  bestE1rm: number;
}

function parseReps(raw: string): number {
  const range = /(\d+)\s*[-–]\s*\d+/.exec(String(raw));
  if (range) return parseInt(range[1], 10);
  const m = /(\d+)/.exec(String(raw));
  return m ? parseInt(m[1], 10) : 0;
}

export default function PRsPage() {
  const [prs, setPrs] = useState<PREntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const history = loadHistory();
      const map = new Map<string, { bestWeightKg: number; bestE1rm: number }>();

      for (const entry of history) {
        for (const day of entry.result.extracted_data) {
          for (const ex of day.exercises) {
            const name = ex.name.trim();
            if (!name) continue;
            const wKg = parseWeightKg(ex.weight);
            if (!wKg || wKg <= 0) continue;
            const reps = parseReps(ex.reps);
            const e1rm = reps > 0 ? bestE1RM(wKg, reps) : 0;
            const prev = map.get(name);
            if (!prev) {
              map.set(name, { bestWeightKg: wKg, bestE1rm: e1rm });
            } else {
              map.set(name, {
                bestWeightKg: Math.max(prev.bestWeightKg, wKg),
                bestE1rm: Math.max(prev.bestE1rm, e1rm),
              });
            }
          }
        }
      }

      const sorted = [...map.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.bestWeightKg - a.bestWeightKg);

      setPrs(sorted);
    } catch {
      setPrs([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        PRs / Rekorde
      </h1>

      {!loaded ? null : prs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <div className="mb-3 text-4xl">🏆</div>
          <p className="mb-1 font-semibold text-foreground">Noch keine Rekorde</p>
          <p className="mb-5 text-sm text-muted-foreground">
            Lade dein erstes Training hoch — wir erkennen automatisch deine persönlichen Bestleistungen.
          </p>
          <a
            href="/today"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Jetzt Training hochladen →
          </a>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {prs.map((pr) => (
            <div
              key={pr.name}
              className="rounded-xl border border-border bg-card px-5 py-4"
            >
              <p className="mb-3 font-semibold text-foreground">{pr.name}</p>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Bestes Gewicht</p>
                  <p className="text-lg font-bold text-foreground">
                    {pr.bestWeightKg} <span className="text-sm font-normal text-muted-foreground">kg</span>
                  </p>
                </div>
                {pr.bestE1rm > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Bestes e1RM</p>
                    <p className="text-lg font-bold text-foreground">
                      {pr.bestE1rm} <span className="text-sm font-normal text-muted-foreground">kg</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { loadHistory } from "@/lib/analysis-history";
import { suggestNextSession } from "@/lib/trends/suggest-next-session";
import type { ExerciseHistoryEntry, NextSessionSuggestion } from "@/lib/trends/suggest-next-session";
import { parseWeightKg } from "@/lib/volume-stats";

interface ExerciseSuggestion {
  name: string;
  suggestion: NextSessionSuggestion;
}

function parseReps(raw: string): number {
  const range = /(\d+)\s*[-–]\s*\d+/.exec(String(raw));
  if (range) return parseInt(range[1], 10);
  const m = /(\d+)/.exec(String(raw));
  return m ? parseInt(m[1], 10) : 0;
}

function parseSets(raw: string): number {
  const times = /(\d+)\s*[xX×]/.exec(String(raw));
  if (times) return parseInt(times[1], 10);
  const m = /(\d+)/.exec(String(raw));
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}

export default function NextPage() {
  const [suggestions, setSuggestions] = useState<ExerciseSuggestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const history = loadHistory();

      const exerciseHistoryMap = new Map<string, ExerciseHistoryEntry[]>();

      for (const entry of history) {
        for (const day of entry.result.extracted_data) {
          for (const ex of day.exercises) {
            const name = ex.name.trim();
            if (!name) continue;
            const weightKg = parseWeightKg(ex.weight);
            if (!weightKg || weightKg <= 0) continue;
            const reps = parseReps(ex.reps);
            if (reps <= 0) continue;
            const sets = parseSets(ex.sets);
            const histEntry: ExerciseHistoryEntry = {
              date: day.date,
              weightKg,
              reps,
              sets,
            };
            const existing = exerciseHistoryMap.get(name) ?? [];
            exerciseHistoryMap.set(name, [...existing, histEntry]);
          }
        }
      }

      const recentExerciseNames = new Set<string>();
      const sortedHistory = [...history].sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
      );
      let sessionCount = 0;
      for (const entry of sortedHistory) {
        if (sessionCount >= 3) break;
        for (const day of entry.result.extracted_data) {
          for (const ex of day.exercises) {
            const name = ex.name.trim();
            if (name) recentExerciseNames.add(name);
          }
        }
        sessionCount++;
      }

      const result: ExerciseSuggestion[] = [];
      for (const name of recentExerciseNames) {
        const entries = exerciseHistoryMap.get(name) ?? [];
        const uniqueDates = new Set(entries.map((e) => e.date));
        if (uniqueDates.size < 2) continue;
        const sorted = [...entries].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        const suggestion = suggestNextSession(sorted, "double_progression");
        result.push({ name, suggestion });
      }

      setSuggestions(result);
    } catch {
      setSuggestions([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Nächste Session
      </h1>

      {!loaded ? null : suggestions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <div className="mb-3 text-4xl">🎯</div>
          <p className="mb-1 font-semibold text-foreground">Noch keine Vorschläge</p>
          <p className="mb-5 text-sm text-muted-foreground">
            Analysiere mindestens zwei Trainings mit denselben Übungen — dann berechnen wir automatisch dein nächstes Zielgewicht.
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
          {suggestions.map(({ name, suggestion }) => (
            <div
              key={name}
              className={`rounded-xl border bg-card px-5 py-4 ${
                suggestion.deloadFlag
                  ? "border-amber-500/40"
                  : "border-border"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">{name}</p>
                {suggestion.deloadFlag && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Deload
                  </span>
                )}
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Gewicht</p>
                  <p className="text-lg font-bold text-foreground">
                    {suggestion.targetWeightKg}{" "}
                    <span className="text-sm font-normal text-muted-foreground">kg</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sätze × Wdh.</p>
                  <p className="text-lg font-bold text-foreground">
                    {suggestion.targetSets} × {suggestion.targetReps}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{suggestion.rationale}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

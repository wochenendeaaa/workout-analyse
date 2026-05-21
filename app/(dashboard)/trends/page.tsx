"use client";

import { useEffect, useMemo, useState } from "react";
import { loadHistory } from "@/lib/analysis-history";
import { bestE1RM } from "@/lib/trends/e1rm";
import { parseWeightKg } from "@/lib/volume-stats";
import { LineChart } from "@/components/charts/line-chart";
import type { LineChartPoint } from "@/components/charts/line-chart";
import { BarChart, colorForGroup } from "@/components/charts/bar-chart";
import type { BarChartSeries } from "@/components/charts/bar-chart";

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

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function muscleGroupFor(name: string): string {
  const n = name.toLowerCase();
  if (/bench|bankdr/.test(n)) return "chest";
  if (/kniebeuge|squat|leg press|beinpresse/.test(n)) return "quads";
  if (/kreuzheben|deadlift|rdl|romanian/.test(n)) return "back";
  if (/schulter|overhead|ohp|military/.test(n)) return "shoulders";
  if (/rudern|row|latzug|pull.?up|klimmzug/.test(n)) return "back";
  if (/trizeps|tricep|dip/.test(n)) return "triceps";
  if (/bizeps|bicep|curl/.test(n)) return "biceps";
  if (/lunges|ausfallschritt|hamstring|leg curl/.test(n)) return "hamstrings";
  if (/wade|calf/.test(n)) return "calves";
  if (/plank|core|abs|bauch/.test(n)) return "core";
  if (/glute|hip thrust|po/.test(n)) return "glutes";
  return "other";
}

interface ExerciseE1rmPoint {
  date: string;
  e1rm: number;
}

interface AppData {
  exerciseNames: string[];
  e1rmByExercise: Map<string, ExerciseE1rmPoint[]>;
  barChartSeries: BarChartSeries[];
}

function buildAppData(): AppData {
  const history = loadHistory();

  const e1rmByExercise = new Map<string, ExerciseE1rmPoint[]>();
  const weekGroupTonnage = new Map<string, number>();

  for (const entry of history) {
    for (const day of entry.result.extracted_data) {
      const date = day.date;
      for (const ex of day.exercises) {
        const name = ex.name.trim();
        if (!name) continue;
        const wKg = parseWeightKg(ex.weight);
        if (!wKg || wKg <= 0) continue;

        const reps = parseReps(ex.reps);
        if (reps > 0) {
          const e1rm = bestE1RM(wKg, reps);
          if (e1rm > 0) {
            const prev = e1rmByExercise.get(name) ?? [];
            e1rmByExercise.set(name, [...prev, { date, e1rm }]);
          }
        }

        const sets = parseSets(ex.sets);
        if (reps > 0 && sets > 0) {
          const week = mondayOf(date);
          const group = muscleGroupFor(name);
          const key = `${week}|${group}`;
          const tonnage = sets * reps * wKg;
          weekGroupTonnage.set(key, (weekGroupTonnage.get(key) ?? 0) + tonnage);
        }
      }
    }
  }

  for (const [name, points] of e1rmByExercise) {
    const sorted = [...points].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const deduped: ExerciseE1rmPoint[] = [];
    for (const pt of sorted) {
      const last = deduped[deduped.length - 1];
      if (last && last.date === pt.date) {
        last.e1rm = Math.max(last.e1rm, pt.e1rm);
      } else {
        deduped.push({ ...pt });
      }
    }
    e1rmByExercise.set(name, deduped);
  }

  const exerciseNames = [...e1rmByExercise.keys()].sort((a, b) => a.localeCompare(b));

  const weekMap = new Map<string, Map<string, number>>();
  for (const [key, tonnage] of weekGroupTonnage) {
    const [week, group] = key.split("|");
    const groups = weekMap.get(week) ?? new Map<string, number>();
    groups.set(group, (groups.get(group) ?? 0) + tonnage);
    weekMap.set(week, groups);
  }

  const barChartSeries: BarChartSeries[] = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, groups]) => ({
      weekStart,
      segments: [...groups.entries()].map(([label, value]) => ({
        label,
        value: Math.round(value * 10) / 10,
        color: colorForGroup(label),
      })),
    }));

  return { exerciseNames, e1rmByExercise, barChartSeries };
}

export default function TrendsPage() {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const data = buildAppData();
      setAppData(data);
      if (data.exerciseNames.length > 0) {
        setSelectedExercise(data.exerciseNames[0]);
      }
    } catch {
      setAppData({ exerciseNames: [], e1rmByExercise: new Map(), barChartSeries: [] });
    } finally {
      setLoaded(true);
    }
  }, []);

  const lineChartData = useMemo((): LineChartPoint[] => {
    if (!appData || !selectedExercise) return [];
    const points = appData.e1rmByExercise.get(selectedExercise) ?? [];
    return points.map((p) => ({ date: p.date, value: p.e1rm }));
  }, [appData, selectedExercise]);

  const isEmpty = !appData || appData.exerciseNames.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Trends
      </h1>

      {!loaded ? null : isEmpty ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-muted-foreground">
            Keine Daten — analysiere zuerst ein Training.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="rounded-xl border border-border bg-card px-5 py-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-semibold text-foreground">e1RM Verlauf</h2>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {appData!.exerciseNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <LineChart data={lineChartData} unit="kg" height={220} />
          </section>

          <section className="rounded-xl border border-border bg-card px-5 py-5">
            <h2 className="mb-4 font-semibold text-foreground">Wöchentliches Volumen</h2>
            <BarChart data={appData!.barChartSeries} unit="kg" height={240} />
          </section>
        </div>
      )}
    </div>
  );
}

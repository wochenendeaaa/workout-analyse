"use client";

import { useState } from "react";

export interface BarChartSeries {
  weekStart: string;
  segments: { label: string; value: number; color: string }[];
}

interface Props {
  data: BarChartSeries[];
  unit?: string;
  height?: number;
}

const PAD = { top: 12, right: 16, bottom: 40, left: 52 };

const GROUP_COLORS: Record<string, string> = {
  chest: "#3b82f6",
  back: "#10b981",
  quads: "#f59e0b",
  hamstrings: "#f97316",
  shoulders: "#8b5cf6",
  triceps: "#ec4899",
  biceps: "#06b6d4",
  glutes: "#84cc16",
  calves: "#64748b",
  core: "#6366f1",
  cardio: "#14b8a6",
  other: "#94a3b8",
};

export function colorForGroup(group: string): string {
  return GROUP_COLORS[group.toLowerCase()] ?? "#94a3b8";
}

export function BarChart({ data, unit = "kg", height = 220 }: Props) {
  const [active, setActive] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        Keine Daten
      </div>
    );
  }

  const W = 600;
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const totals = data.map((d) => d.segments.reduce((s, seg) => s + seg.value, 0));
  const maxV = Math.max(...totals, 1);

  const barW = Math.min(innerW / data.length - 4, 60);
  const xOf = (i: number) => PAD.left + (i + 0.5) * (innerW / data.length);

  const yTicks = 4;

  // Unique groups across all weeks for legend
  const allGroups = [...new Set(data.flatMap((d) => d.segments.map((s) => s.label)))];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        aria-label="Wöchentliches Volumen"
      >
        {/* Y grid lines */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = (i / yTicks) * maxV;
          const y = PAD.top + (1 - i / yTicks) * innerH;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10}
                fill="currentColor" fillOpacity={0.5}>
                {v >= 1000 ? `${(v / 1000).toFixed(1)}t` : Math.round(v)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((week, i) => {
          const x = xOf(i);
          let stackY = PAD.top + innerH;

          return (
            <g key={week.weekStart}
              onMouseEnter={() => setActive(week.weekStart)}
              onMouseLeave={() => setActive(null)}
              className="cursor-pointer"
            >
              {week.segments.map((seg) => {
                const barH = (seg.value / maxV) * innerH;
                stackY -= barH;
                return (
                  <rect key={seg.label}
                    x={x - barW / 2} y={stackY}
                    width={barW} height={barH}
                    fill={seg.color} rx={i === 0 ? 0 : 0}
                  />
                );
              })}

              {/* Tooltip */}
              {active === week.weekStart && (
                <g>
                  <rect
                    x={Math.min(x - 40, W - PAD.right - 84)} y={PAD.top}
                    width={84} height={18} rx={4}
                    fill="#1e293b" fillOpacity={0.9}
                  />
                  <text
                    x={Math.min(x - 40, W - PAD.right - 84) + 42} y={PAD.top + 13}
                    textAnchor="middle" fontSize={10} fill="white"
                  >
                    {totals[i].toFixed(0)} {unit}
                  </text>
                </g>
              )}

              {/* X label */}
              <text x={x} y={H - 6} textAnchor="middle" fontSize={9}
                fill="currentColor" fillOpacity={0.5}>
                {week.weekStart.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      {allGroups.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1">
          {allGroups.map((g) => (
            <span key={g} className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: colorForGroup(g) }} />
              {g}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

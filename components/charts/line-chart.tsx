"use client";

import { useState } from "react";

export interface LineChartPoint {
  date: string;
  value: number;
}

interface Props {
  data: LineChartPoint[];
  unit?: string;
  color?: string;
  height?: number;
}

const PAD = { top: 12, right: 16, bottom: 32, left: 44 };

export function LineChart({ data, unit = "kg", color = "#3b82f6", height = 200 }: Props) {
  const [active, setActive] = useState<number | null>(null);

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

  const minV = Math.min(...data.map((d) => d.value));
  const maxV = Math.max(...data.map((d) => d.value));
  const rangeV = maxV - minV || 1;

  const xOf = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const yOf = (v: number) => PAD.top + (1 - (v - minV) / rangeV) * innerH;

  const points = data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(" ");

  const yTicks = 4;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    minV + (i / yTicks) * rangeV,
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height }}
      aria-label="e1RM Verlauf"
    >
      {/* Y grid lines + labels */}
      {yTickVals.map((v, i) => {
        const y = yOf(v);
        return (
          <g key={i}>
            <line
              x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="currentColor" strokeOpacity={0.08} strokeWidth={1}
            />
            <text
              x={PAD.left - 6} y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.5}
            >
              {Math.round(v)}
            </text>
          </g>
        );
      })}

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Area fill */}
      <polygon
        points={`${xOf(0)},${yOf(minV)} ${points} ${xOf(data.length - 1)},${yOf(minV)}`}
        fill={color}
        fillOpacity={0.08}
      />

      {/* Data points + X labels */}
      {data.map((d, i) => {
        const x = xOf(i);
        const y = yOf(d.value);
        const isActive = active === i;
        const showLabel = data.length <= 8 || i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0;

        return (
          <g key={i}>
            <circle
              cx={x} cy={y} r={isActive ? 6 : 4}
              fill={color}
              stroke="white" strokeWidth={2}
              className="cursor-pointer"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            />
            {isActive && (
              <g>
                <rect
                  x={Math.min(x - 32, W - PAD.right - 68)} y={y - 28}
                  width={68} height={20} rx={4}
                  fill="#1e293b" fillOpacity={0.9}
                />
                <text
                  x={Math.min(x - 32, W - PAD.right - 68) + 34} y={y - 14}
                  textAnchor="middle" fontSize={10} fill="white"
                >
                  {d.value.toFixed(1)} {unit}
                </text>
              </g>
            )}
            {showLabel && (
              <text
                x={x} y={H - 6}
                textAnchor="middle" fontSize={9}
                fill="currentColor" fillOpacity={0.5}
              >
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

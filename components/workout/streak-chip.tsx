"use client";

import type { StreakState } from "@/lib/trends/streak-local";
import { Flame } from "lucide-react";
import { useState } from "react";

interface StreakChipProps {
  streak: StreakState;
}

export function StreakChip({ streak }: StreakChipProps) {
  const [open, setOpen] = useState(false);

  if (streak.currentStreak === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100 dark:border-orange-600/50 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50"
        aria-label={`Streak: ${streak.currentStreak} Sessions`}
        aria-expanded={open}
      >
        <Flame className="size-4" />
        {streak.currentStreak}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-border bg-background p-3 shadow-lg">
            <p className="text-xs font-semibold text-foreground">Streak-Details</p>
            <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>Aktuell</dt>
                <dd className="font-medium text-foreground">{streak.currentStreak}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Rekord</dt>
                <dd className="font-medium text-foreground">{streak.longestStreak}</dd>
              </div>
              {streak.graceDaysUsed > 0 && (
                <div className="flex justify-between">
                  <dt>Grace genutzt</dt>
                  <dd className="font-medium text-foreground">{streak.graceDaysUsed}</dd>
                </div>
              )}
              {streak.lastSessionDate && (
                <div className="flex justify-between">
                  <dt>Letzte Session</dt>
                  <dd className="font-medium text-foreground">{streak.lastSessionDate}</dd>
                </div>
              )}
            </dl>
          </div>
        </>
      )}
    </div>
  );
}

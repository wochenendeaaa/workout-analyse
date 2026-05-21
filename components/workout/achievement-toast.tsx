"use client";

import { useEffect } from "react";

interface AchievementItem {
  id: string;
  title: string;
  icon: string;
  isNew: boolean;
}

interface Props {
  achievements: AchievementItem[];
  onDismiss: () => void;
}

export function AchievementToast({ achievements, onDismiss }: Props) {
  const newOnes = achievements.filter((a) => a.isNew);

  useEffect(() => {
    if (newOnes.length === 0) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [newOnes.length, onDismiss]);

  if (newOnes.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 flex flex-col gap-2">
      <div className="relative">
        <button
          onClick={onDismiss}
          className="absolute -top-1 -right-1 z-10 flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs"
          aria-label="Schließen"
        >
          ×
        </button>
        {newOnes.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-lg mb-2 last:mb-0"
          >
            <span className="text-2xl">{a.icon}</span>
            <div>
              <p className="text-xs font-semibold text-primary">Neuer Erfolg!</p>
              <p className="text-sm font-medium text-foreground">{a.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

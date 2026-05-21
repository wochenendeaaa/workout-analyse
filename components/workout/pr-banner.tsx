"use client";

import { ConfettiCanvas } from "@/components/confetti";
import type { DetectedPR } from "@/lib/trends/detect-prs-local";
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";

interface PrBannerProps {
  prs: DetectedPR[];
}

function formatPR(pr: DetectedPR): string {
  if (pr.prType === "weight") {
    return `${pr.exerciseName} ${pr.newValue} kg`;
  }
  return `${pr.exerciseName} e1RM ${pr.newValue} kg`;
}

export function PrBanner({ prs }: PrBannerProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (prs.length > 0) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(t);
    }
  }, [prs]);

  if (prs.length === 0) return null;

  const label =
    prs.length === 1
      ? `Neuer PR: ${formatPR(prs[0])}`
      : `${prs.length} neue PRs: ${prs.map(formatPR).join(" · ")}`;

  return (
    <>
      {showConfetti && <ConfettiCanvas />}
      <div
        role="status"
        aria-live="polite"
        className="mb-4 flex items-center gap-3 rounded-lg border border-amber-400/60 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-950/30"
      >
        <Trophy className="size-5 shrink-0 text-amber-500" />
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {label}
        </p>
      </div>
    </>
  );
}

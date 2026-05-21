"use client";

import { AuthBar } from "@/components/auth-bar";
import { EquipmentContextCard } from "@/components/workout/equipment-context-card";
import { ResultsSection } from "@/components/workout/results-section";
import { UploadSection } from "@/components/workout/upload-section";
import { userMessageForApiCode } from "@/lib/api-error-messages";
import {
  appendHistory,
  clearHistory,
  clearSessionSnapshot,
  loadHistory,
  loadSessionSnapshot,
  replaceLatestHistoryResult,
  saveSessionSnapshot,
  type StoredAnalysis,
} from "@/lib/analysis-history";
import {
  getClientMaxPdfBytes,
  getClientMaxPdfMbRounded,
} from "@/lib/client-upload-limit";
import {
  EQUIPMENT_LOCAL_STORAGE_KEY,
  parseEquipmentPayloadLoose,
  stringifyEquipmentPayload,
  type EquipmentContextPayload,
} from "@/lib/equipment-context";
import {
  ingestSessionsIntoCoachMemory,
  loadCoachMemoryLocal,
  loadCoachProfileLocal,
  saveCoachMemoryLocal,
  saveCoachProfileLocal,
} from "@/lib/coach-memory-local";
import { mergeAnalysisHistories } from "@/lib/merge-analyses-history";
import { MAX_PRIOR_EXTRACTED_DAYS } from "@/lib/prior-extracted";
import type {
  CoachMemoryLocal,
  CoachProfileLocal,
  WorkoutAnalysisResult,
} from "@/lib/types/analysis";
import { PrBanner } from "@/components/workout/pr-banner";
import { StreakChip } from "@/components/workout/streak-chip";
import {
  detectPRsFromLocalHistory,
  type DetectedPR,
} from "@/lib/trends/detect-prs-local";
import {
  computeStreakFromLocalHistory,
  type StreakState,
} from "@/lib/trends/streak-local";
import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_CLIENT_BYTES = getClientMaxPdfBytes();
const MAX_CLIENT_MB = getClientMaxPdfMbRounded();

type ApiErrorBody = {
  error: string;
  code?: string;
  rawPreview?: string;
  retryAfterSec?: number;
};

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorkoutAnalysisResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<StoredAnalysis[]>([]);
  const [equipment, setEquipment] = useState<EquipmentContextPayload>({
    presetIds: [],
    notes: "",
  });
  const [coachProfile, setCoachProfile] = useState<CoachProfileLocal>(
    loadCoachProfileLocal(),
  );
  const [coachMemory, setCoachMemory] = useState<CoachMemoryLocal>(
    loadCoachMemoryLocal(),
  );
  const [detectedPRs, setDetectedPRs] = useState<DetectedPR[]>([]);
  const [streak, setStreak] = useState<StreakState>({
    currentStreak: 0,
    longestStreak: 0,
    graceDaysUsed: 0,
    lastSessionDate: null,
  });

  const refreshMergedHistory = useCallback(async () => {
    const local = loadHistory();
    try {
      const res = await fetch("/api/analyses", { credentials: "same-origin" });
      const data: unknown = await res.json();
      const o = data as { enabled?: boolean; items?: StoredAnalysis[] };
      if (o.enabled && Array.isArray(o.items)) {
        setHistoryEntries(mergeAnalysisHistories(o.items, local));
      } else {
        setHistoryEntries(local);
      }
    } catch {
      setHistoryEntries(local);
    }
  }, []);

  const equipmentHydratedRef = useRef(false);

  useEffect(() => {
    setStreak(computeStreakFromLocalHistory(loadHistory()));
  }, []);

  useEffect(() => {
    const snap = loadSessionSnapshot();
    if (snap) {
      setResult(snap.result);
      setFileName(snap.fileName);
    }
    void refreshMergedHistory();
  }, [refreshMergedHistory]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EQUIPMENT_LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = parseEquipmentPayloadLoose(JSON.parse(raw) as unknown);
        setEquipment(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      saveCoachProfileLocal(coachProfile);
    } catch {
      /* ignore */
    }
  }, [coachProfile]);

  useEffect(() => {
    try {
      saveCoachMemoryLocal(coachMemory);
    } catch {
      /* ignore */
    }
  }, [coachMemory]);

  useEffect(() => {
    if (!equipmentHydratedRef.current) {
      equipmentHydratedRef.current = true;
      return;
    }
    try {
      localStorage.setItem(
        EQUIPMENT_LOCAL_STORAGE_KEY,
        JSON.stringify(equipment),
      );
    } catch {
      /* ignore */
    }
  }, [equipment]);

  const analyze = useCallback(
    async (file: File) => {
      const priorExtracted = (result?.extracted_data ?? []).slice(
        -MAX_PRIOR_EXTRACTED_DAYS,
      );
      setError(null);
      setResult(null);
      setFileName(file.name);

      if (file.type && file.type !== "application/pdf") {
        setError("Bitte nur PDF-Dateien hochladen.");
        return;
      }
      if (!file.type && !/\.pdf$/i.test(file.name)) {
        setError("Datei muss eine .pdf-Datei sein.");
        return;
      }
      if (file.size > MAX_CLIENT_BYTES) {
        setError(
          `Die Datei ist zu groß (max. ${MAX_CLIENT_MB} MB für dieses Setup).`,
        );
        return;
      }

      setLoading(true);
      try {
        const body = new FormData();
        body.append("file", file);
        body.append("equipment_context", stringifyEquipmentPayload(equipment));
        body.append("prior_extracted_data", JSON.stringify(priorExtracted));
        body.append("coach_profile_local", JSON.stringify(coachProfile));
        body.append("coach_memory_local", JSON.stringify(coachMemory));

        const res = await fetch("/api/analyze", {
          method: "POST",
          body,
        });

        const json = (await res.json()) as WorkoutAnalysisResult | ApiErrorBody;

        if (!res.ok) {
          const err = json as ApiErrorBody;
          setError(
            userMessageForApiCode(err.code, err.error, {
              retryAfterSec: err.retryAfterSec,
            }),
          );
          return;
        }

        const data = json as WorkoutAnalysisResult;
        setResult(data);
        setCoachMemory((prev) =>
          ingestSessionsIntoCoachMemory(prev, data.extracted_data),
        );

        // Detect PRs against localStorage before appending (so only prior sessions count)
        const currentHistory = loadHistory();
        const localPrs = detectPRsFromLocalHistory(data, currentHistory);
        setDetectedPRs(localPrs);

        appendHistory(file.name, data);
        saveSessionSnapshot(file.name, data);
        setStreak(computeStreakFromLocalHistory(loadHistory()));

        // Save to server (dual-write: blob + relational rows)
        const saveRes = await fetch("/api/analyses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, result: data }),
          credentials: "same-origin",
        }).catch(() => null);

        // If logged in, upgrade to SQL-backed PRs and streak
        if (saveRes?.ok) {
          const saveJson = await saveRes.json().catch(() => null) as { sessionId?: string } | null;
          if (saveJson?.sessionId) {
            const [prRes, streakRes] = await Promise.all([
              fetch("/api/prs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: saveJson.sessionId }),
                credentials: "same-origin",
              }).catch(() => null),
              fetch("/api/streak", { credentials: "same-origin" }).catch(() => null),
            ]);

            const prJson = await prRes?.json().catch(() => null) as { prs?: typeof localPrs } | null;
            if (prJson?.prs && prJson.prs.length > 0) {
              setDetectedPRs(prJson.prs);
            }

            const streakJson = await streakRes?.json().catch(() => null) as {
              enabled?: boolean;
              currentStreak?: number;
              longestStreak?: number;
              graceDaysUsed?: number;
              lastSessionDate?: string | null;
            } | null;
            if (streakJson?.enabled) {
              setStreak({
                currentStreak: streakJson.currentStreak ?? 0,
                longestStreak: streakJson.longestStreak ?? 0,
                graceDaysUsed: streakJson.graceDaysUsed ?? 0,
                lastSessionDate: streakJson.lastSessionDate ?? null,
              });
            }
          }
        }

        await refreshMergedHistory();
      } catch {
        setError("Netzwerkfehler oder Server nicht erreichbar.");
      } finally {
        setLoading(false);
      }
    },
    [coachMemory, coachProfile, equipment, refreshMergedHistory, result],
  );

  const restoreHistoryEntry = useCallback((entry: StoredAnalysis) => {
    setResult(entry.result);
    setFileName(entry.fileName);
    setError(null);
    saveSessionSnapshot(entry.fileName, entry.result);
  }, []);

  const startNewAnalysis = useCallback(() => {
    setResult(null);
    setError(null);
    setFileName(null);
    setDetectedPRs([]);
    clearSessionSnapshot();
  }, []);

  const clearAllHistory = useCallback(async () => {
    clearHistory();
    await fetch("/api/analyses", { method: "DELETE", credentials: "same-origin" }).catch(
      () => {},
    );
    await refreshMergedHistory();
  }, [refreshMergedHistory]);

  const updateAnalysisResult = useCallback(
    (next: WorkoutAnalysisResult) => {
      setResult(next);
      setCoachMemory((prev) =>
        ingestSessionsIntoCoachMemory(prev, [], next.post_workout_debrief),
      );
      if (fileName) {
        replaceLatestHistoryResult(fileName, next);
        saveSessionSnapshot(fileName, next);
      }
      void refreshMergedHistory();
    },
    [fileName, refreshMergedHistory],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void analyze(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void analyze(f);
  };

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Zum Inhalt springen
      </a>
      <header className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <div className="mb-8 text-center sm:text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
                Workout Coach
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Trainingsplan aus PDF verstehen
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Upload, Coach-Insight, nächste Session.
              </p>
            </div>
            <StreakChip streak={streak} />
          </div>
        </div>
      </header>

      <main id="content" className="mx-auto min-h-screen max-w-5xl px-4 pb-10 sm:px-6">
      <details className="mb-5 rounded-lg border border-border/80 bg-muted/10 p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          Mehr Einstellungen
        </summary>
        <div className="mt-3 space-y-4">
          <AuthBar className="mb-0" onAuthChange={() => void refreshMergedHistory()} />
          <EquipmentContextCard
            value={equipment}
            onChange={setEquipment}
            disabled={loading}
            compact
          />
        </div>
      </details>

      <UploadSection
        maxClientMb={MAX_CLIENT_MB}
        vercelHint={MAX_CLIENT_MB <= 4}
        compact
        loading={loading}
        error={error}
        fileName={fileName}
        dragActive={dragActive}
        setDragActive={setDragActive}
        inputRef={inputRef}
        historyEntries={historyEntries}
        onRestoreHistory={restoreHistoryEntry}
        onClearAllHistory={clearAllHistory}
        onDrop={onDrop}
        onInputChange={onInputChange}
        onPickClick={() => inputRef.current?.click()}
        onNewAnalysis={startNewAnalysis}
        showNewAnalysis={!!result}
      />

      {result ? (
        <ResultsSection
          result={result}
          equipmentContextJson={stringifyEquipmentPayload(equipment)}
          compact
          coachProfile={coachProfile}
          coachMemory={coachMemory}
          onCoachProfileChange={setCoachProfile}
          onCoachMemoryChange={setCoachMemory}
          onAnalysisUpdate={updateAnalysisResult}
          detectedPRs={detectedPRs}
        />
      ) : null}
      </main>
    </>
  );
}

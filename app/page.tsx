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
import { mergeAnalysisHistories } from "@/lib/merge-analyses-history";
import { MAX_PRIOR_EXTRACTED_DAYS } from "@/lib/prior-extracted";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";
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
        appendHistory(file.name, data);
        saveSessionSnapshot(file.name, data);

        await fetch("/api/analyses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, result: data }),
        }).catch(() => {});

        await refreshMergedHistory();
      } catch {
        setError("Netzwerkfehler oder Server nicht erreichbar.");
      } finally {
        setLoading(false);
      }
    },
    [equipment, refreshMergedHistory, result],
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
      if (fileName) {
        saveSessionSnapshot(fileName, next);
      }
    },
    [fileName],
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
      <header className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <div className="mb-10 text-center sm:text-left">
          <p className="mb-1 text-sm font-medium text-primary">Workout-Analyse</p>
          <p className="text-sm text-muted-foreground">Persönlich · Handschrift-PDF</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Trainingsplan aus PDF verstehen
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            PDF hochladen → nächste Session planen, Log-PDF erzeugen, bei Bedarf
            einzelne Übungen ersetzen.
          </p>
        </div>
      </header>

      <main id="content" className="mx-auto min-h-screen max-w-5xl px-4 pb-10 sm:px-6">
      <AuthBar className="mb-8" onAuthChange={() => void refreshMergedHistory()} />

      <EquipmentContextCard
        value={equipment}
        onChange={setEquipment}
        disabled={loading}
      />

      <UploadSection
        maxClientMb={MAX_CLIENT_MB}
        vercelHint={MAX_CLIENT_MB <= 4}
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
          onAnalysisUpdate={updateAnalysisResult}
        />
      ) : null}
      </main>
    </>
  );
}

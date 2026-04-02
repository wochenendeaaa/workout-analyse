"use client";

import { Button } from "@/components/ui/button";
import type { StoredAnalysis } from "@/lib/analysis-history";
import { History } from "lucide-react";

type Props = {
  entries: StoredAnalysis[];
  onRestore: (entry: StoredAnalysis) => void;
  onClearAll: () => void | Promise<void>;
};

export function HistoryBar({ entries, onRestore, onClearAll }: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <History className="size-4 shrink-0 text-muted-foreground" />
        <label htmlFor="history-select" className="sr-only">
          Frühere Analyse aus Verlauf laden
        </label>
        <select
          id="history-select"
          className="h-9 max-w-full flex-1 rounded-md border border-input bg-background px-2 text-sm"
          defaultValue=""
          onChange={(e) => {
            const id = e.target.value;
            const entry = entries.find((h) => h.id === id);
            if (entry) onRestore(entry);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Frühere Analyse laden …
          </option>
          {entries.map((h) => (
            <option key={h.id} value={h.id}>
              {new Date(h.savedAt).toLocaleString("de-DE", {
                dateStyle: "short",
                timeStyle: "short",
              })}{" "}
              — {h.fileName ?? "Ohne Dateiname"}
              {h.id.startsWith("db-") ? " (Server)" : ""}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => void onClearAll()}
      >
        Verlauf leeren
      </Button>
    </div>
  );
}

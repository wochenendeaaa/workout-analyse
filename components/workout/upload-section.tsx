"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StoredAnalysis } from "@/lib/analysis-history";
import { cn } from "@/lib/utils";
import { HistoryBar } from "@/components/workout/history-bar";
import { Loader2, RotateCcw, Upload } from "lucide-react";
import type { RefObject } from "react";

type Props = {
  maxClientMb: number;
  vercelHint: boolean;
  compact?: boolean;
  loading: boolean;
  error: string | null;
  fileName: string | null;
  dragActive: boolean;
  setDragActive: (v: boolean) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  historyEntries: StoredAnalysis[];
  onRestoreHistory: (entry: StoredAnalysis) => void;
  onClearAllHistory: () => void | Promise<void>;
  onDrop: (e: React.DragEvent) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPickClick: () => void;
  onNewAnalysis: () => void;
  showNewAnalysis: boolean;
};

export function UploadSection({
  maxClientMb,
  vercelHint,
  compact,
  loading,
  error,
  fileName,
  dragActive,
  setDragActive,
  inputRef,
  historyEntries,
  onRestoreHistory,
  onClearAllHistory,
  onDrop,
  onInputChange,
  onPickClick,
  onNewAnalysis,
  showNewAnalysis,
}: Props) {
  return (
    <Card className="mb-8 overflow-hidden border-border/80">
      <CardHeader>
        <CardTitle
          id="pdf-upload-title"
          className="flex items-center gap-2 text-lg"
        >
          <Upload className="size-5 text-primary/90" />
          PDF hochladen
        </CardTitle>
        <CardDescription className="text-sm">
          {compact ? (
            <>
              Nur PDF, max. {maxClientMb} MB
              {vercelHint ? " (Vercel-kompatibel)" : ""}. Neue Uploads werden zur
              offenen Analyse hinzugefügt.
            </>
          ) : (
            <>
              Drag & Drop oder Datei wählen — nur PDF, max. {maxClientMb} MB
              {vercelHint ? " (Vercel-kompatibel)" : ""}. Solange du eine Analyse offen
              hast, gilt jedes neue PDF als <strong>eine zusätzliche</strong> Session; die
              Tabelle wächst kumulativ (lokal in diesem Browser). „Neue Analyse“ startet
              ohne vorherige Einträge.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <HistoryBar
          entries={historyEntries}
          onRestore={onRestoreHistory}
          onClearAll={onClearAllHistory}
        />

        <div
          role="button"
          tabIndex={0}
          id="pdf-dropzone"
          aria-labelledby="pdf-upload-title"
          aria-busy={loading}
          aria-disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!loading) onPickClick();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className={cn(
            "flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            dragActive
              ? "border-primary bg-accent/50"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40",
            loading && "pointer-events-none opacity-70",
          )}
          onClick={() => !loading && onPickClick()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="PDF-Datei auswählen"
            onChange={onInputChange}
            disabled={loading}
          />
          {loading ? (
            <>
              <Loader2
                className="mb-3 size-10 animate-spin text-primary"
                aria-hidden
              />
              <p className="text-center font-medium">Analyse läuft …</p>
              <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground">
                PDF wird an Gemini gesendet. Handschrift und Dateigröße können die
                Dauer beeinflussen (oft 30 Sekunden bis wenige Minuten).
              </p>
            </>
          ) : (
            <>
              <Upload className="mb-3 size-10 text-muted-foreground" aria-hidden />
              <p className="text-center font-medium">
                PDF hier ablegen oder klicken zum Auswählen
              </p>
              {fileName ? (
                <p className="mt-2 text-sm text-muted-foreground">{fileName}</p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={onPickClick}>
            Datei wählen
          </Button>
          {showNewAnalysis ? (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={onNewAnalysis}
            >
              <RotateCcw className="size-4" aria-hidden />
              Neue Analyse
            </Button>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

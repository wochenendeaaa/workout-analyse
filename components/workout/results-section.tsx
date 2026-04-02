"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildTableRows,
  type TableRowT,
} from "@/lib/build-table-rows";
import { userMessageForApiCode } from "@/lib/api-error-messages";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";
import { ExerciseReplacementPanel } from "@/components/workout/exercise-replacement-panel";
import { ClipboardList, FileDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type SortKey = "date" | "name" | "sets" | "reps" | "weight";
type SortDir = "asc" | "desc";

function compareCell(a: TableRowT, b: TableRowT, key: SortKey, dir: SortDir): number {
  const mul = dir === "asc" ? 1 : -1;
  const va = a[key];
  const vb = b[key];
  if (key === "sets" || key === "reps" || key === "weight") {
    const na = parseFloat(String(va).replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
    const nb = parseFloat(String(vb).replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
    return mul * (na - nb);
  }
  return mul * String(va).localeCompare(String(vb), "de", { numeric: true });
}

type Props = {
  result: WorkoutAnalysisResult;
  equipmentContextJson: string;
  onAnalysisUpdate: (next: WorkoutAnalysisResult) => void;
};

export function ResultsSection({
  result,
  equipmentContextJson,
  onAnalysisUpdate,
}: Props) {
  const [filterQuery, setFilterQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sendTelegram, setSendTelegram] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState<boolean | null>(
    null,
  );

  const prescription = result.next_session_prescription ?? [];

  const tableRows = useMemo(() => buildTableRows(result), [result]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/telegram-config");
        const data = (await res.json()) as { configured?: boolean };
        if (!cancelled) {
          const ok = data.configured === true;
          setTelegramConfigured(ok);
          if (!ok) setSendTelegram(false);
        }
      } catch {
        if (!cancelled) setTelegramConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    let rows = q
      ? tableRows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) || r.date.toLowerCase().includes(q),
        )
      : tableRows;
    if (sortKey) {
      rows = [...rows].sort((a, b) => compareCell(a, b, sortKey, sortDir));
    }
    return rows;
  }, [tableRows, filterQuery, sortKey, sortDir]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const downloadLogPdf = useCallback(async () => {
    setPdfMessage(null);
    setPdfLoading(true);
    try {
      const res = await fetch("/api/workout-log-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, sendTelegram }),
      });
      const tg = res.headers.get("X-Telegram-Status");
      const tgErrEnc = res.headers.get("X-Telegram-Error");
      if (!res.ok) {
        let errMsg = "Das Log-PDF konnte nicht erzeugt werden.";
        try {
          const retryRaw = res.headers.get("Retry-After");
          const retryAfterSec = retryRaw ? Number.parseInt(retryRaw, 10) : undefined;
          const err = (await res.json()) as {
            error?: string;
            code?: string;
            retryAfterSec?: number;
          };
          errMsg = userMessageForApiCode(err.code, err.error ?? "", {
            context: "pdf",
            retryAfterSec: Number.isFinite(retryAfterSec)
              ? retryAfterSec
              : err.retryAfterSec,
          });
        } catch {
          /* ignore */
        }
        setPdfMessage(errMsg);
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      const nameHdr = res.headers.get("X-Log-Pdf-Filename");
      const name = nameHdr
        ? decodeURIComponent(nameHdr)
        : `training-log-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      if (tg === "sent") {
        setPdfMessage("PDF wurde an Telegram (Bot-Chat) gesendet.");
      } else if (tg === "failed") {
        let detail =
          "PDF gespeichert — Telegram-Versand fehlgeschlagen (Token/Chat-ID prüfen).";
        if (tgErrEnc) {
          try {
            const dec = decodeURIComponent(tgErrEnc);
            if (dec) detail = `PDF gespeichert — Telegram: ${dec}`;
          } catch {
            /* ignore */
          }
        }
        setPdfMessage(detail);
      } else if (sendTelegram && tg === "skipped") {
        setPdfMessage(
          "PDF gespeichert — Telegram nicht konfiguriert (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).",
        );
      }
    } catch {
      setPdfMessage("Netzwerkfehler beim PDF.");
    } finally {
      setPdfLoading(false);
    }
  }, [result, sendTelegram]);

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Aus dem PDF erkannt</CardTitle>
            <CardDescription>
              Extrahierte Zeilen — Grundlage für die nächste Session
            </CardDescription>
          </div>
          <input
            type="search"
            placeholder="Filtern (Übung, Datum)…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-9 min-w-[200px] max-w-md flex-1 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Tabelle nach Übung oder Datum filtern"
          />
        </CardHeader>
        <CardContent>
          {tableRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Übungszeilen erkannt — evtl. war das PDF leer oder unleserlich.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="w-[1%] whitespace-nowrap"
                    aria-sort={
                      sortKey === "date"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      onClick={() => toggleSort("date")}
                    >
                      Datum <span className="text-xs opacity-70">{sortIndicator("date")}</span>
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={
                      sortKey === "name"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      onClick={() => toggleSort("name")}
                    >
                      Übung <span className="text-xs opacity-70">{sortIndicator("name")}</span>
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={
                      sortKey === "sets"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      onClick={() => toggleSort("sets")}
                    >
                      Sätze <span className="text-xs opacity-70">{sortIndicator("sets")}</span>
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={
                      sortKey === "reps"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      onClick={() => toggleSort("reps")}
                    >
                      Wdh. <span className="text-xs opacity-70">{sortIndicator("reps")}</span>
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={
                      sortKey === "weight"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      onClick={() => toggleSort("weight")}
                    >
                      Gewicht <span className="text-xs opacity-70">{sortIndicator("weight")}</span>
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Keine Zeilen passen zum Filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row, i) => (
                    <TableRow key={`${row.date}-${row.name}-${i}`}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {row.date}
                      </TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.sets}</TableCell>
                      <TableCell>{row.reps}</TableCell>
                      <TableCell>{row.weight}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-amber-600">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-amber-600" />
            <CardTitle className="text-lg">Nächste Session</CardTitle>
          </div>
          <CardDescription>
            Vorschlag für Sätze, Wdh. und Gewicht — Coach-Tipps stehen im Log-PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
            aria-busy={pdfLoading}
          >
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={pdfLoading}
              aria-disabled={pdfLoading}
              onClick={() => void downloadLogPdf()}
            >
              <FileDown className="size-4" aria-hidden />
              {pdfLoading ? "PDF …" : "Log-PDF (Druckvorlage)"}
            </Button>
            <label
              className={`flex items-center gap-2 text-sm ${
                telegramConfigured === false
                  ? "cursor-not-allowed text-muted-foreground/80"
                  : "cursor-pointer text-muted-foreground"
              }`}
            >
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={sendTelegram && telegramConfigured === true}
                onChange={(e) => setSendTelegram(e.target.checked)}
                disabled={
                  pdfLoading ||
                  telegramConfigured === false ||
                  telegramConfigured === null
                }
              />
              Zusätzlich per Telegram (Bot-Chat) senden
            </label>
          </div>
          {telegramConfigured === false ? (
            <p className="text-xs text-muted-foreground">
              Telegram ist nicht konfiguriert: in{" "}
              <code className="rounded bg-muted px-1">.env.local</code> (lokal) oder
              in den Hosting-Umgebungsvariablen{" "}
              <code className="rounded bg-muted px-1">TELEGRAM_BOT_TOKEN</code> und{" "}
              <code className="rounded bg-muted px-1">TELEGRAM_CHAT_ID</code> setzen
              — siehe README.
            </p>
          ) : null}
          {pdfMessage ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {pdfMessage}
            </p>
          ) : null}
          {prescription.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine strukturierten Vorschläge — evtl. waren die Log-Daten zu
              dünn oder unleserlich.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Übung</TableHead>
                  <TableHead className="whitespace-nowrap">Sätze</TableHead>
                  <TableHead className="whitespace-nowrap">Wdh.</TableHead>
                  <TableHead>Gewicht</TableHead>
                  <TableHead className="min-w-[8rem]">Begründung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prescription.map((row, i) => (
                  <TableRow key={`${row.exercise_name}-${i}`}>
                    <TableCell className="font-medium">{row.exercise_name}</TableCell>
                    <TableCell>{row.target_sets}</TableCell>
                    <TableCell>{row.target_reps}</TableCell>
                    <TableCell>{row.suggested_weight}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.rationale}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExerciseReplacementPanel
        result={result}
        equipmentContextJson={equipmentContextJson}
        onAnalysisUpdate={onAnalysisUpdate}
      />
    </div>
  );
}

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
import {
  AlertCircle,
  Calendar,
  Brain,
  ChevronRight,
  ClipboardList,
  FileDown,
  Mic,
  MicOff,
  MessageSquareQuote,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CoachMemoryLocal,
  CoachProfileLocal,
  CoachFollowupQuestion,
} from "@/lib/types/analysis";

type SpeechCtorLike = {
  new (): {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: { results?: { 0?: { 0?: { transcript?: string } } } }) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    start: () => void;
  };
};

function defaultNextSessionLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

/** Reihenfolge der Datum-Gruppen (ohne „—“ zuletzt). */
function compareDateLabels(a: string, b: string): number {
  if (a === "—" && b === "—") return 0;
  if (a === "—") return 1;
  if (b === "—") return -1;
  return a.localeCompare(b, "de", { numeric: true });
}

function groupRowsByWorkoutDate(
  rows: TableRowT[],
  sortKey: SortKey | null,
  sortDir: SortDir,
): { date: string; rows: TableRowT[] }[] {
  const map = new Map<string, TableRowT[]>();
  const firstSeen: string[] = [];
  for (const row of rows) {
    const d = row.date || "—";
    if (!map.has(d)) {
      map.set(d, []);
      firstSeen.push(d);
    }
    map.get(d)!.push(row);
  }
  if (sortKey) {
    for (const list of map.values()) {
      list.sort((a, b) => compareCell(a, b, sortKey, sortDir));
    }
  }
  let order: string[];
  if (sortKey === "date") {
    order = [...map.keys()].sort((a, b) =>
      compareDateLabels(a, b) * (sortDir === "asc" ? 1 : -1),
    );
  } else {
    order = firstSeen;
  }
  return order.map((date) => ({ date, rows: map.get(date)! }));
}

type Props = {
  result: WorkoutAnalysisResult;
  compact?: boolean;
  equipmentContextJson: string;
  coachProfile: CoachProfileLocal;
  coachMemory: CoachMemoryLocal;
  onCoachProfileChange: (next: CoachProfileLocal) => void;
  onCoachMemoryChange: (next: CoachMemoryLocal) => void;
  onAnalysisUpdate: (next: WorkoutAnalysisResult) => void;
};

export function ResultsSection({
  result,
  compact,
  equipmentContextJson,
  coachProfile,
  coachMemory,
  onCoachProfileChange,
  onCoachMemoryChange,
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
  const [calStatus, setCalStatus] = useState<{
    configured: boolean;
    connected: boolean;
    loggedIn: boolean;
  } | null>(null);
  const [calStartLocal, setCalStartLocal] = useState(defaultNextSessionLocal);
  const [calDurationMin, setCalDurationMin] = useState(90);
  const [calMessage, setCalMessage] = useState<string | null>(null);
  const [calEventLink, setCalEventLink] = useState<string | null>(null);
  const [calBusy, setCalBusy] = useState(false);
  const [followupAnswers, setFollowupAnswers] = useState<Record<string, string>>({});
  const [refineBusy, setRefineBusy] = useState(false);
  const [refineMessage, setRefineMessage] = useState<string | null>(null);
  const [debriefEffort, setDebriefEffort] = useState<string>(
    result.post_workout_debrief?.session_effort_1_10
      ? String(result.post_workout_debrief.session_effort_1_10)
      : "",
  );
  const [debriefPain, setDebriefPain] = useState(
    result.post_workout_debrief?.pain_notes ?? "",
  );
  const [debriefRecovery, setDebriefRecovery] = useState(
    result.post_workout_debrief?.recovery_flags ?? "",
  );
  const [debriefNote, setDebriefNote] = useState(
    result.post_workout_debrief?.free_note ?? "",
  );
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [activeSpeechQuestionId, setActiveSpeechQuestionId] = useState<string | null>(
    null,
  );

  const prescription = result.next_session_prescription ?? [];
  const coachBigPicture = result.coach_big_picture;
  const coachFollowup = result.coach_followup;
  const tomorrowPlan = result.tomorrow_plan;

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

  const refreshCalStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/google-calendar/status", {
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        configured?: boolean;
        connected?: boolean;
        loggedIn?: boolean;
      };
      setCalStatus({
        configured: data.configured === true,
        connected: data.connected === true,
        loggedIn: data.loggedIn === true,
      });
    } catch {
      setCalStatus({
        configured: false,
        connected: false,
        loggedIn: false,
      });
    }
  }, []);

  useEffect(() => {
    void refreshCalStatus();
  }, [refreshCalStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const cal = u.searchParams.get("calendar");
    if (cal === "connected") {
      setCalMessage("Google-Kalender wurde verbunden.");
      u.searchParams.delete("calendar");
      u.searchParams.delete("reason");
      window.history.replaceState({}, "", `${u.pathname}${u.search}`);
      void refreshCalStatus();
    } else if (cal === "error") {
      setCalEventLink(null);
      const reason = u.searchParams.get("reason") ?? "";
      setCalMessage(
        reason
          ? `Google-Verbindung fehlgeschlagen (${reason}).`
          : "Google-Verbindung fehlgeschlagen.",
      );
      u.searchParams.delete("calendar");
      u.searchParams.delete("reason");
      window.history.replaceState({}, "", `${u.pathname}${u.search}`);
    }
  }, [refreshCalStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    setSpeechSupported(supported);
  }, []);

  useEffect(() => {
    if (coachFollowup?.required) {
      setFollowupModalOpen(true);
    }
  }, [coachFollowup?.required]);

  useEffect(() => {
    setDebriefEffort(
      result.post_workout_debrief?.session_effort_1_10
        ? String(result.post_workout_debrief.session_effort_1_10)
        : "",
    );
    setDebriefPain(result.post_workout_debrief?.pain_notes ?? "");
    setDebriefRecovery(result.post_workout_debrief?.recovery_flags ?? "");
    setDebriefNote(result.post_workout_debrief?.free_note ?? "");
  }, [result.post_workout_debrief]);

  const createCalendarEvent = useCallback(async () => {
    setCalMessage(null);
    setCalBusy(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const start = new Date(calStartLocal);
      if (Number.isNaN(start.getTime())) {
        setCalMessage("Ungültige Startzeit.");
        return;
      }
      const res = await fetch("/api/google-calendar/event", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result,
          timeZone: tz,
          start: start.toISOString(),
          durationMinutes: calDurationMin,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        code?: string;
        htmlLink?: string | null;
        retryAfterSec?: number;
      };
      if (!res.ok) {
        setCalMessage(
          userMessageForApiCode(json.code, json.error ?? "", {
            context: "calendar",
            retryAfterSec: json.retryAfterSec,
          }),
        );
        return;
      }
      setCalMessage("Termin wurde im Google-Kalender angelegt.");
      setCalEventLink(typeof json.htmlLink === "string" ? json.htmlLink : null);
    } catch {
      setCalMessage("Netzwerkfehler beim Kalender-Eintrag.");
    } finally {
      setCalBusy(false);
    }
  }, [result, calStartLocal, calDurationMin]);

  const disconnectCalendar = useCallback(async () => {
    setCalMessage(null);
    setCalEventLink(null);
    setCalBusy(true);
    try {
      const res = await fetch("/api/google-calendar/disconnect", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setCalMessage("Trennen der Google-Verbindung fehlgeschlagen.");
        return;
      }
      setCalMessage("Google-Kalender-Verbindung getrennt.");
      await refreshCalStatus();
    } catch {
      setCalMessage("Netzwerkfehler.");
    } finally {
      setCalBusy(false);
    }
  }, [refreshCalStatus]);

  const filteredRows = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return q
      ? tableRows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) || r.date.toLowerCase().includes(q),
        )
      : tableRows;
  }, [tableRows, filterQuery]);

  const groupedByDate = useMemo(
    () => groupRowsByWorkoutDate(filteredRows, sortKey, sortDir),
    [filteredRows, sortKey, sortDir],
  );

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

  const setFollowupAnswer = useCallback((id: string, value: string) => {
    setFollowupAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const startSpeechForQuestion = useCallback(
    (questionId: string) => {
      if (typeof window === "undefined") return;
      const SpeechCtor =
        (window as Window & {
          SpeechRecognition?: SpeechCtorLike;
          webkitSpeechRecognition?: SpeechCtorLike;
        })
          .SpeechRecognition ??
        (window as Window & {
          SpeechRecognition?: SpeechCtorLike;
          webkitSpeechRecognition?: SpeechCtorLike;
        })
          .webkitSpeechRecognition;
      if (!SpeechCtor) return;
      const rec = new SpeechCtor();
      rec.lang = "de-DE";
      rec.continuous = false;
      rec.interimResults = false;
      setActiveSpeechQuestionId(questionId);
      rec.onresult = (event) => {
        const txt = String(event?.results?.[0]?.[0]?.transcript ?? "").trim();
        if (!txt) return;
        if (questionId === "__debrief_note__") {
          setDebriefNote((prev) => [prev, txt].filter(Boolean).join(" ").trim());
          return;
        }
        setFollowupAnswers((prev) => ({
          ...prev,
          [questionId]: [prev[questionId] ?? "", txt].filter(Boolean).join(" "),
        }));
      };
      rec.onend = () => {
        setActiveSpeechQuestionId((curr) => (curr === questionId ? null : curr));
      };
      rec.onerror = () => {
        setActiveSpeechQuestionId((curr) => (curr === questionId ? null : curr));
      };
      rec.start();
    },
    [],
  );

  const refineWithCoachAnswers = useCallback(async () => {
    setRefineMessage(null);
    setRefineBusy(true);
    try {
      const answers = Object.entries(followupAnswers)
        .map(([question_id, answer]) => ({ question_id, answer: answer.trim() }))
        .filter((x) => x.answer.length > 0);
      const effortNum = Number.parseInt(debriefEffort, 10);
      const res = await fetch("/api/coach-refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result,
          answers,
          coachProfile,
          coachMemory,
          postWorkoutDebrief: {
            session_effort_1_10:
              debriefEffort.trim() === "" || !Number.isFinite(effortNum)
                ? null
                : effortNum,
            pain_notes: debriefPain.trim(),
            recovery_flags: debriefRecovery.trim(),
            free_note: debriefNote.trim(),
          },
        }),
      });
      const json = (await res.json()) as WorkoutAnalysisResult | { error?: string; code?: string };
      if (!res.ok) {
        const err = json as { error?: string; code?: string };
        setRefineMessage(
          userMessageForApiCode(err.code, err.error ?? "Coach-Refine fehlgeschlagen."),
        );
        return;
      }
      onAnalysisUpdate(json as WorkoutAnalysisResult);
      setRefineMessage("Coach-Update übernommen.");
    } catch {
      setRefineMessage("Netzwerkfehler beim Coach-Refine.");
    } finally {
      setRefineBusy(false);
    }
  }, [
    coachMemory,
    coachProfile,
    debriefEffort,
    debriefNote,
    debriefPain,
    debriefRecovery,
    followupAnswers,
    onAnalysisUpdate,
    result,
  ]);

  const renderQuestionInput = (q: CoachFollowupQuestion) => {
    if (q.kind === "choice") {
      return (
        <select
          value={followupAnswers[q.id] ?? ""}
          onChange={(e) => setFollowupAnswer(q.id, e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Auswählen …</option>
          {(q.choices ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      );
    }
    if (q.kind === "scale") {
      return (
        <input
          type="number"
          min={1}
          max={10}
          placeholder="1-10"
          value={followupAnswers[q.id] ?? ""}
          onChange={(e) => setFollowupAnswer(q.id, e.target.value)}
          className="h-9 w-28 rounded-md border border-input bg-background px-2 text-sm"
        />
      );
    }
    return (
      <div className="space-y-2">
        <textarea
          rows={2}
          placeholder="Deine Antwort …"
          value={followupAnswers[q.id] ?? ""}
          onChange={(e) => setFollowupAnswer(q.id, e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {speechSupported ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => startSpeechForQuestion(q.id)}
            disabled={activeSpeechQuestionId !== null}
          >
            {activeSpeechQuestionId === q.id ? (
              <>
                <MicOff className="size-4" aria-hidden />
                Aufnahme läuft…
              </>
            ) : (
              <>
                <Mic className="size-4" aria-hidden />
                Sprechen (DE)
              </>
            )}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Spracherkennung wird auf diesem Browser nicht unterstützt.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {!compact ? (
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Aus dem PDF erkannt</CardTitle>
            <CardDescription>
              Nach Workout-Tag gruppiert — Bereich ausklappen für alle Zeilen
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
            <div className="space-y-4">
              <div
                role="toolbar"
                aria-label="Sortierung der Zeilen innerhalb jedes Workout-Tags"
                className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border pb-3 text-sm"
              >
                {(
                  [
                    ["date", "Datum"],
                    ["name", "Übung"],
                    ["sets", "Sätze"],
                    ["reps", "Wdh."],
                    ["weight", "Gewicht"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                    aria-pressed={sortKey === key}
                    onClick={() => toggleSort(key)}
                  >
                    {label}{" "}
                    <span className="text-xs opacity-70">{sortIndicator(key)}</span>
                  </button>
                ))}
              </div>
              {filteredRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Zeilen passen zum Filter.
                </p>
              ) : (
                <div className="space-y-2">
                  {groupedByDate.map(({ date, rows }) => (
                    <details
                      key={date}
                      className="overflow-hidden rounded-lg border border-border bg-muted/20 [&[open]]:bg-muted/35"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                        <ChevronRight
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="tabular-nums">{date}</span>
                        <span className="font-normal text-muted-foreground">
                          ({rows.length}{" "}
                          {rows.length === 1 ? "Übung" : "Übungen"})
                        </span>
                      </summary>
                      <div className="border-t border-border px-2 pb-3 pt-1">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[1%]">Übung</TableHead>
                              <TableHead>Sätze</TableHead>
                              <TableHead>Wdh.</TableHead>
                              <TableHead>Gewicht</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row, i) => (
                              <TableRow key={`${date}-${row.name}-${i}`}>
                                <TableCell>{row.name}</TableCell>
                                <TableCell>{row.sets}</TableCell>
                                <TableCell>{row.reps}</TableCell>
                                <TableCell>{row.weight}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      <Card className="border-l-4 border-l-amber-600/80 border-border/80">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-amber-600" />
            <CardTitle className="text-lg">Nächste Session</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Vorschlag für Sätze, Wdh. und Gewicht — Coach-Tipps stehen im Log-PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={`rounded-lg border border-border bg-muted/20 p-3 ${
              compact ? "hidden" : ""
            }`}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Brain className="size-4 text-primary" aria-hidden />
              Coach Memory (lokal)
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Ziel-Priorität
                <input
                  value={coachProfile.goal_priority}
                  onChange={(e) =>
                    onCoachProfileChange({ ...coachProfile, goal_priority: e.target.value })
                  }
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Wiederkehrende Schmerzen
                <input
                  value={coachProfile.recurring_pain_notes}
                  onChange={(e) =>
                    onCoachProfileChange({
                      ...coachProfile,
                      recurring_pain_notes: e.target.value,
                    })
                  }
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Recovery (Schlaf/Stress)
                <input
                  value={coachProfile.recovery_notes}
                  onChange={(e) =>
                    onCoachProfileChange({ ...coachProfile, recovery_notes: e.target.value })
                  }
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Zeit-/Schedule-Constraints
                <input
                  value={coachProfile.schedule_constraints}
                  onChange={(e) =>
                    onCoachProfileChange({
                      ...coachProfile,
                      schedule_constraints: e.target.value,
                    })
                  }
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Lokal gespeichert. Sessions im Memory:{" "}
              {coachMemory.recent_sessions.length}, Gesamt gesehen:{" "}
              {coachMemory.trend_stats.total_sessions_seen}
            </p>
            <button
              type="button"
              className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() =>
                onCoachMemoryChange({
                  recent_sessions: [],
                  long_term_summary: "",
                  trend_stats: {
                    total_sessions_seen: 0,
                    unique_exercises_seen: 0,
                    approximate_total_sets: 0,
                  },
                  last_updated_at: "",
                })
              }
            >
              Coach-Memory lokal zurücksetzen
            </button>
          </div>

          {tomorrowPlan ? (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertCircle className="size-4 text-primary" aria-hidden />
                Tomorrow Plan
              </div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {tomorrowPlan.status === "as_planned"
                  ? "As planned"
                  : tomorrowPlan.status === "light_adjustment"
                    ? "Light adjustment"
                    : "Deload signal"}
              </p>
              <p className="mt-1 text-sm text-foreground">{tomorrowPlan.summary}</p>
              {tomorrowPlan.top_priorities.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {tomorrowPlan.top_priorities.map((item, i) => (
                    <li key={`${item}-${i}`}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {tomorrowPlan.caution_flags.length > 0 ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Achtung: {tomorrowPlan.caution_flags.join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {coachBigPicture ? (
            <div className="rounded-lg border border-amber-400/40 bg-amber-50/20 p-3 dark:bg-amber-900/10">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertCircle className="size-4 text-amber-600" aria-hidden />
                Big-Picture Coach
              </div>
              <p className="text-sm text-foreground">{coachBigPicture.headline}</p>
              {coachBigPicture.watch_outs.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {coachBigPicture.watch_outs.map((item, i) => (
                    <li key={`${item}-${i}`}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-border/80 bg-muted/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageSquareQuote className="size-4 text-primary" aria-hidden />
              Post-Workout Debrief
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Effort (1-10)
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={debriefEffort}
                  onChange={(e) => setDebriefEffort(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Recovery flag
                <input
                  value={debriefRecovery}
                  onChange={(e) => setDebriefRecovery(e.target.value)}
                  placeholder="z. B. schlechter Schlaf"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                />
              </label>
            </div>
            <label className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              Pain / discomfort
              <input
                value={debriefPain}
                onChange={(e) => setDebriefPain(e.target.value)}
                placeholder="Kurz notieren…"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              />
            </label>
            <label className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              Optional note
              <textarea
                rows={2}
                value={debriefNote}
                onChange={(e) => setDebriefNote(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {speechSupported ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startSpeechForQuestion("__debrief_note__")}
                  disabled={activeSpeechQuestionId !== null}
                >
                  <Mic className="size-4" aria-hidden />
                  Voice note (DE)
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={() => void refineWithCoachAnswers()}
                disabled={refineBusy}
              >
                {refineBusy ? "Updating…" : "Update tomorrow plan"}
              </Button>
            </div>
          </div>

          {coachFollowup?.required ? (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <MessageSquareQuote className="size-4 text-primary" aria-hidden />
                Coach needs clarification
              </div>
              <p className="mb-3 text-sm text-muted-foreground">{coachFollowup.reason}</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setFollowupModalOpen(true)}
              >
                Fragen öffnen
              </Button>
              {refineMessage ? (
                <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
                  {refineMessage}
                </p>
              ) : null}
            </div>
          ) : null}

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
              {pdfLoading ? "PDF …" : "Log-PDF"}
            </Button>
          </div>
          {pdfMessage ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {pdfMessage}
            </p>
          ) : null}

          <details className="space-y-3 rounded-lg border border-border/80 bg-muted/10 p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              More
            </summary>
            <div className="space-y-3 border-t border-border pt-3">
              <div
                className={`rounded-md border border-border/70 bg-background/60 p-3 ${
                  compact ? "" : "hidden"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Brain className="size-4 text-primary" aria-hidden />
                  Coach Memory (lokal)
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Ziel-Priorität
                    <input
                      value={coachProfile.goal_priority}
                      onChange={(e) =>
                        onCoachProfileChange({ ...coachProfile, goal_priority: e.target.value })
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Wiederkehrende Schmerzen
                    <input
                      value={coachProfile.recurring_pain_notes}
                      onChange={(e) =>
                        onCoachProfileChange({
                          ...coachProfile,
                          recurring_pain_notes: e.target.value,
                        })
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-md border border-border/70 bg-background/60 p-3">
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
                {telegramConfigured === false ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Telegram nicht konfiguriert (`TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`).
                  </p>
                ) : null}
              </div>
              <div className="rounded-md border border-border/70 bg-background/60 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Calendar className="size-4 text-amber-600" aria-hidden />
                  Google Kalender
                </div>
            {calStatus === null ? (
              <p className="text-xs text-muted-foreground">Kalender-Status …</p>
            ) : !calStatus.configured ? (
              <p className="text-xs text-muted-foreground">
                Google OAuth ist nicht konfiguriert:{" "}
                <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code>,{" "}
                <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code>{" "}
                und{" "}
                <code className="rounded bg-muted px-1">GOOGLE_OAUTH_REDIRECT_URI</code>{" "}
                (oder <code className="rounded bg-muted px-1">NEXT_PUBLIC_SITE_URL</code>)
                in <code className="rounded bg-muted px-1">.env.local</code> setzen — siehe
                .env.example.
              </p>
            ) : !calStatus.loggedIn ? (
              <p className="text-xs text-muted-foreground">
                Für Kalender-Sync: oben anmelden (serverseitige Historie mit{" "}
                <code className="rounded bg-muted px-1">DATABASE_URL</code> und{" "}
                <code className="rounded bg-muted px-1">AUTH_SECRET</code>), dann Google
                verbinden.
              </p>
            ) : !calStatus.connected ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={calBusy}
                  onClick={() => {
                    window.location.href = "/api/google-calendar/start";
                  }}
                >
                  <Calendar className="size-4" aria-hidden />
                  Google-Kalender verbinden
                </Button>
                <span className="text-xs text-muted-foreground">
                  Einmalig bei Google anmelden — nur Termine anlegen, kein voller Kalender-Zugriff
                  nötig.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="flex min-w-[10rem] flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Start</span>
                  <input
                    type="datetime-local"
                    value={calStartLocal}
                    onChange={(e) => setCalStartLocal(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </label>
                <label className="flex w-[8rem] flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Dauer (Min.)</span>
                  <select
                    value={calDurationMin}
                    onChange={(e) => setCalDurationMin(Number(e.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {[45, 60, 75, 90, 105, 120].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={calBusy}
                  onClick={() => void createCalendarEvent()}
                >
                  {calBusy ? "…" : "Termin anlegen"}
                </Button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                  disabled={calBusy}
                  onClick={() => void disconnectCalendar()}
                >
                  Google-Verbindung trennen
                </button>
              </div>
            )}
            {calMessage ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {calMessage}
                {calEventLink ? (
                  <>
                    {" "}
                    <a
                      href={calEventLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Im Kalender öffnen
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
              </div>
            </div>
          </details>

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

      <details className="rounded-lg border border-border/80 bg-muted/10 p-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          Raw data table
        </summary>
        <div className="mt-3">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Aus dem PDF erkannt</CardTitle>
                <CardDescription>Nach Workout-Tag gruppiert.</CardDescription>
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
                <div className="space-y-4">
                  <div
                    role="toolbar"
                    aria-label="Sortierung der Zeilen innerhalb jedes Workout-Tags"
                    className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border pb-3 text-sm"
                  >
                    {(
                      [
                        ["date", "Datum"],
                        ["name", "Übung"],
                        ["sets", "Sätze"],
                        ["reps", "Wdh."],
                        ["weight", "Gewicht"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                        aria-pressed={sortKey === key}
                        onClick={() => toggleSort(key)}
                      >
                        {label}{" "}
                        <span className="text-xs opacity-70">{sortIndicator(key)}</span>
                      </button>
                    ))}
                  </div>
                  {filteredRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Zeilen passen zum Filter.</p>
                  ) : (
                    <div className="space-y-2">
                      {groupedByDate.map(({ date, rows }) => (
                        <details
                          key={date}
                          className="overflow-hidden rounded-lg border border-border bg-muted/20 [&[open]]:bg-muted/35"
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                            <ChevronRight
                              aria-hidden
                              className="size-4 shrink-0 text-muted-foreground"
                            />
                            <span className="tabular-nums">{date}</span>
                            <span className="font-normal text-muted-foreground">
                              ({rows.length} {rows.length === 1 ? "Übung" : "Übungen"})
                            </span>
                          </summary>
                          <div className="border-t border-border px-2 pb-3 pt-1">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[1%]">Übung</TableHead>
                                  <TableHead>Sätze</TableHead>
                                  <TableHead>Wdh.</TableHead>
                                  <TableHead>Gewicht</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map((row, i) => (
                                  <TableRow key={`${date}-${row.name}-${i}`}>
                                    <TableCell>{row.name}</TableCell>
                                    <TableCell>{row.sets}</TableCell>
                                    <TableCell>{row.reps}</TableCell>
                                    <TableCell>{row.weight}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </details>

      <ExerciseReplacementPanel
        result={result}
        equipmentContextJson={equipmentContextJson}
        onAnalysisUpdate={onAnalysisUpdate}
      />

      {coachFollowup?.required && followupModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-background p-4 shadow-xl">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Coach Clarifications</p>
                <p className="text-sm text-muted-foreground">{coachFollowup.reason}</p>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setFollowupModalOpen(false)}
                aria-label="Coach-Popup schließen"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="space-y-3">
              {coachFollowup.questions.map((q) => (
                <div key={q.id} className="space-y-1">
                  <p className="text-sm text-foreground">{q.prompt}</p>
                  {renderQuestionInput(q)}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={refineBusy}
                onClick={() => void refineWithCoachAnswers()}
              >
                {refineBusy ? "Coach …" : "Refine next session"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFollowupModalOpen(false)}
              >
                Später
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

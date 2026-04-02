"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { applyExerciseReplacementInPrescription } from "@/lib/apply-exercise-replacement";
import { userMessageForApiCode } from "@/lib/api-error-messages";
import { collectExerciseNames } from "@/lib/collect-exercise-names";
import type { ExerciseReplacementResult } from "@/lib/exercise-replacement-zod";
import type { WorkoutAnalysisResult } from "@/lib/types/analysis";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  result: WorkoutAnalysisResult;
  equipmentContextJson: string;
  onAnalysisUpdate: (next: WorkoutAnalysisResult) => void;
};

export function ExerciseReplacementPanel({
  result,
  equipmentContextJson,
  onAnalysisUpdate,
}: Props) {
  const names = useMemo(() => collectExerciseNames(result), [result]);
  const [exercise, setExercise] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (names.length === 0) return;
    setExercise((prev) =>
      prev && names.includes(prev) ? prev : (names[0] ?? ""),
    );
  }, [names]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<ExerciseReplacementResult | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  const requestReplacement = useCallback(async () => {
    const name = exercise.trim();
    if (!name) {
      setError("Bitte eine Übung wählen oder eintragen.");
      return;
    }
    setLoading(true);
    setError(null);
    setOut(null);
    setApplyMsg(null);
    try {
      const res = await fetch("/api/exercise-replacement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_name: name,
          reason: reason.trim() || undefined,
          equipment_context: equipmentContextJson || undefined,
          analysis_context: result.progressive_overload_analysis.slice(0, 3500),
        }),
      });
      const retryRaw = res.headers.get("Retry-After");
      const retryAfterSec = retryRaw ? Number.parseInt(retryRaw, 10) : undefined;
      const json = (await res.json()) as ExerciseReplacementResult & {
        error?: string;
        code?: string;
        retryAfterSec?: number;
      };
      if (!res.ok) {
        setError(
          userMessageForApiCode(json.code, json.error ?? "", {
            context: "replacement",
            retryAfterSec: Number.isFinite(retryAfterSec)
              ? retryAfterSec
              : json.retryAfterSec,
          }),
        );
        return;
      }
      setOut({
        alternative_exercise: json.alternative_exercise,
        why_it_fits: json.why_it_fits,
        execution_tip: json.execution_tip,
        prescription_hint: json.prescription_hint,
      });
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }, [exercise, reason, equipmentContextJson, result.progressive_overload_analysis]);

  const applyReplacement = useCallback(() => {
    if (!out) return;
    const name = exercise.trim();
    const applied = applyExerciseReplacementInPrescription(result, name, out);
    if (!applied.ok) {
      setApplyMsg(null);
      setError(applied.message);
      return;
    }
    setError(null);
    onAnalysisUpdate(applied.result);
    setApplyMsg(
      `„${name}“ wurde durch „${out.alternative_exercise.trim()}“ ersetzt — sichtbar in „Nächste Session“ und im Log-PDF.`,
    );
  }, [exercise, onAnalysisUpdate, out, result]);

  return (
    <Card className="overflow-hidden border-sky-600/25 bg-gradient-to-br from-sky-50/40 via-card to-card shadow-sm dark:from-sky-950/20 dark:via-card dark:to-card">
      <div className="h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-sky-600" aria-hidden />
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-lg tracking-tight">Eine Übung ersetzen</CardTitle>
        <CardDescription className="leading-relaxed">
          Wähle eine Übung aus Log oder nächster Session — z.&nbsp;B. Rows. Nach dem
          Vorschlag kannst du sie für die Druckvorlage übernehmen, bevor du das
          Log-PDF erzeugst.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Übung</span>
            <input
              type="text"
              list="exercise-name-options"
              value={exercise}
              onChange={(e) => {
                setExercise(e.target.value);
                setApplyMsg(null);
              }}
              placeholder="z. B. Langhantel-Rudern"
              className="h-10 rounded-lg border border-input bg-background/80 px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <datalist id="exercise-name-options">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium text-foreground">
              Optional: Warum ersetzen?
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z. B. mag ich nicht, Schulter …"
              className="h-10 rounded-lg border border-input bg-background/80 px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={loading}
            aria-disabled={loading}
            onClick={() => void requestReplacement()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Ersatz vorschlagen
          </Button>
          {out ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              className="bg-sky-600 hover:bg-sky-600/90"
              onClick={applyReplacement}
            >
              <Check className="size-4" aria-hidden />
              Übernehmen für Log-PDF
            </Button>
          ) : null}
        </div>
        {error ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        ) : null}
        {applyMsg ? (
          <p
            className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200/90"
            aria-live="polite"
          >
            {applyMsg}
          </p>
        ) : null}
        {out ? (
          <div className="space-y-4 rounded-xl border border-border/80 bg-muted/25 p-5 text-sm shadow-inner">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Alternative
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {out.alternative_exercise}
              </p>
            </div>
            <p className="leading-relaxed text-muted-foreground">{out.why_it_fits}</p>
            <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-1">
              <div>
                <p className="text-xs font-semibold text-foreground">Ausführung</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {out.execution_tip}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Vorgabe-Idee</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {out.prescription_hint}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

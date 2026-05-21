"use client";

import { useEffect, useState } from "react";
import { EquipmentContextCard } from "@/components/workout/equipment-context-card";
import { AuthBar } from "@/components/auth-bar";
import {
  COACH_PROFILE_LOCAL_STORAGE_KEY,
  loadCoachProfileLocal,
  saveCoachProfileLocal,
} from "@/lib/coach-memory-local";
import {
  EQUIPMENT_LOCAL_STORAGE_KEY,
  parseEquipmentPayloadLoose,
} from "@/lib/equipment-context";
import type { EquipmentContextPayload } from "@/lib/equipment-context";
import type { CoachProfileLocal } from "@/lib/types/analysis";

interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  loggedIn: boolean;
}

export default function SettingsPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Equipment
  const [equipment, setEquipment] = useState<EquipmentContextPayload>({ presetIds: [], notes: "" });

  // Coach profile
  const [coach, setCoach] = useState<CoachProfileLocal>({
    goal_priority: "",
    recurring_pain_notes: "",
    recovery_notes: "",
    schedule_constraints: "",
    preferred_training_days: "",
  });
  const [coachSaved, setCoachSaved] = useState(false);

  // Telegram
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState<string | null>(null);

  // Google Calendar
  const [calStatus, setCalStatus] = useState<CalendarStatus | null>(null);
  const [calLoading, setCalLoading] = useState(false);

  useEffect(() => {
    // Load from localStorage
    const rawEq = localStorage.getItem(EQUIPMENT_LOCAL_STORAGE_KEY);
    if (rawEq) {
      try { setEquipment(parseEquipmentPayloadLoose(JSON.parse(rawEq))); } catch { /* ignore */ }
    }
    setCoach(loadCoachProfileLocal());

    // Fetch auth state
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (res) => {
        const data = (await res.json()) as { loggedIn?: boolean; email?: string | null };
        const li = !!data.loggedIn;
        setLoggedIn(li);
        setUserEmail(typeof data.email === "string" ? data.email : null);
        if (li) {
          // Load Telegram
          fetch("/api/user/telegram")
            .then(async (r) => {
              if (!r.ok) return;
              const d = (await r.json()) as { telegramChatId: string | null };
              setTelegramChatId(d.telegramChatId ?? "");
            })
            .catch(() => {});

          // Load Calendar status
          fetch("/api/google-calendar/status")
            .then(async (r) => {
              if (!r.ok) return;
              setCalStatus((await r.json()) as CalendarStatus);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  function handleEquipmentChange(next: EquipmentContextPayload) {
    setEquipment(next);
    localStorage.setItem(EQUIPMENT_LOCAL_STORAGE_KEY, JSON.stringify(next));
  }

  function handleCoachChange(field: keyof CoachProfileLocal, value: string) {
    setCoach((prev) => ({ ...prev, [field]: value }));
    setCoachSaved(false);
  }

  function handleCoachSave(e: React.FormEvent) {
    e.preventDefault();
    saveCoachProfileLocal(coach);
    setCoachSaved(true);
    setTimeout(() => setCoachSaved(false), 2500);
  }

  async function handleTelegramSave(e: React.FormEvent) {
    e.preventDefault();
    setTelegramSaving(true);
    setTelegramMsg(null);
    try {
      const res = await fetch("/api/user/telegram", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramChatId: telegramChatId.trim() || null }),
      });
      setTelegramMsg(
        res.ok
          ? telegramChatId.trim()
            ? "Gespeichert! Du erhältst ab Sonntag wöchentliche Recaps."
            : "Telegram-Verbindung entfernt."
          : "Fehler beim Speichern.",
      );
    } catch {
      setTelegramMsg("Netzwerkfehler.");
    } finally {
      setTelegramSaving(false);
    }
  }

  async function handleCalDisconnect() {
    setCalLoading(true);
    try {
      await fetch("/api/google-calendar/disconnect", { method: "POST" });
      setCalStatus((prev) => (prev ? { ...prev, connected: false } : prev));
    } catch { /* ignore */ } finally {
      setCalLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Einstellungen</h1>

      {/* ── Konto ─────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Konto</SectionTitle>
        <AuthBar onAuthChange={(li) => setLoggedIn(li)} />
        {loggedIn && userEmail && (
          <p className="mt-2 text-xs text-muted-foreground">
            Angemeldet als <span className="font-medium text-foreground">{userEmail}</span>. Trainingsdaten werden serverseitig gespeichert und geräteübergreifend synchronisiert.
          </p>
        )}
        {!loggedIn && (
          <p className="mt-2 text-xs text-muted-foreground">
            Ohne Konto werden alle Daten nur im Browser (localStorage) gespeichert.
          </p>
        )}
      </section>

      {/* ── Coach-Profil ──────────────────────────────────────── */}
      <section>
        <SectionTitle>Coach-Profil</SectionTitle>
        <p className="mb-4 text-xs text-muted-foreground">
          Diese Informationen fließen in jeden Analyse-Prompt ein, damit der KI-Coach deine Situation kennt.
        </p>
        <form onSubmit={handleCoachSave} className="space-y-4">
          <Field
            label="Trainingsziel"
            placeholder="z. B. Maximalkraft aufbauen, Gewicht halten, Marathon vorbereiten…"
            value={coach.goal_priority}
            onChange={(v) => handleCoachChange("goal_priority", v)}
          />
          <Field
            label="Wiederkehrende Schmerzen / Verletzungen"
            placeholder="z. B. Knieschmerzen bei tiefer Kniebeuge, Schulter nicht über Kopf…"
            value={coach.recurring_pain_notes}
            onChange={(v) => handleCoachChange("recurring_pain_notes", v)}
          />
          <Field
            label="Erholung & Schlaf"
            placeholder="z. B. 7–8 h Schlaf, stressige Arbeitswoche, Nachtschichten…"
            value={coach.recovery_notes}
            onChange={(v) => handleCoachChange("recovery_notes", v)}
          />
          <Field
            label="Zeitliche Einschränkungen"
            placeholder="z. B. max. 60 min pro Session, nur morgens trainierbar…"
            value={coach.schedule_constraints}
            onChange={(v) => handleCoachChange("schedule_constraints", v)}
          />
          <Field
            label="Bevorzugte Trainingstage"
            placeholder="z. B. Mo / Mi / Fr, immer Di + Do + Sa…"
            value={coach.preferred_training_days}
            onChange={(v) => handleCoachChange("preferred_training_days", v)}
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {coachSaved ? "Gespeichert ✓" : "Speichern"}
          </button>
        </form>
      </section>

      {/* ── Equipment ─────────────────────────────────────────── */}
      <section>
        <SectionTitle>Gym-Ausstattung</SectionTitle>
        <p className="mb-4 text-xs text-muted-foreground">
          Teile dem Coach mit, welche Geräte dir zur Verfügung stehen — er passt Übungsvorschläge entsprechend an.
        </p>
        <EquipmentContextCard value={equipment} onChange={handleEquipmentChange} />
      </section>

      {/* ── Telegram ──────────────────────────────────────────── */}
      {loggedIn && (
        <section>
          <SectionTitle>Wöchentlicher Telegram-Recap</SectionTitle>
          <p className="mb-3 text-xs text-muted-foreground">
            Jeden Sonntag um 19 Uhr erhältst du eine kurze Zusammenfassung deiner Trainingswoche per Telegram.
            Öffne <strong>@userinfobot</strong> in Telegram → sende <code>/start</code> → kopiere deine Chat-ID hier rein.
          </p>
          <form onSubmit={handleTelegramSave} className="flex items-center gap-3">
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Chat-ID (z. B. 123456789)"
              className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={telegramSaving}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {telegramSaving ? "…" : "Speichern"}
            </button>
          </form>
          {telegramMsg && <p className="mt-1.5 text-xs text-muted-foreground">{telegramMsg}</p>}
        </section>
      )}

      {/* ── Google Calendar ───────────────────────────────────── */}
      {loggedIn && calStatus?.configured && (
        <section>
          <SectionTitle>Google Calendar</SectionTitle>
          <p className="mb-3 text-xs text-muted-foreground">
            Verknüpfe deinen Google-Kalender, um Trainingsvorschläge direkt als Termin einzutragen.
          </p>
          {calStatus.connected ? (
            <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
              <span className="text-sm text-foreground">Kalender verbunden</span>
              <button
                onClick={() => void handleCalDisconnect()}
                disabled={calLoading}
                className="ml-auto rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {calLoading ? "…" : "Trennen"}
              </button>
            </div>
          ) : (
            <a
              href="/api/google-calendar/start"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Mit Google verbinden
            </a>
          )}
        </section>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <textarea
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />
    </label>
  );
}

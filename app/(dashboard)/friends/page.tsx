"use client";

import { useEffect, useState } from "react";
import type { AchievementDef } from "@/lib/achievements/catalog";

interface FriendInfo {
  id: string;
  email: string;
  currentStreak: number;
  latestPrExercise: string | null;
  latestPrValue: number | null;
  latestPrType: string | null;
}

interface UnlockedAchievement {
  id: string;
  title: string;
  icon: string;
  description: string;
  unlockedAt: string;
}

export default function FriendsPage() {
  const [friendCode, setFriendCode] = useState<string>("");
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [addCode, setAddCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  // Telegram per-user setup
  const [telegramChatId, setTelegramChatId] = useState<string>("");
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState<string | null>(null);

  // Achievements
  const [unlockedAchievements, setUnlockedAchievements] = useState<UnlockedAchievement[]>([]);
  const [achievementCatalog, setAchievementCatalog] = useState<AchievementDef[]>([]);

  useEffect(() => {
    fetch("/api/friends")
      .then(async (res) => {
        if (res.status === 401) {
          setNotLoggedIn(true);
          return;
        }
        if (!res.ok) {
          setError("Fehler beim Laden der Freunde.");
          return;
        }
        const data = (await res.json()) as { friendCode: string; friends: FriendInfo[] };
        setFriendCode(data.friendCode ?? "");
        setFriends(data.friends ?? []);
      })
      .catch(() => setError("Netzwerkfehler."))
      .finally(() => setLoading(false));

    // Load Telegram chat ID
    fetch("/api/user/telegram")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { telegramChatId: string | null };
        setTelegramChatId(data.telegramChatId ?? "");
      })
      .catch(() => {});

    // Load achievements
    fetch("/api/user/achievements")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          enabled: boolean;
          unlocked: UnlockedAchievement[];
          catalog: AchievementDef[];
        };
        if (data.enabled) {
          setUnlockedAchievements(data.unlocked);
          setAchievementCatalog(data.catalog);
        }
      })
      .catch(() => {});
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(friendCode).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);
    if (!addCode.trim()) return;

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: addCode.trim() }),
      });

      if (res.status === 404) {
        setAddError("Kein Nutzer mit diesem Code gefunden.");
        return;
      }
      if (!res.ok) {
        setAddError("Fehler beim Hinzufügen. Bitte erneut versuchen.");
        return;
      }

      const data = (await res.json()) as { ok: boolean; alreadyFriends?: boolean };
      if (data.alreadyFriends) {
        setAddSuccess("Ihr seid bereits befreundet!");
      } else {
        setAddSuccess("Freund erfolgreich hinzugefügt!");
        setAddCode("");
        const updated = await fetch("/api/friends");
        if (updated.ok) {
          const updatedData = (await updated.json()) as { friendCode: string; friends: FriendInfo[] };
          setFriends(updatedData.friends ?? []);
        }
      }
    } catch {
      setAddError("Netzwerkfehler. Bitte erneut versuchen.");
    }
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
      if (res.ok) {
        setTelegramMsg(telegramChatId.trim() ? "Gespeichert! Du erhältst ab Sonntag wöchentliche Recaps." : "Telegram-Verbindung entfernt.");
      } else {
        setTelegramMsg("Fehler beim Speichern.");
      }
    } catch {
      setTelegramMsg("Netzwerkfehler.");
    } finally {
      setTelegramSaving(false);
    }
  }

  if (notLoggedIn) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-foreground">Freunde & Erfolge</h1>
        <p className="text-muted-foreground">
          Anmelden erforderlich, um Freunde hinzuzufügen und Erfolge zu verfolgen.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <p className="text-muted-foreground">Wird geladen…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <p className="text-destructive">{error}</p>
      </main>
    );
  }

  const unlockedIds = new Set(unlockedAchievements.map((a) => a.id));

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-10">
      <h1 className="text-2xl font-bold text-foreground">Freunde & Erfolge</h1>

      {/* ── Freunde ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Freunde
        </h2>

        {/* Dein Code */}
        <div className="mb-6">
          <p className="mb-1.5 text-sm font-medium text-foreground">Dein Code</p>
          <div className="flex items-center gap-3">
            <code className="rounded-lg border border-border bg-muted px-4 py-2 font-mono text-sm text-foreground">
              {friendCode}
            </code>
            <button
              onClick={handleCopy}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {copySuccess ? "Kopiert!" : "Kopieren"}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Teile diesen Code mit deinen Trainingspartnern.
          </p>
        </div>

        {/* Freund hinzufügen */}
        <div className="mb-6">
          <p className="mb-1.5 text-sm font-medium text-foreground">Freund hinzufügen</p>
          <form onSubmit={handleAddFriend} className="flex items-center gap-3">
            <input
              type="text"
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
              placeholder="Code eingeben…"
              className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Hinzufügen
            </button>
          </form>
          {addSuccess && <p className="mt-1.5 text-sm text-emerald-600 dark:text-emerald-400">{addSuccess}</p>}
          {addError && <p className="mt-1.5 text-sm text-destructive">{addError}</p>}
        </div>

        {/* Freundesliste */}
        {friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Freunde — teile deinen Code!</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((friend) => (
              <li key={friend.id} className="rounded-xl border border-border bg-background p-4 shadow-sm">
                <p className="mb-2 text-sm font-medium text-foreground blur-sm transition-all hover:blur-none">
                  {friend.email}
                </p>
                <p className="text-sm text-muted-foreground">🔥 {friend.currentStreak} Tage Serie</p>
                {friend.latestPrExercise && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Letzter PR:{" "}
                    <span className="font-medium text-foreground">{friend.latestPrExercise}</span>{" "}
                    {friend.latestPrValue !== null && (
                      <>{friend.latestPrValue} kg{friend.latestPrType ? ` (${friend.latestPrType})` : ""}</>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Telegram-Recap ──────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Wöchentlicher Telegram-Recap
        </h2>
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
            className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={telegramSaving}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {telegramSaving ? "…" : "Speichern"}
          </button>
        </form>
        {telegramMsg && (
          <p className="mt-1.5 text-xs text-muted-foreground">{telegramMsg}</p>
        )}
      </section>

      {/* ── Erfolge ─────────────────────────────────────────────────────── */}
      {achievementCatalog.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Erfolge ({unlockedAchievements.length}/{achievementCatalog.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {achievementCatalog.map((def) => {
              const unlocked = unlockedIds.has(def.id);
              const detail = unlockedAchievements.find((a) => a.id === def.id);
              return (
                <div
                  key={def.id}
                  className={`rounded-xl border p-4 text-center transition-all ${
                    unlocked
                      ? "border-border bg-card shadow-sm"
                      : "border-border/40 bg-muted/20 opacity-40 grayscale"
                  }`}
                  title={unlocked && detail ? `Freigeschaltet am ${new Date(detail.unlockedAt).toLocaleDateString("de-DE")}` : def.description}
                >
                  <div className="mb-1.5 text-3xl">{def.icon}</div>
                  <p className="text-xs font-semibold text-foreground leading-tight">{def.title}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{def.description}</p>
                  {unlocked && detail && (
                    <p className="mt-1 text-[10px] text-primary font-medium">
                      {new Date(detail.unlockedAt).toLocaleDateString("de-DE")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

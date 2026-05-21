"use client";

import { useEffect, useState } from "react";

interface FriendInfo {
  id: string;
  email: string;
  currentStreak: number;
  latestPrExercise: string | null;
  latestPrValue: number | null;
  latestPrType: string | null;
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
        // Reload friends list
        const updated = await fetch("/api/friends");
        if (updated.ok) {
          const updatedData = (await updated.json()) as {
            friendCode: string;
            friends: FriendInfo[];
          };
          setFriends(updatedData.friends ?? []);
        }
      }
    } catch {
      setAddError("Netzwerkfehler. Bitte erneut versuchen.");
    }
  }

  if (notLoggedIn) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <p className="text-muted-foreground">
          Anmelden erforderlich, um Freunde hinzuzufügen.
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Freunde</h1>

      {/* Dein Code */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Dein Code
        </h2>
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
        <p className="mt-2 text-xs text-muted-foreground">
          Teile diesen Code mit deinen Trainingspartnern.
        </p>
      </section>

      {/* Freund hinzufügen */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Freund hinzufügen
        </h2>
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
        {addSuccess && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">{addSuccess}</p>
        )}
        {addError && (
          <p className="mt-2 text-sm text-destructive">{addError}</p>
        )}
      </section>

      {/* Meine Freunde */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Meine Freunde
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Freunde — teile deinen Code!
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((friend) => (
              <li
                key={friend.id}
                className="rounded-xl border border-border bg-background p-4 shadow-sm"
              >
                <p className="mb-2 text-sm font-medium text-foreground blur-sm transition-all hover:blur-none">
                  {friend.email}
                </p>
                <p className="text-sm text-muted-foreground">
                  🔥 {friend.currentStreak} Tage Serie
                </p>
                {friend.latestPrExercise && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Letzter PR:{" "}
                    <span className="font-medium text-foreground">
                      {friend.latestPrExercise}
                    </span>{" "}
                    {friend.latestPrValue !== null && (
                      <>
                        {friend.latestPrValue} kg
                        {friend.latestPrType ? ` (${friend.latestPrType})` : ""}
                      </>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

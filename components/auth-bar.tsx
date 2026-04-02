"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, LogIn, LogOut, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type MeState =
  | { status: "loading" }
  | { status: "ready"; loggedIn: boolean; email: string | null };

type Props = {
  className?: string;
  onAuthChange?: (loggedIn: boolean) => void;
};

export function AuthBar({ className, onAuthChange }: Props) {
  const [me, setMe] = useState<MeState>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      const data = (await res.json()) as { loggedIn?: boolean; email?: string | null };
      const loggedIn = !!data.loggedIn;
      const em = typeof data.email === "string" ? data.email : null;
      setMe({ status: "ready", loggedIn, email: em });
      onAuthChange?.(loggedIn);
    } catch {
      setMe({ status: "ready", loggedIn: false, email: null });
      onAuthChange?.(false);
    }
  }, [onAuthChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "Login fehlgeschlagen.");
        return;
      }
      setPassword("");
      await refresh();
    } catch {
      setMsg("Netzwerkfehler.");
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "Registrierung fehlgeschlagen.");
        return;
      }
      setPassword("");
      await refresh();
    } catch {
      setMsg("Netzwerkfehler.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (me.status === "loading") {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="size-4 animate-spin" />
        Session …
      </div>
    );
  }

  if (me.loggedIn && me.email) {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <span className="text-foreground">
          Angemeldet als <span className="font-medium">{me.email}</span>
        </span>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden />
          Abmelden
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm",
        className,
      )}
    >
      <p className="text-muted-foreground">
        Für serverseitige Historie über Geräte:{" "}
        <code className="rounded bg-muted px-1">DATABASE_URL</code>,{" "}
        <code className="rounded bg-muted px-1">AUTH_SECRET</code> (≥32 Zeichen), dann Konto anlegen.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">E-Mail</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Passwort (min. 8)</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void login()}
          >
            <LogIn className="size-4" aria-hidden />
            Login
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void register()}
          >
            <UserPlus className="size-4" aria-hidden />
            Registrieren
          </Button>
        </div>
      </div>
      {msg ? <p className="text-destructive text-xs">{msg}</p> : null}
    </div>
  );
}

"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold text-foreground">
        Etwas ist schiefgelaufen
      </h2>
      <pre className="max-w-xl overflow-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left text-xs text-destructive">
        {error.message || String(error)}
        {error.digest ? `\n\nDigest: ${error.digest}` : ""}
      </pre>
      <button
        onClick={reset}
        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        Nochmals versuchen
      </button>
    </div>
  );
}

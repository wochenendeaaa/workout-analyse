export type ApiErrorContext = "analyze" | "replacement" | "pdf" | "calendar";

/** Deutsche Kurztexte zu API-`code`-Werten für die UI. */
export function userMessageForApiCode(
  code: string | undefined,
  serverMessage: string,
  meta?: { retryAfterSec?: number; context?: ApiErrorContext },
): string {
  const ctx = meta?.context ?? "analyze";
  switch (code) {
    case "MISSING_API_KEY":
      return "Server: API-Schlüssel fehlt. Bitte Betreiber kontaktieren.";
    case "BAD_REQUEST":
      return "Ungültige Anfrage. Bitte Seite neu laden und erneut versuchen.";
    case "NO_FILE":
      return "Keine Datei übermittelt. Bitte erneut eine PDF auswählen.";
    case "NOT_PDF":
      return "Nur gültige PDF-Dateien sind erlaubt.";
    case "EMPTY_FILE":
      return "Die Datei ist leer.";
    case "FILE_TOO_LARGE":
      return serverMessage.includes("MB")
        ? serverMessage
        : "Die PDF-Datei ist zu groß für diesen Server.";
    case "RATE_LIMIT":
    case "RATE_LIMITED": {
      const sec = meta?.retryAfterSec ?? 60;
      return `Zu viele Anfragen. Bitte in etwa ${sec} Sekunden erneut versuchen.`;
    }
    case "QUOTA":
      return "Das Gemini-Kontingent ist erreicht. Bitte später erneut versuchen oder Tarif prüfen.";
    case "API_KEY":
      return "API-Schlüssel ungültig oder gesperrt. Prüfe GEMINI_API_KEY in .env.local.";
    case "MODEL_NOT_FOUND":
      return serverMessage;
    case "PARSE_ERROR":
      return ctx === "replacement"
        ? "Die KI-Antwort zum Ersatz ließ sich nicht auswerten. Bitte erneut versuchen oder anderes Modell wählen."
        : "Die KI-Antwort ließ sich nicht auswerten. Bitte PDF erneut hochladen oder anderes Modell wählen.";
    case "EMPTY_MODEL_RESPONSE":
      return ctx === "replacement"
        ? "Keine nutzbare Ersatz-Antwort (Inhalt blockiert). Bitte erneut versuchen."
        : "Keine Auswertung möglich (Inhalt blockiert oder PDF unleserlich).";
    case "FILE_PROCESSING_FAILED":
      return "Die PDF konnte von der KI nicht verarbeitet werden.";
    case "FILE_TIMEOUT":
      return "Zeitüberschreitung bei der PDF-Verarbeitung. Kleinere Datei oder später erneut versuchen.";
    case "INTERNAL":
      return serverMessage || "Unbekannter Serverfehler.";
    case "BAD_JSON":
      return "Ungültiges JSON in der Anfrage.";
    case "BAD_BODY":
      if (meta?.context === "calendar") {
        return "Ungültige Kalender-Daten. Bitte Zeiten prüfen und erneut versuchen.";
      }
      if (meta?.context === "pdf") {
        return "Ungültige Daten für das Log-PDF. Bitte Ergebnis erneut laden und noch einmal versuchen.";
      }
      if (meta?.context === "replacement") {
        return "Anfrage ungültig (Übungsname fehlt oder Daten zu lang).";
      }
      return "Ungültige Anfragedaten.";
    case "PDF_BUILD":
      return "Das Log-PDF konnte nicht erzeugt werden. Bitte erneut versuchen.";
    case "GOOGLE_OAUTH_NOT_CONFIGURED":
      return "Google-Kalender ist auf dem Server nicht eingerichtet.";
    case "GOOGLE_CALENDAR_NOT_CONNECTED":
      return "Bitte zuerst „Google-Kalender verbinden“ ausführen.";
    case "GOOGLE_CALENDAR_INSERT_FAILED":
      return serverMessage || "Kalender-Eintrag fehlgeschlagen.";
    case "UNAUTHORIZED":
      return "Bitte zuerst anmelden.";
    default:
      return serverMessage || "Etwas ist schiefgelaufen.";
  }
}

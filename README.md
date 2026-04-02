# Workout-Analyse

Next.js-App: Handschriftliches Trainings-PDF hochladen, Auswertung und Vorschläge per Google Gemini.

## Voraussetzungen

- [Node.js](https://nodejs.org/) (LTS)
- Gemini-API-Key ([Google AI Studio](https://aistudio.google.com/apikey))

## Einrichtung

```bash
cp .env.example .env.local
```

`GEMINI_API_KEY` in `.env.local` setzen.

Optional: `GEMINI_MODEL` (Standard im Code: `gemini-2.5-pro`), Upload-Limits (`MAX_PDF_MB`, `NEXT_PUBLIC_MAX_UPLOAD_MB`), Rate-Limit (`RATE_LIMIT_*`), Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`), serverseitige Historie mit `DATABASE_URL` und `AUTH_SECRET` — siehe Kommentare in `.env.example`.

```bash
npm install
```

Mit SQLite-Historie (`DATABASE_URL` gesetzt):

```bash
npx prisma migrate dev
```

## Entwicklung

```bash
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## Produktion / Deploy (lokal)

```bash
npm run build
npm start
```

Für absolute Metadaten-URLs (Open Graph) optional `NEXT_PUBLIC_SITE_URL` auf die öffentliche Basis-URL setzen (z. B. `https://meine-domain.de`).

---

## Deployment (Handy / Tablet im Browser)

Die App ist eine normale **Webapp** unter **HTTPS** — kein App Store nötig. Kurzablauf:

### 1. Hosting wählen und Repo verbinden

- Empfehlung für Next.js: **[Vercel](https://vercel.com)** — GitHub/GitLab-Repo importieren, Framework **Next.js** wird erkannt (siehe [`vercel.json`](vercel.json)).
- Alternativen: Netlify, Railway, Render, eigener Server mit Node.js.

### 2. Umgebungsvariablen in der Hosting-Konsole

**Nicht** `.env.local` ins Repo legen. In den Projekteinstellungen (z. B. Vercel → Settings → Environment Variables) dieselben Variablen wie lokal setzen, mindestens:

| Variable | Hinweis |
|----------|---------|
| `GEMINI_API_KEY` | **Pflicht** für Analyse |
| `GEMINI_MODEL` | optional |
| `NEXT_PUBLIC_SITE_URL` | öffentliche URL, z. B. `https://xxx.vercel.app` (Metadaten/PWA) |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` / `MAX_PDF_MB` | an Body-Limit des Hosts anpassen (Vercel oft 4 MB ohne Anpassung) |
| `DATABASE_URL` | nur wenn du serverseitige Historie/Auth willst — siehe unten |
| `AUTH_SECRET` | nur mit DB + Auth (mind. 32 Zeichen) |
| Telegram, Rate-Limit | optional |

Nach dem Setzen: **Redeploy** auslösen, damit die Variablen greifen.

### 3. Datenbank-Strategie

| Variante | Wann |
|----------|------|
| **Ohne `DATABASE_URL`** | Historie nur im **Browser** (localStorage). Einfach auf Vercel, kein Postgres nötig. |
| **SQLite `file:./dev.db`** | gut **lokal**; auf **Vercel Serverless** keine zuverlässige persistente Datei — nicht empfohlen. |
| **PostgreSQL** (Neon, Supabase, Vercel Postgres, …) | Prisma-`datasource` auf `postgresql` umstellen, Migrationen gegen Prod, `DATABASE_URL` = Connection-String. |

Entscheidung: reicht Browser-Historie, oder brauchst du Login und Speicherung auf dem Server?

### 4. Smoke-Test auf dem Handy

Nach dem Deploy:

1. Öffentliche URL in **Safari** (iOS) oder **Chrome** (Android) öffnen.
2. PDF hochladen → Analyse abwarten.
3. **Log-PDF** erzeugen und speichern öffnen.
4. Optional: **„Zum Home-Bildschirm hinzufügen“** — durch [`app/manifest.ts`](app/manifest.ts) und Icons unterstützt (kein Offline-Zwang).

### 5. PWA (optional)

- [`app/manifest.ts`](app/manifest.ts) liefert das Web-App-Manifest (`/manifest.webmanifest`).
- [`app/icon.svg`](app/icon.svg) wird als Icon verwendet.
- Service Worker für echtes Offline ist für diese App nicht vorgesehen (API braucht Netz).

## Tests

```bash
npm run test
```

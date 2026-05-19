# Roadmap

Six PRs to take Workout-Analyse from "stateless upload-and-report" to "long-term training partner". Each PR is independently shippable and reviewable in one sitting. Vision lives in [PRODUCT.md](./PRODUCT.md).

## Why this order

The current app stores every analysis as a JSON blob (`WorkoutAnalysis.payload`). Until that changes, *nothing* about trends, PRs, or streaks is possible — you can't aggregate JSON blobs the way you can aggregate rows. So the data model goes first. The parser is hardened second so the rows we put in the new schema are clean. Then the trend engine is pure logic with no UI dependencies, so we build and test it in isolation. UI comes fourth because it consumes the engine. The dopamine layer comes last because it sits on top of trends and PRs and is the least useful without them. Polish is its own PR so nothing important hides behind "drive-by fixes".

---

## PR 0 — Product vision in the repo

**Goal:** Lock the agreed direction in a doc so future-Sev doesn't drift.

**Deliverables:** `PRODUCT.md`, this `ROADMAP.md`.

**Done when:** Both files are on `main` and link from the README.

---

## PR 1 — Data foundation

**Goal:** Move from `WorkoutAnalysis.payload: String` (JSON blob) to a relational schema we can actually query.

**New tables:**
- `User` — keep existing.
- `Session` — one per workout date. Has user, date, source PDF hash, raw Gemini response (for audit), and notes.
- `ExerciseCatalog` — canonical exercise list with name aliases (DE + EN). Seeded with ~150 common lifts.
- `ExerciseInstance` — one per exercise within a session (e.g. "Bench Press, third in session"). Links Session ↔ ExerciseCatalog.
- `SetEntry` — one per set. Weight, reps, RPE, notes, type (working/warmup/dropset/failure).
- `PersonalRecord` — denormalized for fast reads. Type (1RM estimate, true 1RM, rep PR), exercise, value, achieved-at, session reference.
- `StreakState` — per user. Current streak, longest streak, grace days remaining this month, last session date.

**Migration strategy:** Keep `WorkoutAnalysis` for backwards compat. Write a one-time migration that reads the JSON blobs and projects them into the new tables. Newly uploaded sessions write to both for one PR cycle, then `WorkoutAnalysis` is removed in PR 6.

**Database choice:** Move off SQLite-on-Vercel (broken on serverless). Choose Turso (libSQL, free tier, edge-ready) or Vercel Postgres free. Decision happens in this PR.

**Tests:** Schema-level — migrating a sample JSON blob produces the expected rows.

**Branch:** `pr/1-data-foundation`.

---

## PR 2 — Structured parser + golden tests

**Goal:** The Gemini call returns the same structured output every time, against the same input. No silent drift.

**Changes:**
- Strict Zod schema for the parser output: `ParsedSession { date, exercises: ParsedExercise[] }` where each `ParsedExercise` has a canonicalized name (matched against `ExerciseCatalog` with alias fuzzy-match) and a list of `ParsedSet { weight, reps, rpe?, notes?, type }`.
- System prompt rewrite with three to five few-shot examples drawn from real notebook photos.
- Unit normalization (kg/lbs, comma vs period decimal).
- Confidence flag per exercise; low-confidence ones surface for one-tap correction in the UI later.

**Golden tests:** Commit ~5 real (anonymized if needed) notebook PDFs as fixtures. A test reads each, calls the parser (with Gemini mocked using captured responses), and asserts the structured output matches a checked-in JSON snapshot. Regression-proof.

**Branch:** `pr/2-structured-parser`.

---

## PR 3 — Trend engine

**Goal:** All the analysis logic, with zero AI calls and 100% unit-test coverage.

**Pure functions in `lib/trends/`:**
- `e1RM(weight, reps)` — Epley and Brzycki formulas, return both, expose the higher.
- `weeklyVolume(sets, muscleGroupMap)` — total tonnage per muscle group per week.
- `detectPRs(newSession, history)` → `PR[]` — true 1RM PRs, e1RM PRs, rep PRs at fixed weight.
- `computeStreak(sessions, graceDaysPerMonth)` → `StreakState`.
- `suggestNextSession(history, exercise, scheme)` → `Suggestion` — progressive overload rules; flags deload if recent sessions show stalled e1RM + rising RPE.

**Tests:** Verify e1RM against published reference values. Property-based tests for streak math. Snapshot tests for `suggestNextSession` against curated histories.

**Branch:** `pr/3-trend-engine`.

---

## PR 4 — Dashboard rebuild

**Goal:** A mobile-first four-screen app that consumes PR 3's engine.

**Screens:**
1. **Today** — Upload zone (PDF or photo) at the top; below it, this-session-vs-last comparison for each exercise after parsing.
2. **Trends** — e1RM line per main lift over time; weekly volume by muscle group as stacked bars. Sticky filter chips.
3. **PRs** — The Hall. Newest at top; tap a PR for the session it came from.
4. **Next Session** — Per main lift, what to attempt next time. One-tap "send to Calendar" (the existing Google Calendar integration carries over).

The current single-page upload-and-report becomes a sub-view of "Today".

**Branch:** `pr/4-dashboard`.

---

## PR 5 — Dopamine layer

**Goal:** Make consistency feel rewarding.

**Features:**
- **PR confetti** — Real animation the moment a PR is detected on upload. Sound off by default.
- **Streak chip** — Always visible in the header. Tap → streak detail with grace days remaining.
- **Achievements** — A catalog of named milestones, each tied to a SQL-checkable condition. Notifications when unlocked.
- **Weekly Telegram recap** — Cron job (Vercel Cron) runs Sundays at 20:00 user-local. Builds the week's stats, asks Gemini Flash to write a 5-line motivating summary, sends via the existing Telegram bot. *On by default*; opt-out toggle in settings.
- **Friends** — Generate a friend code; pair via code exchange; friends see each other's PRs and streaks only.

**Branch:** `pr/5-dopamine`.

---

## PR 6 — Polish

**Goal:** Make the app cheap to run, fast to load, and easy for someone else to pick up.

**Changes:**
- **GitHub Actions CI:** lint + typecheck + test on every PR.
- **Gemini cost optimization:** Route to Flash by default; promote to Pro only when Flash confidence drops below a threshold. Cache parsed output by file hash (re-uploads cost zero tokens).
- **Image preprocessing:** Downscale to longest-edge 2048 px, deskew, contrast-stretch before sending to Gemini. Cuts cost and improves accuracy.
- **Drop the legacy `WorkoutAnalysis` table** now that everything reads from the new schema.
- **README rewrite + ARCHITECTURE.md.** A new contributor should be productive in 15 minutes.

**Branch:** `pr/6-polish`.

---

## How we'll work

For each PR I prepare files in your connected folder, run `npm run lint`, `tsc --noEmit`, and `npm test` in my sandbox, and only then walk you through `git checkout -b … && git add && git commit && git push` from your own terminal. You open the PR on GitHub. I can't push for you; you stay in control of what hits `main`.

If a PR turns out larger than expected mid-flight we split it; if smaller, we ship it early. The order above is the dependency graph, not a calendar.

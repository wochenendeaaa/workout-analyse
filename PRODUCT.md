# Workout-Analyse — Product Vision

> Your handwritten notebook becomes a long-term training partner that celebrates every improvement.

## What it is, in one paragraph

Workout-Analyse is a personal training assistant for one lifter (and a small ring of friends). You write your sessions on paper, snap or scan the page, and the app reads it. Over time it builds a memory of your training: every set, every lift, every PR. Each session you see what you just did versus your past self, get a concrete plan for the next session, and feel the small jolt of progress — streaks, PR confetti, weekly recaps — that makes coming back tomorrow obvious.

## North star

**Every session ends with the user knowing exactly what to do next time, and feeling proud about what they just did.**

If a change moves the needle on either side of that sentence — clarity about next session, or felt pride about this one — it's in. If not, it's a distraction.

## Who it's for

The primary user is the author and a small circle of training friends. Not a SaaS, not a coach-client tool, not a public marketplace. This constraint is load-bearing: it lets us skip multi-tenancy, billing, support tooling, GDPR exports, role-based access, and a dozen other items that would otherwise dominate the roadmap. Friends share via opt-in friend codes, nothing more.

## The core loop

1. **Train on paper.** No app required during the workout.
2. **Snap the page** when you get home, or while cooling down. Handwritten PDFs are the canonical input; typed entry is a fallback for when paper isn't handy.
3. **The app reads it.** Sets, reps, weights, exercises, notes — extracted into structured data via Gemini with a tight Zod schema and exercise-name canonicalization.
4. **You see the verdict, immediately:**
   - How today compares to your last session of the same lift.
   - Any PRs hit (with confetti).
   - Streak status.
   - One-screen "next session" plan: loads, reps, deload flags.
5. **You close the app feeling like training is working.**

## The dopamine layer

Long-term motivation is not a feature; it's the product. The features that serve it:

- **Hall of PRs.** Every personal record is preserved, dated, and surfaced. The first 100 kg bench gets a permanent shrine.
- **PR confetti.** A real, brief celebration the moment one is logged. Sound off by default.
- **Streaks with grace.** Sessions per week, with a small number of grace days per month so a sick week doesn't reset everything to zero. Streaks reward consistency, not perfection.
- **Achievements.** Discrete milestones tied to your numbers, not arbitrary points: "First 100 kg bench", "12 weeks consistent", "1 ton volume day".
- **Weekly recap, automatic.** Sunday 20:00 local time, the bot sends a short, AI-written summary to your Telegram: what you trained, what you PR'd, what to focus on next week. This is the single highest-leverage motivator and it's *on by default*.
- **Friends.** Opt-in friend codes share streaks and PRs only — no per-set comparison, no leaderboards. Soft accountability, nothing competitive enough to ruin a Monday.

## What we're explicitly not building

- Coach-client roles, multi-athlete dashboards, billing.
- Live in-session logging as the *primary* flow. Paper first; typed entry is the backup.
- A social feed, comments, follows, public profiles.
- Nutrition tracking, sleep tracking, body-comp tracking. We do one thing.
- A marketplace of programs. We support progressive overload and (later) one or two classic templates.
- Offline-first / full PWA offline. Net required; the app installs to home screen but isn't usable in airplane mode.

## Non-negotiables

- **Cheap to run.** Gemini Flash on the cheap path, Pro only when the page is genuinely hard. Cache parsed sessions by file hash so a re-upload costs zero tokens. Database tier stays free (Turso or Vercel Postgres free).
- **Trustworthy memory.** The data model is relational, not a JSON blob. Trends, PRs, and streaks must be queryable in SQL.
- **Mobile-first.** The phone is the primary device. Every screen passes the one-thumb test.

## Architecture in one breath

Next.js app → Gemini extracts structured sets → relational DB stores sessions → a pure-TypeScript trend engine computes e1RM, volume, PRs, streaks, and next-session suggestions → UI renders four views (Today / Trends / PRs / Next Session) → a cron job sends a weekly Telegram recap. The current Gemini wiring, Telegram bot, PWA, and auth all carry over. The data model and the dashboard are what get rebuilt.

## Success, after each PR

- **PR 1 lands** → I can query "show me every bench press I've done" in SQL.
- **PR 2 lands** → I can re-upload a PDF I uploaded last month and get the *same* structured output.
- **PR 3 lands** → `npm test` proves my e1RM math is right against published formulas.
- **PR 4 lands** → I open the app on my phone and see today vs. last time without scrolling.
- **PR 5 lands** → On a Sunday I get a Telegram message I actually want to read.
- **PR 6 lands** → A friend opens the repo, runs `npm install && npm run dev`, and sees the app working without reading the README twice.

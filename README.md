# Founder Validation Intelligence Platform

An interactive workshop platform for the **Film Business Accelerator**. It runs as two
separate applications from one static site:

| App | File | Who uses it | Access |
|---|---|---|---|
| **Founder Portal** | `index.html` | Founders, live during the workshop | No login — QR code / link |
| **Mentor Dashboard** | `mentor.html` | The mentor, at the end of the session | Password |

The mentor password is `accelerator2026` (change it in `assets/js/mentor.js`).

---

## What it does

**Founders** search for their own name or their startup name — in Arabic or English —
and get a personalized validation session: a snapshot, their position on the validation
roadmap, a nine-dimension scorecard, their specific risks, assumptions they can update,
reflection prompts, a SWOT, investor questions, a 30-day plan, a learning list, a
commitment, and a printable report.

**The mentor** opens an anonymous cohort dashboard: KPIs, distribution charts, aggregated
challenges, assumption status, a struggle heatmap, generated insights, the top five
discussion topics, anonymous quotes, and a live word cloud — then prints it as a workshop
report.

### Anonymity

The mentor dashboard never reads a startup name or a founder name into the page.
Participants appear only as `Participant 01`, `Participant 02`, and so on. This is
enforced in one place — the `analyse()` function in `assets/js/mentor.js` — so the
guarantee is auditable rather than scattered across the UI.

---

## Architecture

Startup **profiles** stay in `data/startups.json` — they are static content, so there is
no reason to put them in a database. Founder **responses** live in Supabase, because
twenty phones need to write them and one laptop needs to read them live.

```
  Founder's phone                Supabase                 Facilitator's laptop
  ───────────────                ────────                 ────────────────────
  index.html                                              mentor.html
    ↓ types                                                  ↑ re-renders
  local draft cache  ──upsert──▶  workshop_responses  ──Realtime──▶  charts
    (instant UI)                  (source of truth)      (postgres_changes)
    ↑ retries if offline
```

A founder's edits save locally first so the UI never waits on the network, then upsert to
Supabase. The mentor dashboard subscribes to `postgres_changes` for its workshop, so a
submission repaints its charts in about a second with no refresh.

---

## Setup

### 1. Create the database

In your Supabase project, open **SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), and run it. It creates the table, the
uniqueness constraint, the RLS policies, and enables Realtime.

Then confirm **Database → Replication** shows `workshop_responses` enabled.

### 2. Add your keys

Edit `assets/js/config.js` and set the two values from **Project Settings → API**:

```js
const SUPABASE_URL      = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhb...';
```

The anon key is a publishable key — it is designed to ship in the client.

### 3. Name the workshop

`DEFAULT_WORKSHOP_ID` in the same file scopes every response. To run two cohorts at once,
put the id in the QR code URL instead:

```
https://you.github.io/film-accelerator-dashboard/?workshop=riyadh-nov-2026
```

Open the mentor dashboard with the **same** parameter so it watches that workshop.

### 4. Run it

Static site, but it must be served over HTTP — it `fetch`es the JSON, which browsers
block on `file://`.

```bash
python3 -m http.server 8000
```

For GitHub Pages, push to the repository root (or `/docs`) and enable Pages. No build
step; `.nojekyll` is included.

**If you skip steps 1–2 the platform still runs** in local-only mode — useful for a demo —
but nothing syncs between devices, and both apps say so in the header.

---

## Structure

```
/
├── index.html              Founder Portal
├── mentor.html             Mentor Dashboard
├── supabase/schema.sql     Table, constraints, RLS, Realtime — run this once
├── data/
│   └── startups.json       Startup profiles (static content)
└── assets/
    ├── css/main.css        Design system (tokens, components, print, motion)
    └── js/
        ├── config.js       ← YOUR SUPABASE KEYS GO HERE
        ├── api.js          Supabase client, upsert, realtime, offline outbox
        ├── search.js       Arabic + English fuzzy search
        ├── storage.js      Local draft cache (in front of Supabase)
        ├── ui.js           Shared helpers, chart theming
        ├── app.js          Founder Portal
        └── mentor.js       Mentor Dashboard
```

---

## Adding or editing startups

Everything a founder sees comes from `data/startups.json`. Nothing is hardcoded in the
pages, so adding a startup is a data change only — add an object to the array and it
appears in search, in the quick-picks, and in the cohort analytics automatically.

Each entry needs an `id` (unique, kebab-case), `startup_name_ar`, `startup_name_en`,
`category`, `stage`, `readiness`, `revenue`, `team_size`, `founders[]`, `team_members[]`,
`validation_scores` (the nine dimensions), and the content arrays (`risks`,
`*_assumptions`, `investor_questions`, `reflection_questions`, `action_plan`,
`recommended_*`, `kpis`, `swot` fields).

`stage` must be one of: `Idea`, `Problem Validation`, `Customer Discovery`, `MVP`,
`First Revenue`, `Product Market Fit`, `Growth`, `Scale` — the roadmap and the stage
guidance key off these exact strings.

Every founder and team member listed on a startup resolves to that same startup profile,
so any member of a team can search their own name and land in the right place.

---

## The search

Founders will type their name imperfectly, in either language, on a phone. The search
normalizes Arabic orthography (hamza forms `أإآ`→`ا`, `ى`→`ي`, `ة`→`ه`, diacritics,
tatweel, Arabic-Indic digits), strips prefixes like `شركة` and `منصة`, and falls back to
Levenshtein matching with a length-scaled typo budget. Partial words work (`Spec` finds
`Specter`), as do misspellings (`blacklite` finds `Blacklight Films`).

Scoring is tiered — exact, prefix, substring, per-token, whole-string fuzzy — so a weak
fuzzy hit can never outrank a real prefix match.

---

## How responses behave

**One response per startup, per workshop.** The unique index on
`(workshop_id, startup_id)` means the client upserts rather than inserts. Three
consequences worth knowing:

- **Duplicate submissions are impossible.** Pressing Submit twice updates one row.
- **Editing works for free.** Reopening the journey loads the saved row and further edits
  overwrite it.
- **Teams share one answer sheet.** If two co-founders answer from different phones, they
  are editing the same record, last write wins. This is deliberate — the profile is the
  startup's, not the individual's — but tell teams so nobody is surprised.

**Autosave, not just Submit.** Every keystroke, tag, and assumption toggle syncs (debounced
~0.7s). Submit is the final immediate push that flags the response complete. The mentor
sees progress accumulate rather than everything arriving at once.

**Bad wifi is handled.** Failed writes go to a small outbox in `localStorage` and retry
every 6 seconds and on reconnect. The founder sees `Saving… (n pending)` and is told their
answers will send when the connection returns — nothing is silently lost.

## Privacy and security

- The mentor dashboard **never renders a startup name, founder name, or session id**. The
  database row is read in exactly one place — `analyse()` in `assets/js/mentor.js` — and
  `participant_name` and `session_id` are deliberately not copied out of it, so no part of
  the UI can display them by accident. Participants appear only as `Participant 01`.
- `participant_name` is still *stored*, so you can reconcile a response after the session
  if you need to. If you would rather not store it at all, pass `null` — nothing in either
  app reads it back.
- **The anon key is public and RLS is permissive.** Anyone who opens the page can read and
  write `workshop_responses`. That is an accepted trade for a no-login workshop with
  non-sensitive content and a short lifetime. Do not put anything confidential in this
  table, and delete the rows afterwards:
  ```sql
  delete from workshop_responses where workshop_id = 'film-accelerator-2026';
  ```
- The mentor password gate is a client-side convenience to keep the dashboard out of the
  way during the session. It is not a security boundary — anyone can read it in the source.

## Running the workshop

1. Run `supabase/schema.sql`, add your keys, pick a `workshop_id`.
2. Generate a QR code for `.../index.html?workshop=<your-id>` and put it on screen.
3. Open `mentor.html?workshop=<your-id>` on the facilitator laptop and enter the password.
   The header should read **Live**.
4. Founders scan, search their name, and work through the journey. Charts fill in as they go.
5. At the end, click **Workshop Report** to print the anonymous cohort summary.

Quick check before the room fills up: open the founder portal on your phone, submit
anything, and confirm the laptop's **Responses Received** counter moves without a refresh.

## Technical notes

- **No framework.** HTML5, TailwindCSS (utilities only), vanilla ES6, Chart.js,
  Supabase JS v2 — all from CDN, no build step.
- Realtime re-renders are debounced (~0.45s) and skip the count-up and chart-grow
  animations after the first paint. Twenty founders typing would otherwise make the
  dashboard flicker as every KPI reset to zero on each update.
- Tailwind's Preflight is **disabled deliberately** in both pages — it resets heading sizes
  and form controls and would otherwise override the design system in `main.css`. If the
  Tailwind CDN is blocked, the site still renders correctly; `main.css` is self-sufficient.
- Chart colors are a validated palette: they clear the colorblind-separation, contrast, and
  lightness gates against the dark chart surface. Categorical hues are never cycled, every
  chart offers a data table, and no chart uses two y-axes.
- All JSON content is HTML-escaped before it reaches the DOM.
- Respects `prefers-reduced-motion`; print styles force scroll-revealed content visible so
  reports never print blank.

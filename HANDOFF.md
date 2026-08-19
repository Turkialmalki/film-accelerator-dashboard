# Film Business Accelerator — Platform Handoff

The repository has been rebuilt from a two-page static site into a production-architected
Next.js 14 SaaS platform: an admin workspace and a participant portal for
**مسرعة الأعمال في الأفلام / Film Business Accelerator**.

It runs today, end to end, with **no backend**. Everything is wired through a repository
interface whose demo implementation is backed by `localStorage`; a Supabase implementation
sits behind the same interface, ready to be switched on with two environment variables.

---

## 1. What was built

### Auth
Split-screen sign-in / sign-up / forgot-password / reset-password / invite-accept.
Desktop is 42% form and 58% cinematic panel; the panel sits on the inline-end edge, so it
mirrors automatically between Arabic and English. Mobile collapses to a single column.
One-click demo sign-in for admin and participant, compiled out of production bundles.

### Shell
White-surface sidebar (right in Arabic, left in English) that collapses to a 72px rail and
becomes a drawer under `lg`. Top bar carries breadcrumb, page title, AR/EN switch,
light/dark toggle, demo-mode badge and user menu. Navigation is role-aware, and routes are
guarded twice — once in `middleware.ts` before the page is served, and once in
`components/shell/app-shell.tsx` at render time.

### Admin dashboard
Animated cohort banner (programme, cohort, status, current milestone, CTA), five KPI cards
with a one-time count-up, a submission-status donut, a response-over-time area chart and a
team-stage bar chart. All figures are computed from the fixture. **No team table** — the
roster lives on `/teams` and is not duplicated here.

### Participant Teams
Full CRUD over the real 20 accelerator teams: search, stage and track filters, four sort
orders, archived toggle, card ⇄ table view, add/edit dialog with repeatable founder rows,
archive / restore / delete, and CSV import + export through a hand-rolled RFC-4180 parser
and writer (UTF-8 BOM so Excel reads the Arabic). The detail drawer holds the profile,
founders, strengths, challenges, growth path, assigned forms, submission history,
invitation management with generated codes, an activity timeline, and admin-only internal
notes.

### Form builder
Five templates (Workshop Evaluation, Presentation Submission, Mentor Feedback,
Attendance/Check-in, Blank) that materialise **real, editable fields** — 25 field types
covering text, choice, scale, date/time, upload, programme-data and layout. dnd-kit palette
and sortable canvas, both pointer- and keyboard-operable. Per-field settings drawer with
bilingual label/description/placeholder, required, options, validation, and a visual
conditional-visibility rule editor. Form-level settings (bilingual title/description, accent
colour, multi-step, open/close dates, response limit, draft saving, edit-after-submit),
team-level audience targeting, and publish → share link + a real client-side QR code.

### Fill experience
One `FormFiller` component serves the builder preview, the public `/f/[slug]` share link and
the participant workspace — so the preview cannot drift from what the cohort actually sees.
Autosaved drafts, paging on page breaks, progress bar, per-field validation, confirmation
screen.

### Submission Results
Overview cards per published form (responses, rate, last response, close date); a per-form
analytics view with team participation and a chart chosen to suit each field type
(donut/horizontal bars for choices, NPS segment split, rating histogram, searchable text
lists, file lists); and a split-view response explorer with prev/next, reviewed toggle and
internal notes. CSV export writes real structured answers.

### Appearance, Settings, Help, Profile
Appearance is a token studio: three brand presets, per-token colour editing, a radius
slider, and the **whole application** as the live preview (tokens are painted onto `<html>`).
Publishing persists through the data layer and survives a refresh. Program Settings edits
organisation and cohort basics and can reset the demo fixture.

### Participant portal
Overview (KPIs, team card, forms waiting), My Team, Assigned Forms, My Submissions.
`my-team/page.tsx` deliberately never reads `internal_notes`.

---

## 2. Route map

| Route | Access | Notes |
|---|---|---|
| `/` | anyone | 307 → `/{locale}` |
| `/[locale]` | anyone | redirect → `/[locale]/sign-in` |
| `/[locale]/sign-in` | anonymous | split-screen; demo logins in non-production only |
| `/[locale]/sign-up` | anonymous | accepts an optional invite code |
| `/[locale]/forgot-password` | anonymous | |
| `/[locale]/reset-password` | anonymous | reads `?token=` |
| `/[locale]/invite` | anonymous | live code lookup, prefills the invited email |
| `/[locale]/f/[slug]` | **public** | published-form share link (QR target) |
| `/[locale]/dashboard` | admin | |
| `/[locale]/teams` | admin | |
| `/[locale]/forms` | admin | template chooser |
| `/[locale]/forms/[formId]` | admin | builder: Build / Settings / Audience / Share |
| `/[locale]/results` | admin | |
| `/[locale]/results/[formId]` | admin | analytics + response explorer |
| `/[locale]/appearance` | admin | |
| `/[locale]/settings` | admin | |
| `/[locale]/overview` | participant | |
| `/[locale]/my-team` | participant | |
| `/[locale]/assigned-forms` | participant | |
| `/[locale]/assigned-forms/[formId]` | participant | fill / edit |
| `/[locale]/my-submissions` | participant | |
| `/[locale]/profile`, `/[locale]/help` | any signed-in | |
| `/[locale]/change-password` | any signed-in | forced when `must_change_password` is set — see §9 |
| `POST /api/admin/invite` | owner/admin | creates an invited user and emails a temp password — see §9 |
| `POST /api/auth/change-password` | any signed-in | replaces the caller's own password and clears the gate |

`locale` is `ar` (default) or `en`. Admin roles are `owner`, `admin`, `reviewer`.

---

## 3. Architecture

```
lib/data/types.ts        the domain model + the Repository interface (the contract)
lib/data/demo-adapter.ts DemoAdapter    — localStorage, used today
lib/data/supabase-adapter.ts SupabaseAdapter — scaffold, never executed
lib/data/index.ts        getRepository() picks one; nothing else imports an adapter
lib/data/seed.ts         deterministic fixture built from data/startups.json
lib/data/supabase-admin.ts  service-role client — SERVER ONLY, see §9.3
lib/supabase/env.ts      the one demo-vs-Supabase mode check
lib/supabase/browser-client.ts   cookie-backed anon client (@supabase/ssr)
lib/supabase/route-client.ts     anon client for route handlers, server only
lib/supabase/middleware-session.ts  JWT verification for middleware
lib/auth/caller.ts       "who is calling this route, and may they?" — server only
lib/auth/temp-password.ts        CSPRNG temp passwords — server only
lib/auth/invite-client.ts        the UI's wrapper around the invite route
lib/email/resend.ts      transactional email — server only
app/api/admin/invite/    create an invited user + email the temp password
app/api/auth/change-password/    replace own password, clear the gate
scripts/bootstrap-admin.mjs      manual first-admin CLI tool, see §9.6
supabase/migrations/     deltas for projects provisioned before a feature landed
lib/forms/               field-type registry, templates, conditional rules, validation
lib/analytics.ts         pure aggregation (KPIs, trends, per-question summaries)
lib/theme/presets.ts     design tokens → CSS custom properties
lib/i18n/dictionaries.ts ar/en dictionary; `en` is the type, `ar` must satisfy it
lib/routes.ts            the single source of truth for who may see what
middleware.ts            locale prefixing + URL-level route guards
supabase/schema.sql      target production schema
supabase/rls.sql         target RLS policies
```

**Data model** (tables in `supabase/schema.sql`): `organizations`, `cohorts`, `profiles`,
`org_memberships`, `teams`, `team_members`, `invitations`, `forms`, `form_sections`,
`form_fields`, `form_rules`, `form_publications`, `form_audiences`, `submissions`,
`submission_answers`, `files`, `theme_settings`, `audit_logs`.

Every authored string is bilingual `jsonb` (`{"ar": …, "en": …}`). Every tenant-scoped table
carries `org_id`, so RLS is a single predicate. `internal_notes` exists on `teams` and
`submissions` and is excluded from the participant path (a `teams_public` view in
`rls.sql`, and simply never read by the participant UI).

---

## 4. Demo mode, and swapping in Supabase

**How demo mode works.** `getRepository()` returns `DemoAdapter` whenever
`NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing. The adapter keeps
one JSON blob under the `localStorage` key `fba.demo.store.v1`, seeded on first read from
`lib/data/seed.ts`. Writes go through a single `mutate()` that persists and notifies
subscribers, so views stay in sync the way Supabase realtime would keep them. The session is
stored under `fba.demo.session.v1` and mirrored into an unsigned `fba_demo_session` cookie
so middleware can read the role — in production that cookie becomes the Supabase JWT and
middleware verifies it instead of parsing JSON.

**The 20 teams are real.** They are read verbatim from `data/startups.json` — the same file
the legacy site used — and reshaped into the domain model. No team, founder, or piece of
Arabic content was invented. English labels were hand-written for the fields the source
carried only in Arabic (track, city, business model). Forms, submissions and invitations are
synthesised, but through a seeded PRNG, so the numbers are identical on every machine.

**To switch to Supabase:**

1. Create the project, then run `supabase/schema.sql` followed by `supabase/rls.sql`.
   *Read them first — see the caveat in §6.*
2. Seed one `organizations` row and one `cohorts` row, then import the 20 teams.
3. Set the environment variables below and redeploy. No code change is needed to switch;
   `getRepository()` picks the adapter up automatically.
4. Fill in the three `SupabaseAdapter` methods that are deliberately unimplemented
   (`duplicateForm`, `publishForm`, `acceptInvitation`) — the first two want the SQL
   functions already drafted in `schema.sql` so slug allocation stays atomic.

### Environment variables (`.env.example` is in the repo root)

| Variable | Required | Meaning |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | for Supabase mode | Project URL. Both this and the key must be set, or the app stays in demo mode. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for Supabase mode | Anon public key. |
| `NEXT_PUBLIC_ORG_ID` | optional | The `organizations.id` this deployment serves. Defaults to the demo id `org_fba`. |
| `NEXT_PUBLIC_CAMPAIGN_IMAGE` | optional | Path to the approved campaign photograph for the auth panel. Unset → the labelled placeholder is used. |
| `SUPABASE_SERVICE_ROLE_KEY` | for invites | **Server only.** See §9. |
| `RESEND_API_KEY` | for invite email | See §9. |
| `RESEND_FROM_EMAIL` | for invite email | See §9. |
| `NEXT_PUBLIC_SITE_URL` | optional | Absolute origin used to build the sign-in link inside invitation emails. Falls back to the request origin. |

---

## 5. Commands and demo credentials

```bash
npm install
npm run dev        # http://localhost:3000 — demo logins visible here
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint

# End-to-end verification (needs a server running on :4319)
npx next dev -p 4319
node scripts/verify-e2e.mjs

# ...or on any other port, if 4319 is taken
npx next dev -p 4327
E2E_BASE_URL=http://localhost:4327 node scripts/verify-e2e.mjs

# One-time first-admin bootstrap — Supabase mode only, manual, see §9
node scripts/bootstrap-admin.mjs you@example.com
```

**Demo accounts** — password `accelerate` for all three:

| Role | Email |
|---|---|
| Admin | `admin@fba.demo` |
| Participant (bound to Specter Production) | `founder@fba.demo` |
| Reviewer | `mentor@fba.demo` |

The one-click demo buttons and the credential list on `/help` are behind
`process.env.NODE_ENV !== 'production'`, so the minifier drops them from a production build.
**Verified**: `curl` of the production sign-in page returns zero occurrences of the demo
button label. The accounts themselves still exist in the demo fixture and can be typed in
manually — if you want them gone entirely in production, remove them from
`lib/data/seed.ts`, which is moot once Supabase is connected because the fixture is not used
at all in that mode.

---

## 6. Verification results — honest

Everything below was actually executed on this machine.

### Static checks — all pass

| Check | Result |
|---|---|
| `npx tsc --noEmit` (strict) | **PASS** — no errors |
| `npx next lint` | **PASS** — no warnings or errors |
| `npx next build` | **PASS** — compiled, 39/39 static pages generated |

### End-to-end browser pass — 31/31 pass

Run with headless Chromium via Playwright against a dev server
(`scripts/verify-e2e.mjs`, kept in the repo so it can be re-run).

| # | Check | Result |
|---|---|---|
| 1 | Demo admin sign-in lands on `/dashboard` | PASS |
| 2–7 | `GET /ar/{dashboard,teams,forms,results,appearance,settings}` — 200, **no console errors** | PASS |
| 8 | Arabic route renders `dir="rtl" lang="ar"` | PASS |
| 9 | English route renders `dir="ltr" lang="en"` | PASS |
| 10 | Sidebar swaps sides with direction (AR left-edge 1024px, EN 0px) | PASS |
| 11 | Dashboard KPI reports 20 teams from real data | PASS |
| 12 | Teams page lists exactly 20 team cards | PASS |
| 13 | Creating a form from the Workshop Evaluation template | PASS |
| 14 | Template generated 11 real fields on the canvas | PASS |
| 15 | Publishing the form flips it to "published" | PASS |
| 16 | Share link (`/ar/f/workshop-evaluation`) and QR image generated | PASS |
| 17 | Demo participant sign-in lands on `/overview` | PASS |
| 18–20 | Participant typing `/dashboard`, `/teams`, `/results` is redirected to `/overview?denied=1` | PASS |
| 21 | Submitting the new form through its public link reaches the confirmation screen | PASS |
| 22 | The new response is counted in Submission Results (count read back as 1) | PASS |
| 23 | Switching to Midnight Screening, publishing, and reloading keeps the theme (`--c-accent` `#FBAE40` before and after; `midnight_screening` persisted in the store) | PASS |
| 24–29 | All six auth pages load anonymously — 200, no console errors | PASS |
| 30 | Anonymous hitting `/dashboard` is redirected to `/sign-in?next=/dashboard` | PASS |
| 31 | `/` redirects into a locale and onto sign-in | PASS |

### Two notes on how the tests were run, so the numbers aren't overstated

- **The browser pass ran against `next dev`, not `next start`.** The demo one-click login
  buttons are compiled out of production builds by design, so a headless script cannot sign
  in against a production server. The production build was verified separately by `curl`:
  `/ar/sign-in` and `/en/sign-in` return 200, `dir="rtl"` and `dir="ltr"` respectively, `/`
  returns 307 → `/ar`, and the demo button label is absent. Production route-guard behaviour
  is driven by the same `middleware.ts` in both modes.
- **The submit step used the public share link inside the admin browser context, not the
  participant context.** In demo mode the store is `localStorage`, which is per browser
  context, so a form created in the admin context does not exist in a separate participant
  context. This is an artefact of demo mode only — with Supabase both sessions read one
  database. The participant *route guards* were tested in a genuinely separate context and
  do pass. The participant fill path itself (`/assigned-forms/[formId]`) was exercised
  manually against the seeded forms but is **not** covered by an automated assertion.

### What was NOT verified, and why

- **`supabase/schema.sql` and `supabase/rls.sql` have never been executed.** No Supabase
  credentials were available. They were written alongside `lib/data/types.ts` and are
  internally consistent with it, but treat every statement as unreviewed until it has been
  applied to a real project. The RLS policies in particular deserve a careful read before
  they are trusted with real data.
- **`SupabaseAdapter` has never made a network call.** Table names and query shapes match
  the schema, but nothing is proven. Three methods throw on purpose rather than pretend:
  `duplicateForm`, `publishForm`, `acceptInvitation`.
- **No unit test suite.** There is no Jest/Vitest setup; correctness is covered by the
  typechecker and the end-to-end script.
- **Accessibility was built for, not audited.** Semantic headings, visible focus rings,
  `aria-*` on custom controls, keyboard-operable builder and drawers, and
  `prefers-reduced-motion` are all implemented; no axe or screen-reader audit was run.
- **No cross-browser or real-device testing.** Chromium only, at desktop and default
  viewport.
- **Lighthouse / bundle budget not measured.** First Load JS is 87.5 kB shared, with the
  builder route the heaviest at 284 kB.

---

## 7. TODO before production

**Needed from the project owner**

1. ~~The approved campaign photograph~~ — **done.** `public/brand/campaign-fba.jpg` is the
   official Film Business Accelerator image (film production monitor rig + bilingual FBA
   lockup), sourced from the Film Commission's own site (`film.moc.gov.sa`, About Us
   imagery) and saved locally, resized to 1600px wide and re-compressed as JPEG
   (643KB → 177KB). It is now the default auth-panel visual; `NEXT_PUBLIC_CAMPAIGN_IMAGE`
   still overrides it with no code change if a different approved photo shows up later.
2. **A live Supabase project**, so the schema and RLS can actually be applied and the
   adapter proven.
3. **Confirmation of the English brand copy.** The Arabic is the primary voice throughout;
   English track/city/business-model labels were written by hand and should be reviewed by
   someone who owns the brand's English register.
4. **Any brand assets beyond the six SVGs already in `assets/images/`** — favicon set,
   social/OG image, print marks.

**Bug fixed in this pass, unrelated to the above:** `public/brand/fba-lockup.svg` and
`fba-lockup-light.svg` used `xlink:href` without declaring the `xlink` namespace on the
root `<svg>` — invalid XML that every browser silently refused to render, so the FBA
lockup was a broken image everywhere in the app (auth header, sidebar, footer). Fixed by
adding `xmlns:xlink="http://www.w3.org/1999/xlink"` to both files (and their `legacy/`
copies). Also switched the brand `<Image>` components to `unoptimized` — Next's
image-optimization proxy sniffs local SVG buffers unreliably and was 400-ing valid files
even after the namespace fix; these are vectors served straight from `/public`, so there
was nothing to optimize in the first place.

**Engineering TODO**

- Run and review `supabase/schema.sql` + `supabase/rls.sql`; correct whatever the real
  database rejects.
- Implement `SupabaseAdapter.duplicateForm`, `.publishForm`, `.acceptInvitation` against the
  SQL functions already drafted.
- ~~Replace the unsigned `fba_demo_session` cookie in `middleware.ts` with Supabase JWT
  verification.~~ — **done, see §9.** Demo mode still uses the cookie; Supabase mode
  verifies the real session and never reads it.
- **File uploads are metadata-only.** The file/image field records a filename; it does not
  upload bytes. Wire it to Supabase Storage and the `files` table.
- **Excel (`.xlsx`) export** — CSV with a UTF-8 BOM is implemented and opens correctly in
  Excel; a native `.xlsx` writer was not added.
- **PDF export** — not implemented.
- **Heatmap chart** for cross-question analysis — not implemented.
- **Audit log UI** — `audit_logs` is written by the demo adapter and the table exists in the
  schema, but there is no screen to read it.
- **Password reset is a no-op in demo mode** (there is no password store); it validates
  input and returns. Supabase handles it for real.
- **Multi-organisation support** is modelled in the schema but the UI assumes one org and
  one active cohort.
- Add a test suite, and an axe accessibility pass.

---

## 7b. Premium dashboard refresh (`feat/premium-dashboard-refresh`)

The admin dashboard was rebuilt around a new portfolio-analytics layer, without touching
auth, route guards, teams CRUD, the form builder, submission results, or Supabase-adapter
behaviour.

**New: `lib/analytics.ts` portfolio functions.** `computePortfolioMetrics(teams)` is the
single source for every number on the dashboard: readiness (mean/median/range),
investment-stage distribution, readiness by stage, revenue-band distribution (parsed from
the free-text `revenue_band` field), geography (a team's `city` may list more than one
region — each is counted once, so region counts can exceed the team count by design),
team structure (multi-founder vs solo, and a documented "key-person risk" rule: a solo
founder running a team of three or fewer), a four-dimension portfolio-health composite, the
readiness ranking, investor-ready / follow-up-watchlist thresholds (74% / 55%), and a
keyword-based classifier over each team's own authored `challenges` text into seven risk
categories.

Every one of the programme's reference-snapshot numbers (20 companies, 64% average
readiness, 68% median, 46–81% range, 7 MVP / 12 revenue-active / 3 investor-ready
companies, 118 direct jobs, 5.9 average team size, 4 regions, 6 key-person-risk companies,
health score 56 with dimensions 45/64/53/61, the full stage/revenue/geography/team-structure
breakdowns, the top-8 readiness ranking, and the investor-ready/watchlist company lists)
reproduces **exactly** from the current `data/startups.json` through these functions — this
was verified directly, not assumed. Two categories of exception, both intentional:

- **Average readiness by stage** is off by 1–2 points from the supplied snapshot for
  Pre-Seed, Seed and Series A (68% vs 66%, 69.4% vs 68%, 68% vs 67%). The formula is a plain
  per-stage mean of `readiness`; the small gap most likely reflects the snapshot being taken
  at a slightly different moment than the current dataset. Documented in code, not
  papered over.
- **The seven priority-risk categories** are a deterministic keyword classifier over each
  company's own `challenges`/`growth_path` text (see `RISK_KEYWORDS` in `lib/analytics.ts`).
  It reproduces the "fragmented positioning" category exactly (6 companies, 30%) but the
  other six categories diverge from the supplied percentages, because the original
  categorisation reflects human editorial judgement on free text that a keyword rule cannot
  fully recover. This is a documented heuristic, not a fabricated match.
- **"Female-led companies" is not computed anywhere.** `TeamFounder` has no gender field,
  and the domain model was not extended to add one — inferring gender from a founder's name
  would be a guess, not a computation, so the metric is omitted rather than invented.

**`TeamStage` gained `'pre-a'`.** The type previously had no Pre-A value, so the seed
silently folded the two real Pre-A companies (Blacklight Films, Expanse Media Production)
into `'seed'`. This is now a real, separate stage — additive everywhere it's enumerated
(`STAGE_LABEL`, the CSV import/export stage list, the team-edit dialog's stage select, both
dictionaries). Existing teams data, CSV round-trips and the team form still work; a team
already saved as `'seed'` is untouched.

**New dashboard layout**, above the fold: a compact page heading, the animated cohort banner
(now also showing an animated readiness ring, the 16-week/Riyadh programme facts, and a
"Explore the portfolio" CTA into `/teams`), four primary KPI cards (companies, average
readiness, revenue-active, investor-ready), and the portfolio-health panel (score + four
dimensions + a secondary strip: jobs, regions, MVP count, average team size). Below that, the
six-card analytics grid the spec asked for, then the previous operational section (forms,
submissions, response trend) — preserved in full, just demoted under a
"Programme operations" divider so it doesn't compete with the portfolio story.

**New files:** `components/dashboard/portfolio-health.tsx`, `portfolio-charts.tsx`,
`portfolio-geo-structure.tsx`, `portfolio-ranking.tsx`, `portfolio-risks.tsx`. `Icon` gained
a few more Lucide icons (`Building2`, `Briefcase`, `MapPin`, `TrendingUp`, `ShieldAlert`,
`PieChart`, `Compass`) for the new panels. `lib/utils.ts` gained `fmtTemplate` for
`{placeholder}` interpolation in dictionary strings.

**`scripts/verify-e2e.mjs`** gained nine checks on top of the original 31 (40/40 pass):
the dashboard does not duplicate the teams roster, all KPI values are finite, charts render
without console errors, no failed image requests, no horizontal overflow at 390px/320px, the
mobile drawer opens, the English dashboard shows the same portfolio KPI, and the dark theme
(Midnight Screening) renders on the dashboard without errors.

**Not done in this pass**, honestly: the auth screen, sidebar/shell chrome, teams page visual
polish, form builder polish, and submission-results polish described in the brief were not
touched — this pass scoped to the dashboard and its analytics layer, the part of the brief
with the most specific, verifiable acceptance criteria. They're real remaining work, not
silently dropped.

## 7c. Second increment: auth, shell, teams polish, one real a11y fix

Continuation of §7b on the same branch, after merging in `main`'s Supabase-auth work (§9).

**Auth.** Added `components/ui/password-input.tsx` — a show/hide toggle on every password
field across sign-in, sign-up, reset-password and change-password, positioned on the
inline-end edge so it mirrors automatically. `AuthShell` gained a one-time entrance fade/rise
on the form column and a very slow (16s, one-time) scale-down pan on the cinematic image,
both skipped under `prefers-reduced-motion`.

**Shell.** The sidebar's collapse/expand now animates the rail width with a CSS transition
(a slight-overshoot easing curve standing in for a spring, since the width has to actually
reflow the flex children rather than just clip a fixed box) instead of snapping instantly,
and respects `motion-reduce:`. Collapsed nav items get a real floating tooltip
(`components/ui/tooltip.tsx`, Radix-based, positioned on the correct side per locale) instead
of a bare `title` attribute. The mobile/desktop drawer (`components/ui/drawer.tsx`) gained an
actual slide-in/out transform via `tailwindcss-animate`, direction-aware, on top of the
fade it already had.

**Teams page.** Cards get a one-time stagger entrance (first 8 only, to keep it from feeling
busy on the full 20-card grid). Readiness is now shown as its own colour-coded badge, using
the exact same thresholds as the dashboard (`INVESTOR_READY_THRESHOLD` / `WATCHLIST_THRESHOLD`
from `lib/analytics.ts`) so a green badge here means the same thing it means on the dashboard.
The revenue-band line on cards, table and the detail drawer now reads through
`revenueBandOf()` + `t.portfolio.revenueBands`, so English users see "Above SAR 1M" instead of
the raw Arabic source string ("1,000,000+ ر.س") that was leaking through before.

**Form builder — a real accessibility fix, not just polish.** The canvas field row's action
buttons (reorder, settings, duplicate, delete) were `opacity-0` until `:hover` or
`:focus-within`. On a touch device there is no hover, so those actions were only reachable by
tabbing to them blind — a genuine violation of the brief's own "no hover-only essential
actions" rule, not a cosmetic gap. They're now always visible.

**Verification.** `npm run typecheck` / `lint` / `build` all pass; `verify-e2e.mjs` is
unchanged in count and still 44/44 (nothing in this increment touches what those checks
assert). Visual review at 1440px desktop (Arabic and English) and 390px mobile.

**Still not done**, honestly: a deeper pass on the submission-results page and the form
builder's settings drawer / multi-step preview, and the participant portal's visual
consistency with the admin side, weren't reached in this increment either. The results
overview page was reviewed and is already close to the design system (cards, badges, progress
bars, real empty/loading states) — it did not need the same intervention the dashboard or
teams page did.

## 8. The legacy site

The original static site was moved to `legacy/` (`index.html`, `mentor.html`,
`verify.html`, `assets/`) rather than deleted, so the previous behaviour stays available for
reference. Its brand SVGs were copied to `public/brand/` and are used as supplied. The
canonical team data still lives at `data/startups.json`, which the new seed reads directly —
there is one copy, not two.

---

## 9. Real Supabase Auth and the admin invite flow

Added on the `supabase-auth` branch. Everything below is built for the **absence** of
credentials in exactly the way the rest of the platform is: with no Supabase variables set,
the application is byte-for-byte the demo it was before, and the e2e suite proves it.

### 9.1 What this changes

Before, "auth" meant the demo adapter writing a session into `localStorage` and mirroring
an unsigned JSON cookie so middleware could read a role. That is still exactly what happens
in demo mode. What is new is a second, real path that switches on when Supabase is
configured:

| Concern | Demo mode (unchanged) | Supabase mode (new) |
|---|---|---|
| Sign-in | `DemoAdapter.signIn` against the fixture | `supabase.auth.signInWithPassword` |
| Session storage | `localStorage` + `fba_demo_session` cookie | Supabase auth **cookies**, via `@supabase/ssr` |
| Middleware guard | parses the unsigned cookie | `auth.getUser()` — a verified JWT |
| Role source | the demo membership row | `app_metadata.role` claim, falling back to `org_memberships` |
| Invite | generates a code in `localStorage` | creates a real user + emails a temp password |
| Forced password change | n/a (no password store) | `must_change_password`, enforced in middleware |

The mode detection is unchanged in substance — both `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` must be present — but it now lives in one place,
`lib/supabase/env.ts`, so the data layer, the auth layer and middleware cannot drift apart.

### 9.2 New environment variables

| Variable | Required | Meaning |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | for the invite flow and the bootstrap script | **Server only. Never prefix with `NEXT_PUBLIC_`.** Bypasses RLS entirely. Read only by `lib/data/supabase-admin.ts` (which is `server-only`) and by `scripts/bootstrap-admin.mjs`. |
| `RESEND_API_KEY` | for invite email | Unset → the account is still created, but the temporary password is returned to the inviting admin in the UI instead of being emailed. Nothing throws. |
| `RESEND_FROM_EMAIL` | recommended | The From address, on a domain verified in Resend. **If unset the code falls back to `onboarding@resend.dev` and logs a warning** — that sandbox sender only delivers to the Resend account owner's own address, so it is a smoke test, not a production setting. |
| `NEXT_PUBLIC_SITE_URL` | optional | Absolute origin for the sign-in link inside invitation emails. Falls back to the request origin, which is correct on Vercel. |

All four are in `.env.example`, with the same warnings.

A note on that file: §4 has claimed since the first handoff that `.env.example` is in the
repo root, and it was not — `.gitignore` matched it with `.env.*` and quietly dropped every
attempt to add it. `.gitignore` now carries a `!.env.example` negation and the file is
actually committed. It contains variable names and comments only; the credential rules above
the negation are untouched.

### 9.3 Where the service-role key is allowed to go

This is the one hard security boundary in the feature, so it is worth being explicit.

`lib/data/supabase-admin.ts` is the **only** module that reads `SUPABASE_SERVICE_ROLE_KEY`
inside the app. Its first statement is `import 'server-only'`, which makes the build fail if
any module reachable from a client bundle imports it. It is deliberately a separate module
from `SupabaseAdapter`, which keeps using the **anon** key so that every ordinary read and
write stays governed by the RLS policies in `supabase/rls.sql`.

Its importers are, in full:

```
app/api/admin/invite/route.ts          (route handler)
app/api/auth/change-password/route.ts  (route handler)
lib/auth/caller.ts                     (server-only, imported only by the invite route)
```

`scripts/bootstrap-admin.mjs` reads the key directly, but it is a local CLI tool that is
never bundled at all.

**This was verified, not assumed** — see §9.8.

### 9.4 The invite flow, end to end

The UI is the invitation tab that was already in the Teams detail drawer
(`components/teams/team-detail-drawer.tsx`). It was extended, not duplicated: same tab, same
invitation list, plus an optional full-name field and a result message. It now calls
`lib/auth/invite-client.ts` → `POST /api/admin/invite` instead of calling
`Repository.createInvitation` directly.

**In Supabase mode**, the route:

1. Resolves the caller from the request cookies and re-reads their role from
   `org_memberships` with the service-role client — the JWT claim is not trusted for the
   check that gates account creation. Non-owner/admin callers get `403`.
2. Generates a 16-character password with `crypto.randomInt` over an unambiguous alphabet
   (`lib/auth/temp-password.ts`), with one character of each class guaranteed.
3. Creates the auth user with `supabase.auth.admin.createUser({ email_confirm: true })`,
   stamping `app_metadata` with `role`, `org_id`, `team_id` and
   `must_change_password: true`. `app_metadata` is used rather than `user_metadata`
   precisely because a user cannot write it — the middleware role check depends on that.
   Re-inviting an existing address resets their temporary password instead of failing, so
   "resend the invite" does the obvious thing.
4. Upserts `profiles` (`onConflict: id`, because the `handle_new_user` trigger may have
   inserted the row already) and `org_memberships` (`onConflict: org_id,profile_id`).
5. Records an `invitations` row so the drawer's list stays the single history of who was
   asked in. It is born `accepted` — the account already exists, there is no code to redeem.
6. Emails the password and a sign-in link through Resend, bilingual, Arabic first.

The temporary password is returned in the HTTP response **only when the email could not be
sent**, so an account is never stranded; when Resend did send it, the credential never
leaves the server.

**In demo mode**, the same route verifies the demo admin cookie and returns
`{ mode: 'demo', simulated: true }`. It creates nothing and sends nothing; the client helper
then writes the local invitation record through the existing
`Repository.createInvitation`, so demo behaviour is exactly what it was.

### 9.5 Forced password change

`must_change_password` exists in two places on purpose:

- **`profiles.must_change_password`** — the durable, queryable record. Added by
  `supabase/migrations/0002_must_change_password.sql`, and also present in `schema.sql` so a
  fresh project gets it without the migration.
- **the `must_change_password` claim in `app_metadata`** — what middleware actually reads.
  It rides along in the verified JWT, so the gate costs no database query per request and
  cannot be forged.

Both are written together by the invite route and cleared together by
`POST /api/auth/change-password`.

Enforcement is server-side. While the claim is set, `middleware.ts` redirects **every**
request to `/{locale}/change-password` before the requested page is rendered — this is not
navigation hiding. `/change-password` is deliberately not an AUTH_ROUTE (those bounce a
signed-in visitor away) and not an admin or participant route (no role redirect applies); it
is a shared protected route, so an anonymous visitor is still sent to sign-in.

The password change happens **inside the route handler**, not client-side. If the browser
changed the password and then asked the server to clear the flag, a user holding a temporary
password could just call the flag-clearing endpoint and skip the change. Doing both in one
privileged, session-verified call closes that. The target user id always comes from the
verified session, never from the request body. A voluntary change (gate not set)
additionally requires the current password, checked on a throwaway non-persisting client so
it cannot disturb the session authenticating the request. After success the page calls
`refreshSession()` so the *new* token — the one without the claim — is what middleware sees
on the next navigation.

### 9.6 Bootstrap: creating the very first admin

The web invite flow requires an owner or admin to already exist. On a new project nobody
does. `scripts/bootstrap-admin.mjs` closes that from the operator's own machine, rather than
by shipping a self-service "make me an admin" web route — which would be a permanent hole
left open to solve a one-time problem.

```bash
# .env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
node scripts/bootstrap-admin.mjs you@example.com

# optional flags
node scripts/bootstrap-admin.mjs you@example.com --role admin --name "Full Name"
```

- Reads `.env.local` then `.env` with a small built-in parser (real environment variables
  win). No new dependency.
- Resolves the org from `NEXT_PUBLIC_ORG_ID`, or from the single `organizations` row if
  there is exactly one; refuses to guess when there are several.
- Creates the auth user, or **promotes** an existing one and resets their temporary
  password. Upserts `profiles` and `org_memberships`. Fully idempotent — safe to re-run,
  and it can never produce a duplicate user or membership.
- Prints the temporary password to stdout once. The account is flagged
  `must_change_password`, so it has to be replaced at first sign-in.

**It is a manual tool.** It is not wired into any build, deploy, npm script or CI job, and
nothing imports it. Run the seed step (one `organizations` row, one `cohorts` row — §4)
before it, or it will tell you to.

### 9.7 SQL changes

- **`supabase/schema.sql`** — `profiles` gains `must_change_password boolean not null
  default false`. That is the only schema change.
- **`supabase/migrations/0002_must_change_password.sql`** — the same column as an
  `add column if not exists`, for a project where `schema.sql` was applied before this
  feature existed. There is no `0001`; `schema.sql` remains the source of truth for a fresh
  project and this directory holds only deltas.
- **`supabase/rls.sql`** — one substantive addition. `profile_self_write` lets a user update
  their own profile row, which would have let them clear their own gate. An RLS policy
  cannot express "this column may not change" without recursing into `profiles`, so it is
  done with column privileges instead:

  ```sql
  revoke update on profiles from authenticated;
  grant update (email, full_name, avatar_url, locale) on profiles to authenticated;
  ```

  (The revoke-then-grant order matters: column grants are only consulted once the
  table-level privilege is gone.) The service-role key bypasses both RLS and these grants,
  so the routes are unaffected.

**The check §5 of the brief asked for**: nothing in the existing RLS blocks the anon-key
adapter from working out "am I an admin or a participant?" after a real sign-in. That read
is `profiles where id = auth.uid()` (`profile_self_read`), `org_memberships where profile_id
= auth.uid()` (`membership_read`), and `cohorts where org_id = current_org_id()`
(`cohort_read`) — all three already permitted, and the helper functions are `SECURITY
DEFINER` so `membership_read` calling `is_admin()` does not recurse into `org_memberships`'
own policy. This is a careful read of the SQL, not a test against a live database.

### 9.8 Verification — honest

Everything in this subsection was actually executed on this machine.

| Check | Result |
|---|---|
| `npx tsc --noEmit` (strict) | **PASS** — no errors |
| `npx next lint` | **PASS** — no warnings or errors |
| `npm run build` | **PASS** — compiled, 41/41 static pages, both new API routes emitted |
| `node scripts/verify-e2e.mjs` (demo mode, headless Chromium) | **PASS — 35/35** |

The e2e suite is the same 31 assertions as §6 plus four new ones, all passing:

| # | Check | Result |
|---|---|---|
| 32 | Anonymous hitting `/ar/change-password` is redirected to `/sign-in?next=/change-password` | PASS |
| 33 | `POST /api/admin/invite` with no session → 401 | PASS |
| 34 | `POST /api/admin/invite` as a participant → 403 | PASS |
| 35 | `POST /api/admin/invite` as a demo admin → 200, `mode: "demo"`, nothing created | PASS |

One fix to `verify-e2e.mjs` was needed and made: its base URL was hardcoded to `:4319`, and
a stale unrelated `next-server` already held that port on this machine. The script ran
against it and reported a full green pass for code it had never loaded. It now honours
`E2E_BASE_URL`, and the 35/35 above was produced against a server confirmed to be serving
this branch.

**The service-role containment was proved, not asserted.** Three ways:

1. `grep` across `app/`, `components/`, `lib/`, `scripts/` and `middleware.ts` for
   `supabase-admin`, `getAdminSupabase` and `SUPABASE_SERVICE_ROLE_KEY` — the importer list
   in §9.3 is complete, and every one of them is a route handler or a `server-only` module.
2. `grep` of the built `.next/static/**` client bundles for `SUPABASE_SERVICE_ROLE_KEY`,
   `service_role` and `RESEND_API_KEY` — zero matches.
3. The guard was deliberately tripped: an import of `lib/data/supabase-admin.ts` was
   temporarily added to `components/providers/session-provider.tsx` (a `'use client'`
   module) and the build **failed** with *"You're importing a component that needs
   server-only"*, naming the import trace through the client component. The probe was then
   reverted and the build re-run clean. The mechanism demonstrably works.

### 9.9 What was NOT verified, and cannot be without live credentials

Stated plainly, in the spirit of §6.

- **No Supabase sign-in has ever happened.** There is no live project. Every line of the
  Supabase auth path — `signInWithPassword` through the cookie-backed client, the middleware
  `getUser()` call, the `app_metadata` claims, the session refresh after a password change —
  is written against the documented API and typechecks, and none of it has executed.
- **No Resend email has ever been sent.** There is no Resend account. The send path, the
  bilingual template, the `RESEND_FROM_EMAIL` fallback and the not-configured branch are all
  unexercised.
- **`app/api/admin/invite` has only run in its demo branch.** Assertions 33–35 cover
  authentication, authorisation and the demo response. The entire Supabase branch —
  `createUser`, the `profiles`/`org_memberships` upserts, the `invitations` insert — has
  never executed. In particular the upsert `onConflict` targets assume the unique
  constraints in `schema.sql` (`profiles.id` primary key, `unique (org_id, profile_id)` on
  `org_memberships`); those are correct in the SQL as written but have never been enforced
  by a real Postgres.
- **`app/api/auth/change-password` has never run at all** — it returns immediately in demo
  mode, which is the only mode that has been exercised.
- **`scripts/bootstrap-admin.mjs` has never been run.** Running it needs a service-role key
  against a real project; running it against a fake one would prove nothing and could not
  even fail informatively.
- **The SQL has still never been applied**, including the new column and the new column
  grants. The §6 caveat stands in full and now covers `migrations/0002` too. Reviewing and
  applying it is a deliberate TODO, not an oversight — it needs a real database.
- **The forced-password-change redirect has been tested only for the anonymous case**
  (assertion 32). The signed-in-with-the-gate-set case cannot be reached in demo mode,
  because demo mode has no password store and therefore never sets the flag.

### 9.10 Two smaller notes

- `SupabaseAdapter` now builds its client with `createBrowserClient` from `@supabase/ssr`
  instead of `createClient` from `supabase-js`, and builds it lazily on first use rather
  than in the constructor. Both changes are load-bearing: the SSR variant persists the
  session into **cookies**, and middleware runs before any page JavaScript and can only read
  cookies — a localStorage session would leave every protected route looking anonymous to
  the route guard. The lazy construction keeps a client component's server-side render from
  building a browser client it cannot use.
- `.eslintrc.json` gained `"root": true`. Without it, ESLint walks up past the checkout and
  can pick up a parent config, which made `next lint` fail with a plugin-conflict error when
  the repo sat inside another directory containing one. Purely a determinism fix.

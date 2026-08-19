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

`locale` is `ar` (default) or `en`. Admin roles are `owner`, `admin`, `reviewer`.

---

## 3. Architecture

```
lib/data/types.ts        the domain model + the Repository interface (the contract)
lib/data/demo-adapter.ts DemoAdapter    — localStorage, used today
lib/data/supabase-adapter.ts SupabaseAdapter — scaffold, never executed
lib/data/index.ts        getRepository() picks one; nothing else imports an adapter
lib/data/seed.ts         deterministic fixture built from data/startups.json
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
- Replace the unsigned `fba_demo_session` cookie in `middleware.ts` with Supabase JWT
  verification.
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

## 8. The legacy site

The original static site was moved to `legacy/` (`index.html`, `mentor.html`,
`verify.html`, `assets/`) rather than deleted, so the previous behaviour stays available for
reference. Its brand SVGs were copied to `public/brand/` and are used as supplied. The
canonical team data still lives at `data/startups.json`, which the new seed reads directly —
there is one copy, not two.

# Film Business Accelerator — platform

**مسرعة الأعمال في الأفلام / Film Business Accelerator.**

A production-architected Next.js 14 SaaS platform for the Saudi Film Commission's Film
Business Accelerator: an admin workspace (portfolio analytics, teams, form builder,
submission results, appearance studio) and a participant portal, fully bilingual
(Arabic RTL / English LTR).

**Live:** https://www.film-accelerator.com/ar
**Official initiative:** https://film.moc.gov.sa/Initiatives/Film_Accelerator

Runs today, end to end, with **no backend** — everything is wired through a repository
interface whose demo implementation is backed by `localStorage`. A Supabase implementation
sits behind the same interface, ready to switch on with two environment variables. See
[`HANDOFF.md`](HANDOFF.md) for the full architecture, route map, and an honest account of
what has and hasn't been verified.

---

## Stack

Next.js 14 (App Router) · React 18 · TypeScript (strict) · Tailwind CSS · Framer Motion ·
Recharts · Radix UI · dnd-kit · React Hook Form · Zod · Supabase JS (adapter scaffold).

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000 — demo sign-in buttons visible outside production
```

**Demo accounts** — password `accelerate` for all three:

| Role | Email |
|---|---|
| Admin | `admin@fba.demo` |
| Participant (bound to Specter Production) | `founder@fba.demo` |
| Reviewer | `mentor@fba.demo` |

## Commands

```bash
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint

# End-to-end verification (needs a server on :4319)
npx next dev -p 4319
node scripts/verify-e2e.mjs
```

## What's in here

- `app/[locale]/` — every route, under a locale segment (`ar` default, `en`). Route groups
  separate anonymous auth pages, the admin workspace, and the participant portal.
- `lib/data/` — the domain model, the `Repository` interface, the demo adapter
  (`localStorage`), the Supabase adapter scaffold, and the deterministic seed built from
  `data/startups.json` — the real 20-company cohort.
- `lib/analytics.ts` — every dashboard and results number, as pure, documented functions
  over `Team[]` / `Submission[]` / `Form[]`. Nothing is computed inline in a page component.
- `lib/forms/` — the field-type registry, the five form templates, and conditional-rule
  logic shared by the builder, the preview, and the public fill experience.
- `lib/theme/presets.ts` — design tokens, painted onto `<html>` as CSS custom properties so
  the Appearance studio can retint the whole product with no rebuild.
- `components/dashboard/` — the executive dashboard: the animated cohort banner, the
  portfolio-health panel, and the analytics chart grid (investment-stage distribution,
  readiness by stage, revenue bands, geography & team structure, readiness ranking, and
  risks/opportunities/watchlist).
- `supabase/schema.sql`, `supabase/rls.sql` — the target production schema and RLS policies.
  Written to match `lib/data/types.ts`; **never executed against a real project** — see
  §6 of `HANDOFF.md` before trusting them with real data.
- `scripts/verify-e2e.mjs` — a headless-browser regression script covering auth, route
  guards, RTL/LTR, sidebar behaviour, form creation → publish → public submission → results,
  theme persistence, and the dashboard's portfolio analytics.
- `legacy/` — the original static two-page workshop site, kept for reference and not served
  by the current app.

## Data integrity

`data/startups.json` is the canonical portfolio source for the 20 real companies — read
verbatim, nothing invented. Every metric on the dashboard is derived from it (or from real
forms/submissions data) through the pure functions in `lib/analytics.ts`, each documented
with the exact rule it applies. One metric from the programme's editorial snapshot — founder
gender / "female-led" — is intentionally **not** computed anywhere, because the domain model
has no such field and inferring it from a name would be a guess, not a calculation.

## License

Internal programme tooling for the Saudi Film Commission. Not licensed for reuse.

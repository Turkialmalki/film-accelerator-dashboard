# ورشة التحقق من الشركات الناشئة

**Founder validation workshop — مسرعة الأعمال في الأفلام (Film Business Accelerator).**

Founders scan a QR code during the workshop and spend eight to ten minutes in a guided AI
consultation. They leave with one clear next action; the facilitator leaves with an
anonymous view of the room. The interface is entirely Arabic and RTL.

Static HTML, CSS and JavaScript. **No build step, no framework, no `package.json`.** Deployed
on GitHub Pages, backed by Supabase.

**Live:** https://turkialmalki.github.io/founder-validation-platform/

---

## Quick start

```bash
git clone https://github.com/Turkialmalki/founder-validation-platform.git
cd founder-validation-platform
python3 -m http.server 8000     # must be HTTP; fetch() fails on file://
```

Then open `http://localhost:8000`. It runs immediately in **local-only mode** — useful for a
demo, but nothing syncs and the mentor dashboard stays empty. For a real workshop complete
the two steps below.

---

## Setup

### 1. Install the database

Supabase → **SQL Editor → New query** → paste all of
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.

The file is idempotent — safe to run repeatedly. It creates the table, the unique
constraint, the indexes, the `updated_at` trigger, the RLS policies, and enables Realtime.

It ends with six verification queries. **Every one must report `ok`:**

| Query | Reports `ok` when |
|---|---|
| `columns_check` | all 15 columns exist |
| `unique_check` | the `(workshop_id, startup_id)` unique index exists |
| `rls_check` | Row Level Security is enabled |
| `policy_check` | all three anon policies exist |
| `realtime_check` | the table is in the `supabase_realtime` publication |
| `replica_check` | `REPLICA IDENTITY FULL` is set |

Then confirm **Database → Replication** shows `workshop_responses` enabled.

### 2. Add your keys

Edit [`assets/js/config.js`](assets/js/config.js):

| Value | Where to find it | Required |
|---|---|---|
| `SUPABASE_URL` | Project Settings → API → Project URL | yes |
| `SUPABASE_ANON_KEY` | Project Settings → API keys → publishable | yes |
| `DEFAULT_WORKSHOP_ID` | any slug you choose for the cohort | yes |
| `DATA_VERSION` | bump whenever `data/startups.json` changes | on data change |

This project is already configured and connected:

```js
const SUPABASE_URL        = 'https://bpqiqplpkfeltjojzuvg.supabase.co';
const SUPABASE_ANON_KEY   = 'sb_publishable_…';
const DEFAULT_WORKSHOP_ID = 'film-accelerator-2026';
```

> **The `supabase-js` version matters.** Supabase's newer `sb_publishable_…`
> keys are opaque, not JWTs, and older clients do not understand them. On
> `@supabase/supabase-js@2.45.4` every REST call hung forever and Realtime
> reported `TIMED_OUT`, while a plain `fetch()` to the same endpoint returned
> `200` in 14 ms — so it looked like a backend outage when it was the client.
> Both pages now pin **2.110.9**. If you ever downgrade, expect this to return.

The anon key is a **publishable** key — it is designed to ship in client code and is not a
secret. **Never** put the `service_role` key here: it bypasses RLS entirely, and every file
in this repository is public.

`FVConfig.missing()` returns the names of any unset values, and both pages display them on
screen if configuration is incomplete.

### 3. Deploy

Push to `main`. GitHub Pages serves the repository root; `.nojekyll` is included.

**Bump the version token on every deploy** — `?v=` in `index.html` and `mentor.html`, and
`DATA_VERSION` in `config.js`. GitHub Pages sets `cache-control: max-age=600` on everything
including `index.html`, so without this a returning founder can hold a fresh page and a
stale script, which throws rather than degrading.

### 4. Check the connection

Open [`verify.html`](verify.html) and press **ابدأ الفحص**. It talks to Supabase
directly — not through `api.js` — so a failure points at the database rather
than at our sync layer. Seven checks: configuration, client, read access,
write, read-back, conflict resolution, and Realtime. All must be green.

It writes one row under the workshop id `__diagnostic__`, which no real
workshop ever reads.

### 5. The QR code

Encode the URL with the workshop id:

```
https://turkialmalki.github.io/founder-validation-platform/?workshop=riyadh-2026
```

Open the mentor dashboard with the **same** parameter, or it will watch a different workshop.

---

## Folder structure

```
index.html              رحلة المؤسس — the founder journey
mentor.html             لوحة المدرب — anonymous cohort view
.nojekyll               stops GitHub Pages running Jekyll over assets/

assets/css/brand.css    the whole design system, RTL-first
assets/images/          brand vectors extracted from the official deck

assets/js/config.js     keys, workshop id, anonymous device id   ← EDIT THIS
assets/js/api.js        Supabase sync, realtime, offline outbox
assets/js/session.js    session lifecycle: NEW / ACTIVE / COMPLETED / EXPIRED
assets/js/storage.js    local draft cache, completion, readiness
assets/js/search.js     Arabic + English fuzzy search, silent resolve
assets/js/ui.js         DOM helpers, Arabic numerals and counting
assets/js/questions.js  per-startup question engine
assets/js/coach.js      per-startup coach message
assets/js/recommend.js  findings and the closing dashboard
assets/js/journey.js    screen flow and rendering
assets/js/mentor.js     cohort analytics, insights, workshop summary
verify.html             backend self-test — run this after any config change

data/startups.json      the cohort — 20 companies, 29 people
supabase/schema.sql     table, indexes, RLS, realtime, verification
```

---

## The journey

```
البحث → التحليل → التعريف بالشركة → المرشد → اللقطة → ١٠ أسئلة → لوحة النتائج
```

Identification is silent: no autocomplete, no dropdown, no suggestions. Showing who else is
in the room is a privacy problem in a cohort programme, so the founder types a name, presses
التالي, and the lookup resolves to exactly one company or to nothing.

Three guards sit on the resolver in [`search.js`](assets/js/search.js):

- **Score floor of 70** — admits only exact, prefix, substring and whole-token matches.
- **Minimum length of 3** — one or two letters always prefix-match somebody.
- **Ambiguity check** — this cohort has two founders called أحمد and five whose names begin
  عبد. When the top two matches tie, nothing resolves and the founder is asked for the full
  name. Picking one silently would open a stranger's company.

On failure the message is only `لم يتم العثور على بيانات مطابقة.` with a retry button. No
count, no near-miss, no "did you mean".

### Personalisation

Every founder gets their own coach message, their own ten questions, and their own closing
dashboard. The strongest personalisation is not generated prose but real text: the ranking
question's options **are** the company's reported challenges, and the scale question quotes
its reported advantage back and asks how long it will survive.

---

## Data flow

```
founder answers
   ↓ instant     localStorage           (never blocks the UI)
   ↓ debounced   FVApi.save → Supabase  (700 ms after the last keystroke)
   ↓ on failure  outbox → retry every 6 s and on the `online` event
   ↓ realtime    postgres_changes
mentor dashboard   (debounced 500 ms — twenty founders typing is a stream)
```

One row per `(workshop_id, startup_id)`. Every write is an upsert on that constraint, so two
co-founders answering from different phones edit the same row rather than creating two, and
duplicate submissions are impossible.

Submit is the one write that is **not** debounced — the founder is about to stop touching
the page.

| Answer | Column |
|---|---|
| the three validation questions | `assumption_status` |
| support area | `challenge_tags` |
| open challenge | `challenge` |
| commitment | `commitment` |
| every generated question | `reflection_answers` |

The mentor dashboard aggregates the first four, which is why those four are worded
identically for everyone. Adding a question to the engine cannot break it.

---

## Session lifecycle

[`session.js`](assets/js/session.js) — only **ACTIVE** resumes.

| State | Meaning | On load |
|---|---|---|
| `NEW` | no journey on this device | start at search |
| `ACTIVE` | started, not submitted, under 12 h old | resume at the exact question |
| `COMPLETED` | submitted | **start fresh** — never reopens |
| `EXPIRED` | untouched for over 12 h | discard the draft, start fresh |

A founder who finishes and refreshes lands on a clean start, not back on the thank-you page.
The device is often handed to the next person in the room, and they must never inherit the
previous founder's finished journey. `pageshow` is handled too, so the back button and the
mobile bfcache cannot restore a finished journey from memory.

**بدء جلسة جديدة** on the final screen calls `FVSession.resetAll()`, which clears every
`fvip:` key from both localStorage and sessionStorage — including the anonymous device id,
so the next founder's answers are never attributed to the previous one's row.

---

## Privacy and anonymity

- `analyse()` in [`mentor.js`](assets/js/mentor.js) is the only function that reads a
  database row, and it never copies a startup name, founder name, `participant_name`,
  `session_id` or `startup_id` onto the object the UI renders. The guarantee lives in one
  place rather than being a habit spread across the view.
- The search reveals nothing about who is attending, on success or failure.
- `participant_name` is stored but never displayed anywhere.
- Anyone holding the anon key — that is, anyone who opens the page — can read and write
  `workshop_responses`. That is acceptable for a time-boxed workshop with non-sensitive
  content and is **not** acceptable for anything else.

### Running multiple cohorts

The dashboard is self-service — you never touch SQL between workshops.

| Action | What it does |
|---|---|
| **✨ بدء ورشة جديدة** | Creates the next id (`film-accelerator-2026-001`, `-002`, …) and switches to it instantly. Previous cohorts stay readable. |
| **ورشة اليوم ▼** | Switch to any past workshop to review it. Defaults to the most recent. |
| **📥 تصدير (CSV)** | Anonymous export — an index, never a name. UTF-8 BOM so Excel opens Arabic. |
| **🗑 حذف استجابات الورشة** | Deletes only the current `workshop_id`. Requires the delete policy (below). |

Starting a new workshop is safer than deleting and is the recommended flow:
nothing is lost, and every cohort stays comparable afterwards.

**Starting a new workshop changes the id, so update the QR code.** The founder
link for the active workshop is shown under the admin bar for exactly that
reason — an old QR would quietly send the room into the previous cohort.

### The delete policy

`supabase/schema.sql` is a **one-time install**, not a pre-workshop ritual.
It includes the DELETE policy that the clear button needs. Until it has been
run, clearing fails **loudly**: the dashboard re-reads the workshop, counts
what survived, and prints the database's own error message rather than
reporting a success that did not happen.

There is deliberately **no DELETE policy for founders**, so no founder can wipe another
team's answers mid-workshop. An anon `DELETE` is filtered away by RLS — note
that PostgREST still answers `204`, because zero rows matched, so a successful
status code there does **not** mean anything was removed.

**Clear the test data before the real workshop, from the SQL editor:**

```sql
delete from public.workshop_responses
where workshop_id in ('film-accelerator-2026', '__diagnostic__');
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Mentor dashboard shows zeros all session | `config.js` still has placeholders, so answers go to a local outbox that never drains | Fill in both keys. Both pages now say this on screen. |
| `FVSearch.resolve is not a function` | browser holds a cached script from a previous deploy | Bump the `?v=` token; hard-reload once |
| A founder's name is not found | ambiguous first name, or a spelling not in `aliases` | Enter the full name, or add an alias in `data/startups.json` |
| Dashboard does not update live | Realtime not enabled for the table | Database → Replication, then re-run `realtime_check`. The dashboard falls back to polling every 5 s automatically, so it keeps updating either way — the header shows **تحديث تلقائي** instead of **مباشر**. |
| Every request hangs, Realtime times out | `supabase-js` too old for `sb_publishable_` keys | Pin `@supabase/supabase-js@2.110.9` or later |
| Nothing loads, console shows a `fetch` error | opened over `file://` | Serve over HTTP |
| Arabic renders left-to-right | stylesheet failed to load | Check `assets/css/brand.css` returns 200 |

Connection state is shown in the mentor header: **مباشر** (live), **جارٍ إعادة الاتصال…**
(retrying), **وضع محلي** (not configured).

---

## Known limitations

- **`business_model` is inferred**, not reported. The accelerator dashboard has no such
  field, and the question engine needs one. Each entry carries
  `business_model_source: 'derived-from-category-and-description'` so it can never be
  mistaken for source data.
- **`accelerator_priorities` mirrors the reported `challenges`.** There is no separate
  priorities field upstream.
- **The workshop summary is rule-based, not a model call.** There is no API key in this
  project, and a facilitator pressing that button in front of the room needs it to answer
  when the venue wifi does not. `buildSummary()` already receives the complete anonymous
  analysis, so swapping in a real model is a one-function change.
- **The mentor password is a client-side check**, not a security boundary. It keeps the
  dashboard out of the way during a workshop; it does not protect the data. The anon key
  does the real gatekeeping, and it is public by design.
- **`data/startups.json` is publicly fetchable.** Hiding the cohort in the UI does not hide
  it if the file is one URL away. Make the repository private if that matters.
- **A bare first name will not resolve** when several founders share it. This is deliberate;
  see the ambiguity guard above.

---

## Technical notes

- Two CDN dependencies: the Supabase client and Google Fonts. If either is blocked the page
  still renders and still works locally.
- Brand type is **Effra** (from the official template), which is not a web font. The stack
  falls back to **IBM Plex Sans Arabic**.
- Numerals render Arabic-Indic (٠١٢٣) everywhere a founder sees them; stored values stay
  Western. `numText()` leaves Latin identifiers alone, so `2014` converts but `B2B` and
  `bingolab51` survive.
- Arabic counting is not a suffix — `companies()`, `minutes()` and `times()` carry the dual
  forms, including the oblique (`شركتان` as a subject, `لدى شركتين` after a preposition).
- Mobile-first. Every target is at least 56 px; the content column is capped at 34 rem.
- Ranking is tap-to-order. Dragging is unreliable one-handed on a phone and unusable from a
  keyboard.
- Motion is fade, slide and scale on one easing curve, fully disabled under
  `prefers-reduced-motion`.
- Screen changes move focus to the new heading so a screen reader follows; choice groups are
  real radio groups with arrow-key roving, mirrored for RTL.

---

## Editing the cohort

Each entry in [`data/startups.json`](data/startups.json) needs these fields. Bump
`DATA_VERSION` in `config.js` afterwards.

```jsonc
{
  "id": "unique-slug",
  "startup_name_ar": "شركة الاسم",
  "startup_name_en": "Name in English",
  "aliases": ["الاسم", "sub-brand"],       // extra searchable spellings
  "founder":     { "name_ar": "...", "role": "..." },
  "co_founders": [{ "name_ar": "...", "role": "..." }],
  "leadership":  [{ "name_ar": "...", "role": "..." }],
  "stage": "MVP",                          // Pre-Seed | MVP | Seed | Pre-A | Series A
  "stage_ar": "المنتج الأولي",
  "stage_summary_ar": "جملتان تشرحان المرحلة.",
  "readiness": 61,                         // 0–100
  "revenue": "أقل من 100,000 ر.س",
  "team_size": 3,
  "team_size_label": "3 موظفين",
  "city": "الرياض",
  "category": "...",
  "business_model": "...",                 // inferred — see limitations
  "description": "...",
  "competitive_advantages": ["..."],       // drives the scale question
  "current_challenges": ["..."],           // drives the ranking question
  "accelerator_priorities": ["..."],
  "growth_roadmap": "...",
  "recommendation_ar": { "strength": "...", "risk": "...", "next_step": "..." }
}
```

Every founder, co-founder and leadership name becomes searchable in both scripts, so any
member of a team resolves to the same company and shares one row.

# ورشة التحقق من الشركات الناشئة

**Founder validation workshop — مسرعة الأعمال في الأفلام (Film Business Accelerator).**

Founders scan a QR code during the workshop, spend ten to fifteen minutes, and leave with
one clear next action. The interface is entirely Arabic and RTL.

The goal is not data collection. It is reflection: every founder should identify their
biggest validation gap and commit to a single step before the next session.

---

## The experience

Five steps, one screen each, one task per screen.

| | Screen | What happens |
|---|---|---|
| — | البحث | The founder types their name or company. No suggestions, no dropdown. |
| — | الترحيب | Company confirmed, purpose and duration stated. |
| ١ | مرحلتك الحالية | Their stage explained in two sentences, then: what is your biggest challenge? |
| ٢ | التحقق من الفرضيات | Three questions. Customers, payment, problem clarity. |
| ٣ | تحديك الحالي | One open text answer. |
| ٤ | توصيات خاصة بشركتك | نقطة قوة · أكبر مخاطرة · أفضل خطوة تالية |
| ٥ | التزامك | «قبل الورشة القادمة سأقوم بـ...» |
| — | النهاية | Readiness score, top risk, next step. |

Progress, estimated time remaining, and save state are shown throughout.

### The search is silent

Autocomplete was removed deliberately. Suggesting startup or founder names would reveal
who else is in the room, which is a privacy problem in a cohort programme.

The founder types and presses التالي. The lookup happens invisibly and resolves to exactly
one company or to nothing. It matches founder names, team member names and startup names,
in Arabic or English, tolerating partial words, extra spaces, hamza and taa-marbuta
variation, and the words شركة / منصة / studio / production.

On failure the message is only:

> لم يتم العثور على الاسم.
> يرجى التأكد من كتابة اسمك أو اسم الشركة بشكل صحيح.

No count, no near-miss, no "did you mean". Nothing about the cohort leaks.

Two guards sit on the resolver in [`assets/js/search.js`](assets/js/search.js): a score floor
of 70, which admits only exact, prefix, substring and whole-token matches, and a minimum
query length of 3. Without the length guard a single letter would prefix-match somebody and
open a stranger's journey on a mistyped Enter.

---

## Design

The palette, mark and typography come from the official Accelerator template. The brand
vectors in [`assets/images/`](assets/images/) are extracted from it, not redrawn.

| Token | Value | Use |
|---|---|---|
| Navy | `#0F2837` `#0B1A24` `#071119` | The plane |
| Slate | `#4B5E69` `#87939B` | Structure, secondary bars |
| Amber | `#FBAE40` `#F89C49` | The single accent |
| Teal | `#76B6B7` | نقطة قوة, saved state |
| Coral | `#F05B4E` | أكبر مخاطرة, errors |

Brand type is **Effra** (Light / Medium). It is not a web font, so the stack falls back to
**IBM Plex Sans Arabic**, which matches its geometric humanist proportions and has a strong
Arabic cut. Effra is used first where it is installed locally.

Numerals render as Arabic-Indic (٠١٢٣) everywhere a founder sees them; stored values stay
Western digits. Arabic counting is not a suffix — `companies()`, `minutes()` and `times()`
in [`assets/js/ui.js`](assets/js/ui.js) carry the dual forms, including the oblique
(`شركتان` as a subject, `لدى شركتين` after a preposition).

---

## Mentor dashboard

[`mentor.html`](mentor.html) — password gated, fully anonymous, live.

Shows only: participating companies, completed companies, completion rate, average
readiness, most common challenges, most common stage, a word cloud, three generated
insights, five discussion topics, and a live completion bar. No charts.

`analyse()` in [`assets/js/mentor.js`](assets/js/mentor.js) is the only function that reads
a database row, and it never copies a startup name, founder name, `participant_name`,
`session_id` or `startup_id` onto the object the UI renders. The anonymity guarantee lives
in one place rather than being a habit spread across the view.

### ✨ ملخص الورشة

The summary button composes أهم التحديات، أكثر الفرضيات غير المثبتة، أكثر الأسئلة تكراراً،
توصيات الجلسة القادمة، أفضل ٥ مواضيع للنقاش.

**It is generated locally by rule, not by a model call.** There is no API key in this
project, and more importantly a facilitator pressing this in front of the room needs it to
answer every time — workshop venue wifi is the one thing that cannot be relied on. Each
rule only fires when the data supports the claim, so it never states a pattern that is not
there. To swap in a real model later, replace `buildSummary()`; it already receives the
complete anonymous analysis.

---

## Setup

### 1. Create the database

In your Supabase project, open **SQL Editor → New query**, paste
[`supabase/schema.sql`](supabase/schema.sql), and run it. It creates the table, the
uniqueness constraint, the RLS policies, and enables Realtime.

Then confirm **Database → Replication** shows `workshop_responses` enabled.

### 2. Add your keys

Edit [`assets/js/config.js`](assets/js/config.js) with the values from
**Project Settings → API**:

```js
const SUPABASE_URL      = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhb...';
```

The anon key is a publishable key — it is designed to ship in the client.

### 3. Name the workshop

`DEFAULT_WORKSHOP_ID` scopes every response. To run two cohorts at once, put the id in the
QR code URL instead:

```
https://you.github.io/film-accelerator-dashboard/?workshop=riyadh-nov-2026
```

Open the mentor dashboard with the **same** parameter so it watches that workshop.

### 4. Run it

Static site, but it must be served over HTTP — it `fetch`es the JSON, which browsers block
on `file://`.

```bash
python3 -m http.server 8000
```

For GitHub Pages, push to the repository root and enable Pages. No build step;
`.nojekyll` is included.

**If you skip steps 1–2 the platform still runs** in local-only mode — useful for a demo —
but nothing syncs between devices.

The mentor password is `accelerator2026`, set at the top of `assets/js/mentor.js`. It keeps
the dashboard out of the way during a workshop; it is a client-side check, not a security
boundary.

---

## Structure

```
index.html              الرحلة — five steps
mentor.html             لوحة المدرب — anonymous cohort view

assets/css/brand.css    The design system. RTL-first.
assets/images/          Brand vectors from the official template

assets/js/config.js     Supabase keys, workshop id, anonymous session id
assets/js/api.js        Sync, realtime, offline outbox
assets/js/search.js     Arabic + English fuzzy search, silent resolve
assets/js/storage.js    Local draft cache, completion, readiness
assets/js/ui.js         DOM helpers, Arabic numerals and counting
assets/js/recommend.js  Personalised findings for step 4
assets/js/journey.js    The five-step journey
assets/js/mentor.js     Cohort analytics, insights, summary

data/startups.json      The cohort
supabase/schema.sql     Table, RLS, realtime
```

---

## Adding or editing startups

Each entry in [`data/startups.json`](data/startups.json) needs these fields for the journey
to work. The file carries a lot more, which the current UI does not read.

```jsonc
{
  "id": "unique-slug",
  "startup_name_ar": "الاسم بالعربية",
  "startup_name_en": "Name in English",
  "stage": "MVP",                       // drives readiness baseline + mentor grouping
  "stage_ar": "المنتج الأولي",           // shown in step 1
  "stage_summary_ar": "جملتان تشرحان المرحلة.",
  "readiness": 44,                      // 0–100 baseline
  "founders":     [{ "name_ar": "...", "name_en": "...", "role": "..." }],
  "team_members": [{ "name_ar": "...", "name_en": "...", "role": "..." }],

  // Step 4. Written per company so no two founders see the same three sentences.
  "recommendation_ar": {
    "strength":  "نقطة قوة مبنية على إنجاز حقيقي.",
    "risk":      "أكبر مخاطرة.",
    "next_step": "أفضل خطوة تالية."
  }
}
```

Every founder and team member name becomes searchable in both scripts, so any member of a
team resolves to the same company and shares one row.

### How the recommendations personalise

[`assets/js/recommend.js`](assets/js/recommend.js) layers two things: the authored baseline
above, and overrides driven by the step-2 answers. A founder who says nobody has paid yet
has a more urgent risk than whatever their profile knew beforehand, so that override wins.
Rules are ordered by urgency and the first match takes it — nobody is handed two "biggest"
risks. `strength` is never overridden: it comes from what the company actually achieved,
and the point of showing it first is that the risk lands on someone who has just been told
they are doing something right.

---

## How responses behave

One row per `(workshop_id, startup_id)`. Every write is an upsert on that constraint, so
two co-founders answering from different phones edit the same answer rather than creating
two, and "edit your previous answers" needs no extra code.

Typing writes to `localStorage` immediately and renders instantly; the network round trip
happens behind it, debounced. A failed write goes into an outbox and is retried every six
seconds and on the `online` event until it lands. The founder is told the answer saved
either way — a queued write is a safe write, and alarming someone mid-journey about a
network they cannot fix helps nobody.

Submit is the one write that is not debounced: the founder is about to stop touching the
page, so it has to leave now.

`readinessOf()` starts from the startup's baseline `readiness` and moves with the three
step-2 answers. It is deliberately blunt — a conversation starter for the room, not a
valuation.

---

## Privacy

- No founder name, startup name, session id or email is ever rendered in the mentor view.
- The search reveals nothing about who is attending, on success or failure.
- `participant_name` is stored but never displayed anywhere.
- Anyone holding the anon key — that is, anyone who opens the page — can read and write
  `workshop_responses`. That is acceptable for a time-boxed workshop with non-sensitive
  content and is not acceptable for anything else. **Delete the data after the session:**

```sql
delete from public.workshop_responses where workshop_id = 'film-accelerator-2026';
```

---

## Technical notes

- No build step, no framework, no bundler. Two CDN dependencies: the Supabase client and
  Google Fonts. If either is blocked the page still renders and still works locally.
- Charts, PDF export, printable reports and the thirteen-section dashboard were removed.
- Mobile-first. Every target is at least 56px; the content column is capped at 34rem and
  the screen body switches from centred to top-aligned under 720px of height so a long
  step never traps its own button off-screen.
- Motion is fade, slide and scale only, on one easing curve, and fully disabled under
  `prefers-reduced-motion`.
- Screen changes move focus to the new heading so a screen reader follows; choice groups
  are real radio groups with arrow-key roving, mirrored for RTL.

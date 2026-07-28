/* ==========================================================================
   Configuration — the only file you must edit before a workshop.

   REQUIRED
   ────────
   1. SUPABASE_URL        Supabase → Project Settings → API → Project URL
   2. SUPABASE_ANON_KEY   Supabase → Project Settings → API → anon / public
   3. DEFAULT_WORKSHOP_ID a slug for this cohort, or pass ?workshop= in the QR

   Also required, once per project: run supabase/schema.sql in the SQL editor.

   WHAT HAPPENS IF YOU SKIP THIS
   ─────────────────────────────
   The platform still runs, but in local-only mode: every answer stays on the
   founder's own phone, nothing reaches Supabase, and the mentor dashboard
   shows an empty room all session. Both pages now say so on screen rather
   than only in the browser console — see showBackendNotice() in mentor.js.

   ON SECRETS
   ──────────
   The anon key is a publishable key. It is designed to ship in client code
   and is not a secret. Never put the service_role key in this file: it
   bypasses Row Level Security entirely, and everything here is public.
   ========================================================================== */

const FVConfig = (() => {

  const SUPABASE_URL = 'https://bpqiqplpkfeltjojzuvg.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_U8T9Blxrv_sKw206QJAfqw_AsEIRfXq';

  /* The workshop this device is taking part in. Every response is scoped to
     it, so two cohorts can run at the same time without colliding.

     Override per session with a URL parameter, which is what you encode into
     the QR code:  index.html?workshop=riyadh-nov-2026                       */
  const DEFAULT_WORKSHOP_ID = 'film-accelerator-2026';

  const SESSION_KEY = 'fvip:session-id';

  /* Cache-buster for data/startups.json.
     GitHub Pages serves every file with max-age=600, and the cohort file is
     fetched by script rather than referenced from the HTML, so it cannot get
     the ?v= stamp the other assets carry. Bump this whenever the cohort data
     changes, or founders will run new code against a stale roster. */
  const DATA_VERSION = '20260729a';

  const dataUrl = () => `data/startups.json?v=${DATA_VERSION}`;

  function isConfigured() {
    return missing().length === 0;
  }

  /**
   * Which required values are still unset, by name.
   *
   * Returned rather than merely logged so the UI can say precisely what is
   * wrong. A deployment that is missing a key loses an entire workshop's
   * answers, and that must never be discoverable only from a console warning.
   */
  function missing() {
    const out = [];
    if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT-REF') ||
        !SUPABASE_URL.startsWith('https://')) {
      out.push('SUPABASE_URL');
    }
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY') ||
        SUPABASE_ANON_KEY.length < 40) {
      out.push('SUPABASE_ANON_KEY');
    }
    if (!DEFAULT_WORKSHOP_ID || !DEFAULT_WORKSHOP_ID.trim()) {
      out.push('DEFAULT_WORKSHOP_ID');
    }
    return out;
  }

  function workshopId() {
    const fromUrl = new URLSearchParams(location.search).get('workshop');
    return (fromUrl || DEFAULT_WORKSHOP_ID).trim().toLowerCase();
  }

  /**
   * A stable anonymous id for this device, created once and reused.
   * It identifies the browser, never the person — it is written to the
   * database but never rendered in the mentor dashboard.
   */
  function sessionId() {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = newId();
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      // Private mode with storage disabled — a per-tab id still works.
      if (!window.__fvSessionId) window.__fvSessionId = newId();
      return window.__fvSessionId;
    }
  }

  function newId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return 'sess-' + Date.now().toString(36) + '-' +
           Math.random().toString(36).slice(2, 10);
  }

  return {
    SUPABASE_URL, SUPABASE_ANON_KEY, DATA_VERSION,
    isConfigured, missing, workshopId, sessionId, dataUrl
  };
})();

window.FVConfig = FVConfig;

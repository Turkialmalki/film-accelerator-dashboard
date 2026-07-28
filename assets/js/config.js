/* ==========================================================================
   Configuration.

   EDIT THE TWO VALUES BELOW before the workshop.
   Find them in Supabase: Project Settings → API.
   The anon key is a publishable key and is meant to ship in the client.

   If these are left as placeholders the platform still runs — it falls back
   to local-only mode so you can demo it — but nothing syncs between devices.
   ========================================================================== */

const FVConfig = (() => {

  const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

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
  const DATA_VERSION = '20260728c';

  const dataUrl = () => `data/startups.json?v=${DATA_VERSION}`;

  function isConfigured() {
    return !SUPABASE_URL.includes('YOUR-PROJECT-REF') &&
           !SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY') &&
           SUPABASE_URL.startsWith('https://');
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
    isConfigured, workshopId, sessionId, dataUrl
  };
})();

window.FVConfig = FVConfig;

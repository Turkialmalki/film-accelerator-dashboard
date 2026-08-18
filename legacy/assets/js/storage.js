/* ==========================================================================
   الحفظ المحلي — local draft cache.

   Supabase is the source of truth (see api.js). This is the mirror in front
   of it: typing writes here and renders instantly, and nothing is lost when
   twenty founders share one conference access point.

   The stored shape is unchanged from the previous build, deliberately — the
   Supabase columns and the outbox both depend on it. Only the meaning of two
   fields is narrower now:

     assumptions  →  the three step-2 answers, keyed 'talked' | 'paid' | 'problem'
     challenge    →  { text: step-3 answer, tags: [step-1 challenge area] }
   ========================================================================== */

const FVStore = (() => {

  const KEY = 'fvip:drafts:v4';
  const SESSION_KEY = 'fvip:current-startup';

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('FVStore: read failed, continuing empty', e);
      return {};
    }
  }

  function writeAll(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('FVStore: write failed', e);
      return false;
    }
  }

  function blank() {
    return {
      assumptions: {},                    // talked | paid | problem
      reflections: {},                    // reserved; unused in the 5-step journey
      challenge: { text: '', tags: [] },
      commitment: '',
      submitted: false,
      startedAt: null,
      updatedAt: null,
      completedAt: null
    };
  }

  function get(startupId) {
    const all = readAll();
    return { ...blank(), ...(all[startupId] || {}) };
  }

  function set(startupId, patch) {
    const all = readAll();
    const current = { ...blank(), ...(all[startupId] || {}) };
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    if (!next.startedAt) next.startedAt = next.updatedAt;
    all[startupId] = next;
    writeAll(all);
    return next;
  }

  function setField(startupId, group, key, value) {
    const current = get(startupId);
    return set(startupId, { [group]: { ...(current[group] || {}), [key]: value } });
  }

  /**
   * Replace the local draft with the server's copy.
   *
   * The server wins: the row is shared by the whole team, so a co-founder's
   * answers from another phone should surface here rather than being masked
   * by a stale local draft.
   */
  function hydrate(startupId, remote) {
    if (!remote) return get(startupId);
    const all = readAll();
    all[startupId] = { ...blank(), ...remote };
    writeAll(all);
    return all[startupId];
  }

  function markSubmitted(startupId) {
    return set(startupId, { submitted: true, completedAt: new Date().toISOString() });
  }

  /* ------------------ الشركة الحالية على هذا الجهاز ------------------ */

  function getSession() {
    try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
  }
  function setSession(startupId) {
    try { localStorage.setItem(SESSION_KEY, startupId); } catch { /* ignore */ }
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  /* ---------------------------- الإنجاز ---------------------------- */

  /* The five things a founder fills in, one per step. Equal weight, so the
     progress a founder sees always matches the steps they have passed. */
  function completionOf(response) {
    const r = { ...blank(), ...(response || {}) };
    const a = r.assumptions || {};
    const parts = [
      (r.challenge?.tags || []).length ? 1 : 0,                         // step 1
      ['talked', 'paid', 'problem'].filter(k => a[k]).length / 3,       // step 2
      (r.challenge?.text || '').trim() ? 1 : 0,                         // step 3
      1,                                                                // step 4 is read-only
      (r.commitment || '').trim() ? 1 : 0                               // step 5
    ];
    return Math.round((parts.reduce((x, y) => x + y, 0) / parts.length) * 100);
  }

  function completion(startupId) {
    return completionOf(get(startupId));
  }

  /**
   * جاهزية الشركة — the number on the final screen.
   *
   * It starts from the startup's baseline readiness and moves with the three
   * step-2 answers, so it reflects what the founder just told us rather than
   * only what the cohort file already knew. Deliberately blunt: this is a
   * conversation starter for the room, not a valuation.
   */
  const READINESS_WEIGHTS = {
    talked:  { yes: 12, partly: 5, no: -8 },
    paid:    { yes: 14, no: -10 },
    problem: { yes: 8,  no: -12 }
  };

  function readinessOf(response, startup) {
    const a = (response && response.assumptions) || {};
    const base = Number(startup?.readiness) || 40;
    const delta = Object.entries(READINESS_WEIGHTS)
      .reduce((sum, [key, table]) => sum + (table[a[key]] || 0), 0);
    return Math.max(5, Math.min(97, Math.round(base + delta)));
  }

  function reset(startupId) {
    const all = readAll();
    delete all[startupId];
    writeAll(all);
  }

  return {
    get, set, setField, hydrate, markSubmitted,
    getSession, setSession, clearSession,
    completion, completionOf, readinessOf, reset
  };
})();

window.FVStore = FVStore;

/* ==========================================================================
   Local draft cache.

   Supabase is the source of truth for responses (see api.js). This module is
   the local mirror in front of it, and it exists for two reasons:

   1. The UI must feel instant. Typing writes here and renders immediately;
      the network round-trip happens behind that.
   2. A founder on bad wifi must not lose answers. What is cached here is
      re-sent by the outbox until the server confirms it.

   It is a cache, not a database. On load, remote state overwrites it.
   ========================================================================== */

const FVStore = (() => {

  const KEY = 'fvip:drafts:v3';
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
      assumptions: {},      // "group:index" -> 'not' | 'partial' | 'validated'
      reflections: {},      // question index -> answer text
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
    const groupData = { ...(current[group] || {}), [key]: value };
    return set(startupId, { [group]: groupData });
  }

  /**
   * Replace the local draft with what the server has.
   *
   * Called when a founder opens their journey. The server wins: it is the
   * shared record for the whole team, so a teammate's answers from another
   * phone should appear here rather than being masked by a stale local copy.
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

  /* ---- Which startup this device is currently working as ---- */

  function getSession() {
    try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
  }
  function setSession(startupId) {
    try { localStorage.setItem(SESSION_KEY, startupId); } catch { /* ignore */ }
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  /* ---- Completion ---- */

  function countAssumptions(startup) {
    return ['customer_assumptions', 'business_assumptions',
            'technical_assumptions', 'pricing_assumptions']
      .reduce((n, k) => n + ((startup[k] || []).length), 0);
  }

  /**
   * Weighted across the five things a founder can fill in, so a half-finished
   * journey reads as partial rather than zero. Works on any response-shaped
   * object, which lets the mentor dashboard score remote rows with the same
   * function the portal uses locally.
   */
  function completionOf(response, startup) {
    const r = { ...blank(), ...(response || {}) };
    const totalAssumptions = countAssumptions(startup);
    const answeredAssumptions = Object.keys(r.assumptions || {}).length;
    const totalReflections = (startup.reflection_questions || []).length;
    const answeredReflections = Object.values(r.reflections || {})
      .filter(v => v && String(v).trim()).length;

    const parts = [
      totalAssumptions ? Math.min(answeredAssumptions / totalAssumptions, 1) : 0,
      totalReflections ? Math.min(answeredReflections / totalReflections, 1) : 0,
      (r.challenge?.text || '').trim() ? 1 : 0,
      (r.challenge?.tags || []).length ? 1 : 0,
      (r.commitment || '').trim() ? 1 : 0
    ];
    return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
  }

  function completion(startupId, startup) {
    return completionOf(get(startupId), startup);
  }

  function reset(startupId) {
    const all = readAll();
    delete all[startupId];
    writeAll(all);
  }

  return {
    get, set, setField, hydrate, markSubmitted,
    getSession, setSession, clearSession,
    completion, completionOf, countAssumptions, reset
  };
})();

window.FVStore = FVStore;

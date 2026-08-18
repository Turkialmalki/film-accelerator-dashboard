/* ==========================================================================
   دورة حياة الجلسة — session lifecycle.

   States:
     NEW        no journey on this device
     ACTIVE     started, not submitted, still inside the workshop window
     COMPLETED  submitted — must never reopen on its own
     EXPIRED    untouched past the window; the cohort has moved on

   Only ACTIVE resumes. The rule exists because a founder who finishes and
   then refreshes must land on a fresh start, not back on the thank-you page:
   the device is often shared or handed round during the session, and the next
   person must never inherit the previous one's finished journey.
   ========================================================================== */

const FVSession = (() => {

  /* A workshop runs for an afternoon. Beyond this a stored draft belongs to a
     previous cohort and resuming it would be wrong, not helpful. */
  const EXPIRY_MS = 12 * 60 * 60 * 1000;

  const PREFIX = 'fvip:';

  function status(draft) {
    if (!draft || !draft.startedAt) return 'NEW';
    if (draft.submitted) return 'COMPLETED';

    const last = Date.parse(draft.updatedAt || draft.startedAt);
    if (Number.isFinite(last) && Date.now() - last > EXPIRY_MS) return 'EXPIRED';

    return 'ACTIVE';
  }

  const canResume = (draft) => status(draft) === 'ACTIVE';

  /**
   * Wipe every trace of this device's participation.
   *
   * Deliberately removes the anonymous session id too: "بدء جلسة جديدة" is
   * used when the phone is handed to a different founder, so continuing to
   * write under the previous device id would attribute one person's answers
   * to another's row.
   */
  function resetAll() {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* storage blocked — nothing useful to do */ }

    try {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => sessionStorage.removeItem(k));
    } catch { /* ignore */ }

    /* The in-memory fallback id used when storage is unavailable. */
    try { delete window.__fvSessionId; } catch { /* ignore */ }
  }

  /** Forget the journey for one startup, leaving other state alone. */
  function clearStartup(startupId) {
    if (!startupId) return;
    try {
      const key = 'fvip:drafts:v4';
      const all = JSON.parse(localStorage.getItem(key) || '{}');
      delete all[startupId];
      localStorage.setItem(key, JSON.stringify(all));
    } catch { /* ignore */ }
  }

  return { status, canResume, resetAll, clearStartup, EXPIRY_MS };
})();

window.FVSession = FVSession;

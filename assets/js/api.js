/* ==========================================================================
   Sync layer — Supabase is the source of truth for founder responses.

   Startup profiles stay in data/startups.json. Only responses go remote.

   Reliability note: twenty founders on conference wifi will drop packets.
   Failed writes go into a small outbox in localStorage and are retried until
   they land. The outbox is a delivery buffer, not a second database — it
   holds only writes that have not been acknowledged yet, and each entry is
   removed the moment the server confirms it.
   ========================================================================== */

const FVApi = (() => {

  const OUTBOX_KEY = 'fvip:outbox:v1';
  const TABLE = 'workshop_responses';
  const RETRY_MS = 6000;

  let client = null;
  let status = 'local';           // 'live' | 'local' | 'offline'
  let reason = null;              // why we are not live, for the UI to show
  let channel = null;
  let retryTimer = null;
  const statusListeners = new Set();

  const workshopId = () => FVConfig.workshopId();
  const sessionId  = () => FVConfig.sessionId();

  /* ---------------------------- Setup ---------------------------- */

  function init() {
    if (!FVConfig.isConfigured()) {
      reason = 'not-configured';
      setStatus('local');
      console.warn(
        'FVApi: Supabase is not configured. Running in local-only mode — ' +
        'responses will not sync between devices. Set SUPABASE_URL and ' +
        'SUPABASE_ANON_KEY in assets/js/config.js.'
      );
      return false;
    }
    if (typeof window.supabase?.createClient !== 'function') {
      reason = 'library-missing';
      setStatus('local');
      console.warn('FVApi: the Supabase client library did not load. Running local-only.');
      return false;
    }

    client = window.supabase.createClient(
      FVConfig.SUPABASE_URL,
      FVConfig.SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false },          // anonymous by design
        realtime: { params: { eventsPerSecond: 10 } }
      }
    );

    reason = null;
    setStatus('live');
    startRetryLoop();
    window.addEventListener('online', flush);
    return true;
  }

  const isLive = () => Boolean(client);

  /* ---------------------------- Status ---------------------------- */

  function setStatus(next) {
    if (status === next) return;
    status = next;
    statusListeners.forEach(fn => { try { fn(status); } catch { /* ignore */ } });
  }

  function onStatus(fn) {
    statusListeners.add(fn);
    fn(status);
    return () => statusListeners.delete(fn);
  }

  /* ---------------------------- Writes ---------------------------- */

  /**
   * Build the row for a startup. One row per (workshop_id, startup_id) — the
   * unique index means this upsert edits the existing answer rather than
   * creating a duplicate, which is also how "edit your previous answers"
   * works with no extra code.
   */
  function buildRow(startupId, data) {
    return {
      workshop_id: workshopId(),
      startup_id: startupId,
      session_id: sessionId(),
      participant_name: data.participantName || null,
      challenge: data.challenge?.text || '',
      challenge_tags: data.challenge?.tags || [],
      reflection_answers: data.reflections || {},
      assumption_status: data.assumptions || {},
      commitment: data.commitment || '',
      validation_score: Number(data.validationScore) || 0,
      completion_percentage: Number(data.completionPercentage) || 0,
      submitted: Boolean(data.submitted),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Upsert a response. Resolves { ok, queued, error } and never throws —
   * a sync failure must never interrupt a founder mid-journey.
   */
  async function save(startupId, data) {
    const row = buildRow(startupId, data);

    if (!isLive()) {
      enqueue(row);
      return { ok: false, queued: true, error: 'not-configured' };
    }

    try {
      const { error } = await client
        .from(TABLE)
        .upsert(row, { onConflict: 'workshop_id,startup_id' });

      if (error) throw error;

      setStatus('live');
      dequeue(startupId);          // a fresh write supersedes any queued one
      return { ok: true, queued: false, error: null };
    } catch (err) {
      console.warn('FVApi: save failed, queued for retry', err?.message || err);
      enqueue(row);
      setStatus('offline');
      return { ok: false, queued: true, error: err?.message || String(err) };
    }
  }

  /* ---------------------------- Reads ---------------------------- */

  /** All responses for the current workshop. Returns [] on failure. */
  async function fetchAll() {
    if (!isLive()) return [];
    try {
      const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('workshop_id', workshopId())
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setStatus('live');
      return data || [];
    } catch (err) {
      console.warn('FVApi: fetch failed', err?.message || err);
      setStatus('offline');
      return [];
    }
  }

  /** The single response for one startup, or null. */
  async function fetchOne(startupId) {
    if (!isLive()) return null;
    try {
      const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('workshop_id', workshopId())
        .eq('startup_id', startupId)
        .maybeSingle();

      if (error) throw error;
      setStatus('live');
      return data || null;
    } catch (err) {
      console.warn('FVApi: fetchOne failed', err?.message || err);
      setStatus('offline');
      return null;
    }
  }

  /**
   * Delete every response for the current workshop, and prove it.
   *
   * PostgREST answers 204 for a delete that matched no rows, so a missing RLS
   * policy is indistinguishable from success by status code alone. The only
   * honest confirmation is to read the workshop back and count what is left.
   *
   * Scoped to workshop_id, so startup profiles — which live in
   * data/startups.json and never in the database — cannot be touched, and
   * neither can another cohort running at the same time.
   */
  async function clearWorkshop() {
    if (!isLive()) return { ok: false, remaining: null, error: 'not-configured' };

    try {
      const { error } = await client
        .from(TABLE)
        .delete()
        .eq('workshop_id', workshopId());

      if (error) throw error;

      const remaining = await fetchAll();
      return { ok: remaining.length === 0, remaining: remaining.length, error: null };
    } catch (err) {
      console.warn('FVApi: clearWorkshop failed', err?.message || err);
      return { ok: false, remaining: null, error: err?.message || String(err) };
    }
  }

  /* ---------------------------- Realtime ---------------------------- */

  /**
   * Live updates for the mentor dashboard. The handler receives
   * (eventType, row) for every insert and update in this workshop.
   */
  function subscribe(handler) {
    if (!isLive()) return () => {};

    unsubscribe();

    channel = client
      .channel(`workshop:${workshopId()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLE,
        filter: `workshop_id=eq.${workshopId()}`
      }, (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        try { handler(payload.eventType, row); } catch (e) { console.error(e); }
      })
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          realtimeOk = true;
          setStatus('live');
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          /* Realtime is a websocket to a separate service, and it can be
             unavailable while REST is perfectly healthy — a disabled
             publication, a blocked socket on venue wifi, a proxy that drops
             upgrades. The dashboard must still update without a manual
             refresh, so failing over to polling is not a fallback for a bug,
             it is the supported second path. */
          realtimeOk = false;
          startPolling(handler);
        }
      });

    /* If the channel never reports anything at all, treat that as a failure
       too — silence is the most common websocket outcome behind a proxy. */
    clearTimeout(realtimeProbe);
    realtimeProbe = setTimeout(() => {
      if (!realtimeOk) startPolling(handler);
    }, REALTIME_GRACE_MS);

    /* A reconciliation read runs regardless of realtime health. A dropped
       websocket frame is silent by nature, and a facilitator standing in
       front of the room cannot be asked to notice that a number stopped
       moving. Twenty rows every five seconds costs nothing. */
    startReconcile(handler);

    return unsubscribe;
  }

  let reconcileTimer = null;

  function startReconcile(handler) {
    if (reconcileTimer) return;
    reconcileTimer = setInterval(async () => {
      const rows = await fetchAll();
      const seenNow = new Set();

      rows.forEach(row => {
        seenNow.add(row.startup_id);
        const seen = lastSeen.get(row.startup_id);
        if (seen === row.updated_at) return;
        lastSeen.set(row.startup_id, row.updated_at);
        try { handler(seen ? 'UPDATE' : 'INSERT', row); } catch (e) { console.error(e); }
      });

      /* Rows that vanished — a workshop cleared from another device — have to
         be reported too, or the dashboard keeps showing responses that no
         longer exist. */
      [...lastSeen.keys()].forEach(id => {
        if (seenNow.has(id)) return;
        lastSeen.delete(id);
        try { handler('DELETE', { startup_id: id }); } catch (e) { console.error(e); }
      });
    }, POLL_MS);
  }

  /* ---------------------------- Polling fallback ---------------------------- */

  let pollTimer = null;
  let realtimeOk = false;
  let realtimeProbe = null;
  let lastSeen = new Map();          // startup_id -> updated_at

  const REALTIME_GRACE_MS = 6000;
  const POLL_MS = 5000;

  /**
   * Re-read the workshop on a timer and synthesise the same events the
   * realtime channel would have delivered, so callers cannot tell the
   * difference and nothing downstream needs a second code path.
   */
  function startPolling(handler) {
    if (pollTimer) return;
    console.warn('FVApi: realtime unavailable — falling back to polling every ' + POLL_MS + 'ms');
    setStatus('polling');

    pollTimer = setInterval(async () => {
      const rows = await fetchAll();
      rows.forEach(row => {
        const seen = lastSeen.get(row.startup_id);
        if (seen === row.updated_at) return;
        lastSeen.set(row.startup_id, row.updated_at);
        try { handler(seen ? 'UPDATE' : 'INSERT', row); } catch (e) { console.error(e); }
      });
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    lastSeen = new Map();
  }

  function unsubscribe() {
    clearTimeout(realtimeProbe);
    if (reconcileTimer) { clearInterval(reconcileTimer); reconcileTimer = null; }
    stopPolling();
    if (channel && client) {
      client.removeChannel(channel);
      channel = null;
    }
  }

  /* ---------------------------- Outbox ---------------------------- */

  function readOutbox() {
    try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); }
    catch { return []; }
  }

  function writeOutbox(rows) {
    try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(rows)); }
    catch { /* storage full or blocked — nothing useful to do */ }
  }

  /** One pending write per startup: a newer answer replaces an older one. */
  function enqueue(row) {
    const rows = readOutbox().filter(r => r.startup_id !== row.startup_id);
    rows.push(row);
    writeOutbox(rows);
  }

  function dequeue(startupId) {
    writeOutbox(readOutbox().filter(r => r.startup_id !== startupId));
  }

  function pendingCount() {
    return readOutbox().length;
  }

  /** Retry every queued write. Called on a timer and on the online event. */
  async function flush() {
    if (!isLive()) return;
    const rows = readOutbox();
    if (!rows.length) return;

    for (const row of rows) {
      try {
        const { error } = await client
          .from(TABLE)
          .upsert({ ...row, updated_at: new Date().toISOString() },
                  { onConflict: 'workshop_id,startup_id' });
        if (error) throw error;
        dequeue(row.startup_id);
        setStatus('live');
      } catch {
        setStatus('offline');
        return;                    // still down; keep the rest for next time
      }
    }
  }

  function startRetryLoop() {
    if (retryTimer) return;
    retryTimer = setInterval(flush, RETRY_MS);
  }

  /* ---------------------------- Row → app shape ---------------------------- */

  /** Convert a database row into the shape the founder portal works with. */
  function rowToResponse(row) {
    if (!row) return null;
    return {
      assumptions: row.assumption_status || {},
      reflections: row.reflection_answers || {},
      challenge: {
        text: row.challenge || '',
        tags: Array.isArray(row.challenge_tags) ? row.challenge_tags : []
      },
      commitment: row.commitment || '',
      submitted: Boolean(row.submitted),
      completionPercentage: row.completion_percentage || 0,
      startedAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      completedAt: row.submitted ? (row.updated_at || null) : null
    };
  }

  return {
    init, isLive, get status() { return status; }, get reason() { return reason; }, onStatus,
    save, fetchAll, fetchOne, clearWorkshop, subscribe, unsubscribe,
    flush, pendingCount, rowToResponse, workshopId, sessionId
  };
})();

window.FVApi = FVApi;

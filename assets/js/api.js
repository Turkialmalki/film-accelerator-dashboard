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
  let channel = null;
  let retryTimer = null;
  const statusListeners = new Set();

  const workshopId = () => FVConfig.workshopId();
  const sessionId  = () => FVConfig.sessionId();

  /* ---------------------------- Setup ---------------------------- */

  function init() {
    if (!FVConfig.isConfigured()) {
      setStatus('local');
      console.warn(
        'FVApi: Supabase is not configured. Running in local-only mode — ' +
        'responses will not sync between devices. Set SUPABASE_URL and ' +
        'SUPABASE_ANON_KEY in assets/js/config.js.'
      );
      return false;
    }
    if (typeof window.supabase?.createClient !== 'function') {
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
        if (s === 'SUBSCRIBED') setStatus('live');
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('offline');
      });

    return unsubscribe;
  }

  function unsubscribe() {
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
    init, isLive, get status() { return status; }, onStatus,
    save, fetchAll, fetchOne, subscribe, unsubscribe,
    flush, pendingCount, rowToResponse, workshopId, sessionId
  };
})();

window.FVApi = FVApi;

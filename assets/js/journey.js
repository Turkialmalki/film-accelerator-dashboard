/* ==========================================================================
   رحلة التحقق — the founder journey.

   One screen, one task, five steps, about ten minutes. This file replaces the
   thirteen-section dashboard entirely.

   Screen order:
     search → analyzing → welcome → ١ المرحلة → ٢ الفرضيات → ٣ التحدي
                                  → ٤ التوصيات → ٥ الالتزام → النهاية

   `analyzing` and `welcome` carry the product's central claim: before the
   founder answers anything, the platform shows what it already knows about
   their company. That is what buys the next ten minutes of attention.

   The sync layer (api.js), the search engine (search.js), the draft cache
   (storage.js) and the Supabase schema survive the redesign untouched.
   ========================================================================== */

(() => {
  const { $, $$, esc, num, numText, minutes, countUp, debounce } = FVUI;

  /* ------------------------------ الحالة ------------------------------ */

  const state = {
    startups: [],
    startup: null,
    answers: null,
    screen: 'search',
    participantName: '',
    questions: [],
    qIndex: 0
  };

  /* Roughly how long is left, read off the question the founder is on. It is
     a reassurance, not a countdown — deliberately never ticking in real time,
     because a running clock turns reflection into a race. */
  function minutesLeft() {
    const remaining = state.questions.length - state.qIndex;
    return Math.max(1, Math.round(remaining * 0.6));
  }

  /* --------------------------- المزامنة والحفظ --------------------------- */

  function payload(submitted) {
    return {
      participantName: state.participantName,
      challenge: state.answers.challenge,
      reflections: state.answers.reflections,
      assumptions: state.answers.assumptions,
      commitment: state.answers.commitment,
      validationScore: FVStore.readinessOf(state.answers, state.startup),
      completionPercentage: completionPct(),
      submitted: submitted ?? state.answers.submitted
    };
  }

  /** Share of this founder's own question set that carries an answer. */
  function completionPct() {
    const qs = state.questions || [];
    if (!qs.length) return FVStore.completionOf(state.answers);
    const done = qs.filter(q => isAnswered(q)).length;
    return Math.round((done / qs.length) * 100);
  }

  /** Push the current draft to Supabase and reflect the outcome in the UI. */
  const pushSync = debounce(async () => {
    if (!state.startup) return;
    showSaveState('saving');
    const result = await FVApi.save(state.startup.id, payload());

    /* A queued write is still a safe write — the outbox retries until it
       lands — so the founder is told it saved rather than being alarmed
       mid-journey by a network they can do nothing about. */
    showSaveState('saved', result.ok ? '' : '✓ تم الحفظ على جهازك');
  }, 700);

  let saveTimer = null;

  function showSaveState(mode, note) {
    const nodes = $$('[data-savestate]');
    if (!nodes.length) return;
    clearTimeout(saveTimer);

    nodes.forEach(node => {
      node.className = `savestate show ${mode}`;
      node.textContent = '';
      const dot = document.createElement('span');
      dot.className = 'savestate-dot';
      node.appendChild(dot);
      node.append(mode === 'saving' ? 'جارٍ الحفظ...' : (note || '✓ تم الحفظ'));
    });

    if (mode === 'saved') {
      saveTimer = setTimeout(() => nodes.forEach(n => n.classList.remove('show')), 2600);
    }
  }

  /** Write locally (instant), then sync (eventually). */
  function record(patch) {
    state.answers = FVStore.set(state.startup.id, patch);
    pushSync();
  }

  /* ------------------------------ الإقلاع ------------------------------ */

  async function boot() {
    FVApi.init();

    try {
      const res = await fetch(FVConfig.dataUrl());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.startups = await res.json();
    } catch (err) {
      console.error('Failed to load the startup database', err);
      showFatal();
      return;
    }

    FVSearch.buildIndex(state.startups);
    wireSearch();

    await restoreOrStart();
    wirePageRestore();
    showOfflineNotice();
  }

  /**
   * The founder is told what it means for them — answers stay on this device —
   * and nothing about keys or configuration, which is the organiser's problem
   * and not theirs to act on mid-workshop.
   */
  function showOfflineNotice() {
    if (FVApi.isLive()) return;
    const host = $('.screen[data-screen="search"] .screen-body');
    if (!host) return;

    const note = document.createElement('div');
    note.className = 'notice notice--warn';
    note.setAttribute('role', 'status');
    note.innerHTML = '<span class="notice-icon" aria-hidden="true">ℹ️</span>'
      + '<span>سيتم حفظ إجاباتك على هذا الجهاز. يرجى إبلاغ منظم الورشة قبل البدء.</span>';
    host.prepend(note);
  }

  /**
   * Decide what this device should see on load.
   *
   * Only an ACTIVE journey resumes. A COMPLETED one is deliberately dropped:
   * refreshing after finishing must give a clean start, because the phone is
   * often passed to the next founder in the room.
   */
  async function restoreOrStart() {
    const id = FVStore.getSession();
    const startup = id && state.startups.find(s => s.id === id);

    if (!startup) { show('search'); return; }

    const draft = FVStore.get(id);
    const st = FVSession.status(draft);

    if (st === 'ACTIVE') { await openStartup(startup, '', true); return; }

    /* COMPLETED or EXPIRED — release the device and start over. An expired
       draft is also discarded, since it belongs to a previous cohort. */
    if (st === 'EXPIRED') FVSession.clearStartup(id);
    FVStore.clearSession();
    resetToSearch();
  }

  function resetToSearch() {
    state.startup = null;
    state.answers = null;
    state.questions = [];
    state.qIndex = 0;
    const input = $('#search-input');
    if (input) { input.value = ''; input.classList.remove('error'); }
    const err = $('#search-error');
    if (err) err.classList.remove('show');
    const btn = $('#search-submit');
    if (btn) { btn.dataset.retry = ''; btn.textContent = 'التالي'; }
    show('search');
  }

  /**
   * The back button and the mobile bfcache restore a page from memory without
   * re-running boot(), which would otherwise put a founder back inside a
   * finished journey. Re-deciding on restore closes that path.
   */
  function wirePageRestore() {
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      restoreOrStart();
    });
  }

  function showFatal() {
    $('#screens').innerHTML = `
      <section class="screen active" data-screen="fatal">
        <div class="column screen-body">
          <div class="card anim anim-1" style="text-align:center">
            <h2 style="margin-bottom:.6rem">تعذّر تحميل البيانات</h2>
            <p class="lede">يرجى التأكد من الاتصال بالإنترنت ثم إعادة تحميل الصفحة.</p>
          </div>
        </div>
      </section>`;
  }

  /* ------------------------------ التنقل ------------------------------ */

  let painted = false;

  function show(name) {
    state.screen = name;
    $$('.screen').forEach(el => el.classList.toggle('active', el.dataset.screen === name));
    renderProgress();
    window.scrollTo({ top: 0 });

    /* Move focus to the new screen's heading so a screen reader follows the
       transition instead of staying on a button that no longer exists. Skipped
       on first paint: nothing moved yet, and stealing focus on load would put
       it on a heading instead of the one field the founder needs. */
    if (!painted) { painted = true; return; }

    const heading = $(`.screen[data-screen="${name}"] h1, .screen[data-screen="${name}"] h2`);
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  function renderProgress() {
    const bar = $('#progress');

    /* The bar counts questions, so it exists only while questions are on
       screen — it would be meaningless on the reveal or the final dashboard. */
    if (state.screen !== 'question' || !state.questions.length) { bar.hidden = true; return; }
    bar.hidden = false;

    const total = state.questions.length;
    const step = state.qIndex + 1;
    const pct = Math.round((step / total) * 100);

    $('#progress-step').textContent = `السؤال ${num(step)} من ${num(total)}`;
    $('#progress-time').textContent = `${num(pct)}٪ مكتمل · ${minutes(minutesLeft())}`;
    $('#progress-fill').style.width = `${pct}%`;
    $('#progress-steps').innerHTML = state.questions
      .map((_, i) => `<span class="${i < state.qIndex ? 'done' : i === state.qIndex ? 'now' : ''}"></span>`)
      .join('');
  }

  /* ------------------------- الشاشة ١ — البحث ------------------------- */

  function wireSearch() {
    const form   = $('#search-form');
    const input  = $('#search-input');
    const error  = $('#search-error');
    const button = $('#search-submit');

    /* Clear the error the moment the founder starts correcting the spelling.
       Leaving it up while they retype reads as a second rejection. */
    input.addEventListener('input', () => {
      error.classList.remove('show');
      input.classList.remove('error');
      if (button.dataset.retry === '1') {
        button.dataset.retry = '';
        button.textContent = 'التالي';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      /* In the retry state the button's job is to clear the failed attempt,
         not to search the same text again. */
      if (button.dataset.retry === '1') {
        button.dataset.retry = '';
        button.textContent = 'التالي';
        error.classList.remove('show');
        input.classList.remove('error');
        input.value = '';
        input.focus();
        return;
      }

      const text = input.value.trim();
      if (!text) { input.focus(); return; }

      button.setAttribute('aria-disabled', 'true');
      button.textContent = 'جارٍ البحث...';

      /* The lookup itself is instantaneous. The short pause is deliberate: an
         answer that appears with no delay at all reads as "it did not really
         look", and founders retype a name that was never wrong. */
      await wait(520);

      const match = FVSearch.resolve(text);

      button.removeAttribute('aria-disabled');
      button.textContent = 'التالي';

      /* Nothing about the cohort leaks on failure: no count, no near-miss, no
         "did you mean". The founder learns only that this text did not match. */
      if (!match) return fail('لم يتم العثور على بيانات مطابقة.');

      /* A first name alone can fit several people here. Asking for the full
         name reveals nothing — no count, no names — and is far better than
         silently opening someone else's company. */
      if (match.ambiguous) return fail('يرجى كتابة الاسم كاملاً.');

      await openStartup(match.startup, text);
    });

    function fail(message) {
      error.textContent = message;
      error.classList.add('show');
      input.classList.add('error');
      button.dataset.retry = '1';
      button.textContent = 'إعادة المحاولة';
      input.focus();
    }
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* --------------------------- فتح رحلة شركة --------------------------- */

  async function openStartup(startup, typedName, resuming = false) {
    state.startup = startup;
    state.participantName = typedName || state.participantName;
    FVStore.setSession(startup.id);

    /* Resuming on the same device is not a first impression — the founder has
       already seen the reveal, so skip straight back to where they stopped. */
    if (resuming) {
      state.answers = await loadAnswers(startup);
      renderAll(resuming);

      if (state.answers.submitted) { renderDone(); show('done'); return; }

      const at = Number(state.answers.lastQuestion);
      if (Number.isInteger(at) && at > 0) {
        renderSnapshot();
        goToQuestion(at);
        return;
      }
      show('welcome');
      return;
    }

    show('analyzing');
    await runAnalysis(startup);

    renderAll(false);
    show('welcome');
  }

  async function loadAnswers(startup) {
    /* The server holds the team's shared answers — a co-founder may already
       have filled part of this in from another phone. */
    const row = await FVApi.fetchOne(startup.id);
    return row
      ? FVStore.hydrate(startup.id, FVApi.rowToResponse(row))
      : FVStore.get(startup.id);
  }

  function renderAll(resuming) {
    state.questions = FVQuestions.buildFor(state.startup);
    state.qIndex = 0;
    renderWelcome(resuming);
    renderCoach();
  }

  /* ------------------------ الشاشة ٢ — التحليل ------------------------ */

  /* Each line is work that actually happens here. The pacing exists so the
     founder can read what was done on their behalf, not to manufacture a
     wait — and the real work is awaited, so a slow network extends the step
     rather than being papered over by a fixed timer. */
  const ANALYSIS_STEPS = [
    { label: 'تم العثور على بيانات الشركة',  run: async () => {} },
    { label: 'تحليل مرحلة النمو',            run: async (s) => { state.stageRead = s.stage_ar; } },
    { label: 'مراجعة نقاط القوة',            run: async (s) => { state.advCount = (s.competitive_advantages || []).length; } },
    { label: 'تحليل التحديات الحالية',       run: async (s) => { state.riskCount = (s.current_challenges || []).length; } },
    { label: 'بناء تجربة مخصصة',             run: async (s) => { state.answers = await loadAnswers(s); } },
    { label: 'تجهيز أسئلة التحقق',           run: async (s) => { state.questions = FVQuestions.buildFor(s); } }
  ];

  async function runAnalysis(startup) {
    const host = $('#analyzing');

    host.innerHTML = `
      <p class="eyebrow anim anim-1">لحظة واحدة</p>
      <h2 class="anim anim-1" style="margin-top:.5rem">نقرأ ملف شركتك</h2>

      <div class="analysis anim anim-2" style="margin-top:2rem" aria-live="polite">
        ${ANALYSIS_STEPS.map((s, i) => `
          <div class="analysis-line" data-line="${i}">
            <span class="analysis-tick" aria-hidden="true">✓</span>
            <span>${esc(s.label)}</span>
          </div>`).join('')}
      </div>`;

    const lines = $$('.analysis-line', host);

    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      lines[i].classList.add('in');
      /* Both the real work and a readable minimum must finish before the tick
         lands, so the line never blinks past faster than it can be read. */
      await Promise.all([
        ANALYSIS_STEPS[i].run(startup),
        wait(FVUI.reducedMotion ? 0 : 420)
      ]);
      lines[i].classList.add('done');
    }

    await wait(FVUI.reducedMotion ? 0 : 260);
  }

  /* ------------------------ الشاشة ٢ — الترحيب ------------------------ */

  /**
   * The reveal.
   *
   * Everything here is already known before the founder answers anything, and
   * that is the whole point: the platform earns the next ten minutes by
   * showing it did its reading first. Read-only, no inputs, scannable in
   * about fifteen seconds.
   */
  function renderWelcome(resuming) {
    const s = state.startup;

    $('#welcome').innerHTML = `
      <p class="eyebrow anim anim-1">
        ${resuming ? 'مرحباً بعودتك' : 'تم التعرف على شركتك'}
      </p>

      <h1 class="reveal-name anim anim-1" style="margin-top:.5rem">
        ${esc(s.startup_name_ar)}
      </h1>

      <div class="chips anim anim-1" style="margin-top:.9rem">
        <span class="chip chip--accent">${esc(s.stage_ar)}</span>
        <span class="chip">${esc(s.category)}</span>
        ${s.location ? `<span class="chip">${esc(s.location)}</span>` : ''}
      </div>

      <div class="card anim anim-2" style="margin-top:1.4rem">
        <p class="card-label">ما نعرفه عن شركتك</p>
        <p class="lede" style="color:var(--ink-1);font-size:1rem;margin-top:.35rem">
          ${esc(numText(s.description))}
        </p>
      </div>

      <div class="facts anim anim-3" style="margin-top:.6rem">
        <div class="fact">
          <p class="fact-label">الإيراد السنوي</p>
          <p class="fact-value">${esc(numText(s.revenue))}</p>
        </div>
        <div class="fact">
          <p class="fact-label">حجم الفريق</p>
          <p class="fact-value">${esc(numText(s.team_size_label || s.team_size))}</p>
        </div>
      </div>

      ${s.key_strengths?.[0] ? `
        <div class="finding tone-strength anim anim-4" style="margin-top:.6rem">
          <span class="finding-icon" aria-hidden="true">✅</span>
          <div>
            <p class="finding-title">أبرز ما يميزك</p>
            <p class="finding-body">${esc(numText(s.key_strengths[0]))}</p>
          </div>
        </div>` : ''}

      <div class="card card--quiet anim anim-4" style="margin-top:1.2rem">
        <p class="card-label">هدف هذه الرحلة</p>
        <p class="lede" style="color:var(--ink-1);font-size:1rem;margin-top:.2rem">
          خلال ${minutes(10)} سنساعدك في تحديد أهم خطوة يجب تنفيذها بعد هذه الورشة.
        </p>
      </div>

      <div class="actions anim anim-5">
        <p class="muted" style="font-size:.82rem;text-align:center">
          ${num(state.questions.length)} أسئلة قصيرة · حوالي ${minutes(6)}
        </p>
        <button class="btn btn--primary" id="welcome-start">
          ${resuming ? 'أكمل رحلتك' : 'ابدأ'}
        </button>
        <button class="btn-back" id="welcome-switch" style="align-self:center">
          هذه ليست شركتي
        </button>
      </div>`;

    $('#welcome-start').addEventListener('click', () => show('coach'));

    $('#welcome-switch').addEventListener('click', () => {
      FVStore.clearSession();
      resetToSearch();
    });
  }

  /* ------------------------------ مساعدات ------------------------------ */

  function finding(tone, icon, title, body, anim = '') {
    return `
      <div class="finding ${tone} ${anim}">
        <span class="finding-icon" aria-hidden="true">${icon}</span>
        <div>
          <p class="finding-title">${esc(title)}</p>
          <p class="finding-body">${esc(numText(body))}</p>
        </div>
      </div>`;
  }

  /**
   * Fire the completion cue on a step's primary button, once.
   *
   * It marks the transition from "incomplete" to "done" — re-firing it on
   * every subsequent tap would turn a confirmation into a nag, so the flag is
   * latched and only cleared when the step becomes incomplete again.
   */
  function markReady(btn, complete) {
    if (!btn) return;
    if (!complete) { btn.dataset.ready = ''; return; }
    if (btn.dataset.ready === '1') return;
    btn.dataset.ready = '1';
    btn.classList.remove('is-ready');
    void btn.offsetWidth;                       // restart the animation
    btn.classList.add('is-ready');
  }

  /* ------------------------ الشاشة ٤ — المرشد ------------------------ */

  function renderCoach() {
    const s = state.startup;
    const paragraphs = FVCoach.messageFor(s);

    $('#coach').innerHTML = `
      <p class="eyebrow anim anim-1">قبل أن نبدأ</p>

      <div class="card anim anim-2" style="margin-top:1rem">
        <div class="stack-s">
          ${paragraphs.map((p, i) => `
            <p class="${i === 0 ? 'q-title' : 'lede'}"
               style="${i === 0 ? '' : 'font-size:1.02rem;line-height:1.95'}">${esc(numText(p))}</p>
          `).join('')}
        </div>
      </div>

      <div class="actions anim anim-3">
        <button class="btn btn--primary" id="coach-next">ابدأ التحليل</button>
        <button class="btn-back" id="coach-back" style="align-self:center">رجوع</button>
      </div>`;

    $('#coach-next').addEventListener('click', () => { renderSnapshot(); show('snapshot'); });
    $('#coach-back').addEventListener('click', () => show('welcome'));
  }

  /* ----------------------- الشاشة ٥ — اللقطة ----------------------- */

  function renderSnapshot() {
    const s = state.startup;
    const rec = FVRecommend.forStartup(s, state.answers);
    const score = Number(s.readiness) || 0;

    $('#snapshot').innerHTML = `
      <h2 class="anim anim-1">أين تقف شركتك اليوم؟</h2>

      <div class="anim anim-2" style="display:grid;place-items:center;margin:1.6rem 0 .4rem">
        ${ringMarkup(score, 'مؤشر الجاهزية')}
      </div>

      <p class="muted anim anim-2" style="text-align:center;font-size:.88rem;margin-bottom:1.4rem">
        ${esc(readinessNote(score))}
      </p>

      <div class="stack">
        ${finding('tone-strength', '✅', 'أكبر نقطة قوة',   rec.strength,  'anim anim-3')}
        ${finding('tone-risk',     '⚠️', 'أكبر مخاطرة',     rec.risk,      'anim anim-4')}
        ${finding('tone-next',     '🚀', 'الفرصة الأكبر خلال الستة أشهر القادمة',
                  s.growth_roadmap || rec.nextStep, 'anim anim-5')}
      </div>

      <div class="actions anim anim-5">
        <button class="btn btn--primary" id="snapshot-next">لنبدأ الأسئلة</button>
        <button class="btn-back" id="snapshot-back" style="align-self:center">رجوع</button>
      </div>`;

    requestAnimationFrame(() => {
      const fill = $('#snapshot .fill');
      if (fill) fill.style.strokeDashoffset = fill.dataset.target;
      countUp($('#snapshot .score-number'), score, { suffix: '٪' });
    });

    $('#snapshot-next').addEventListener('click', () => goToQuestion(0));
    $('#snapshot-back').addEventListener('click', () => show('coach'));
  }

  function readinessNote(score) {
    if (score >= 75) return 'جاهزية مرتفعة — التركيز الآن على التوسع لا على الإثبات.';
    if (score >= 60) return 'جاهزية جيدة — بقيت فجوات محددة تستحق الإغلاق.';
    if (score >= 45) return 'جاهزية متوسطة — الأساسيات تحتاج إثباتاً قبل التوسع.';
    return 'مرحلة مبكرة — الأولوية للتحقق بأقل تكلفة ممكنة.';
  }

  /* --------------------- الأسئلة — شاشة لكل سؤال --------------------- */

  function goToQuestion(index) {
    state.qIndex = Math.max(0, Math.min(index, state.questions.length - 1));
    /* Remembered locally so a refresh, a dropped connection or a locked phone
       returns the founder to the question they were on rather than to the
       start of the journey. Kept out of the sync payload — where you are is a
       property of this device, not of the team's shared answer. */
    FVStore.set(state.startup.id, { lastQuestion: state.qIndex });
    renderQuestion();
    show('question');
  }

  /* ---- reading and writing one answer, wherever it is stored ---- */

  function answerOf(q) {
    const a = state.answers;
    const where = q.store ? q.store[0] : null;
    if (where === 'assumptions')   return (a.assumptions || {})[q.store[1]];
    if (where === 'challengeTag')  return (a.challenge?.tags || [])[0];
    if (where === 'challengeText') return a.challenge?.text || '';
    if (where === 'commitment')    return a.commitment || '';
    return (a.reflections || {})[q.id];
  }

  function writeAnswer(q, value) {
    const a = state.answers;
    const where = q.store ? q.store[0] : null;
    if (where === 'assumptions') {
      record({ assumptions: { ...a.assumptions, [q.store[1]]: value } });
    } else if (where === 'challengeTag') {
      record({ challenge: { ...a.challenge, tags: [value] } });
    } else if (where === 'challengeText') {
      record({ challenge: { ...a.challenge, text: value } });
    } else if (where === 'commitment') {
      record({ commitment: value });
    } else {
      record({ reflections: { ...a.reflections, [q.id]: value } });
    }
  }

  function isAnswered(q) {
    const v = answerOf(q);
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    return v !== undefined && v !== null && v !== '';
  }

  /* ---- the renderer ---- */

  function renderQuestion() {
    const q = state.questions[state.qIndex];
    const last = state.qIndex === state.questions.length - 1;

    $('#question').innerHTML = `
      <h2 class="q-title anim anim-1">${esc(numText(q.title))}</h2>
      ${q.quote ? `<div class="q-quote anim anim-1">${esc(numText(q.quote))}</div>` : ''}
      ${q.hint  ? `<p class="q-hint anim anim-1">${esc(q.hint)}</p>` : ''}

      <div class="anim anim-2" style="margin-top:1.5rem" id="q-body">${bodyFor(q)}</div>

      <div class="actions anim anim-3">
        <span class="savestate" data-savestate></span>
        <button class="btn btn--primary" id="q-next">${last ? 'إنهاء الرحلة' : 'التالي'}</button>
        <button class="btn-back" id="q-back" style="align-self:center">رجوع</button>
      </div>`;

    wireBody(q);
    syncNext(q);

    $('#q-next').addEventListener('click', async () => {
      if (last) return submitJourney();
      goToQuestion(state.qIndex + 1);
    });

    $('#q-back').addEventListener('click', () => {
      if (state.qIndex === 0) return show('snapshot');
      goToQuestion(state.qIndex - 1);
    });
  }

  function syncNext(q) {
    const btn = $('#q-next');
    if (!btn) return;
    const ok = !q.required || isAnswered(q);
    if (ok) btn.removeAttribute('aria-disabled');
    else btn.setAttribute('aria-disabled', 'true');
    markReady(btn, ok && q.required);
  }

  /* ---- markup per answer type ---- */

  function bodyFor(q) {
    const v = answerOf(q);

    if (q.type === 'choice') {
      const wide = q.options.length > 3 || q.options.some(o => o.label.length > 14);
      return `<div class="choices ${wide ? '' : 'choices--' + q.options.length}"
                   role="radiogroup" aria-label="${esc(q.title)}" id="q-choices">
        ${q.options.map(o => choiceMarkup(o.id, o.label, v === o.id)).join('')}
      </div>`;
    }

    if (q.type === 'multi') {
      const picked = Array.isArray(v) ? v : [];
      return `<div class="choices" role="group" aria-label="${esc(q.title)}" id="q-multi">
        ${q.options.map(o => `
          <button type="button" class="choice" role="checkbox" data-value="${esc(o.id)}"
                  aria-checked="${picked.includes(o.id) ? 'true' : 'false'}">
            <span class="choice-check" aria-hidden="true">✓</span>
            <span>${esc(o.label)}</span>
          </button>`).join('')}
      </div>`;
    }

    if (q.type === 'scale') {
      const cur = Number(v) || 0;
      return `<div class="scale">
        <div class="scale-row" role="radiogroup" aria-label="${esc(q.title)}" id="q-scale">
          ${[1, 2, 3, 4, 5].map(n => `
            <button type="button" class="scale-step" role="radio" data-value="${n}"
                    aria-checked="${cur === n ? 'true' : 'false'}"
                    aria-label="${num(n)} من ${num(5)}">${num(n)}</button>`).join('')}
        </div>
        <div class="scale-ends"><span>${esc(q.labels[0])}</span><span>${esc(q.labels[1])}</span></div>
      </div>`;
    }

    if (q.type === 'slider') {
      const cur = v === undefined || v === '' ? q.value : Number(v);
      return `<div>
        <p class="slider-value tabular" id="q-slider-value">${esc(num(q.unit(cur)))}</p>
        <input class="slider" id="q-slider" type="range"
               min="${q.min}" max="${q.max}" step="${q.step}" value="${cur}"
               aria-label="${esc(q.title)}">
      </div>`;
    }

    if (q.type === 'rank') {
      const order = Array.isArray(v) ? v : [];
      return `<div class="rank-list" id="q-rank">
        ${q.options.map(o => {
          const at = order.indexOf(o.id);
          return `<button type="button" class="rank-item" data-value="${esc(o.id)}"
                          data-picked="${at >= 0 ? 1 : 0}"
                          aria-pressed="${at >= 0 ? 'true' : 'false'}">
            <span class="rank-badge">${at >= 0 ? num(at + 1) : ''}</span>
            <span>${esc(numText(o.label))}</span>
          </button>`;
        }).join('')}
      </div>`;
    }

    /* text / longtext */
    return `<label class="field">
      <textarea class="textarea" id="q-text" rows="${q.type === 'longtext' ? 5 : 3}"
                placeholder="${esc(q.placeholder || '')}">${esc(v || '')}</textarea>
    </label>`;
  }

  function wireBody(q) {
    if (q.type === 'choice') {
      wireChoiceGroup($('#q-choices'), (value) => { writeAnswer(q, value); syncNext(q); });
      return;
    }

    if (q.type === 'multi') {
      $$('#q-multi .choice').forEach(btn => btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-checked') === 'true';
        btn.setAttribute('aria-checked', String(!on));
        const picked = $$('#q-multi .choice[aria-checked="true"]').map(b => b.dataset.value);
        writeAnswer(q, picked);
        syncNext(q);
      }));
      return;
    }

    if (q.type === 'scale') {
      const steps = $$('#q-scale .scale-step');
      steps.forEach(btn => btn.addEventListener('click', () => {
        steps.forEach(b => b.setAttribute('aria-checked', String(b === btn)));
        writeAnswer(q, Number(btn.dataset.value));
        syncNext(q);
      }));
      return;
    }

    if (q.type === 'slider') {
      const input = $('#q-slider');
      const label = $('#q-slider-value');
      const paint = () => { label.textContent = num(q.unit(Number(input.value))); };
      input.addEventListener('input', () => { paint(); writeAnswer(q, Number(input.value)); syncNext(q); });
      /* A slider always shows a value, so it counts as answered on arrival —
         otherwise the founder is blocked by a control that looks complete. */
      if (!isAnswered(q)) writeAnswer(q, Number(input.value));
      return;
    }

    if (q.type === 'rank') {
      const items = $$('#q-rank .rank-item');
      items.forEach(btn => btn.addEventListener('click', () => {
        const cur = Array.isArray(answerOf(q)) ? [...answerOf(q)] : [];
        const at = cur.indexOf(btn.dataset.value);
        /* Tapping a ranked item removes it, so a mistake is one tap to undo
           rather than a restart. */
        if (at >= 0) cur.splice(at, 1); else cur.push(btn.dataset.value);
        writeAnswer(q, cur);
        repaintRank(q, cur);
        syncNext(q);
      }));
      return;
    }

    const box = $('#q-text');
    if (box) box.addEventListener('input', () => { writeAnswer(q, box.value); syncNext(q); });
  }

  function repaintRank(q, order) {
    $$('#q-rank .rank-item').forEach(btn => {
      const at = order.indexOf(btn.dataset.value);
      btn.dataset.picked = at >= 0 ? '1' : '0';
      btn.setAttribute('aria-pressed', at >= 0 ? 'true' : 'false');
      btn.querySelector('.rank-badge').textContent = at >= 0 ? num(at + 1) : '';
    });
  }

  /* --------------------------- الإرسال والنهاية --------------------------- */

  async function submitJourney() {
    const btn = $('#q-next');
    btn.setAttribute('aria-disabled', 'true');
    btn.textContent = 'جارٍ الإرسال...';

    state.answers = FVStore.markSubmitted(state.startup.id);
    await FVApi.save(state.startup.id, payload(true));

    /* The journey is now COMPLETED. Releasing the pointer is what makes a
       refresh start clean instead of reopening this dashboard. */
    FVStore.clearSession();

    btn.removeAttribute('aria-disabled');
    btn.textContent = 'إنهاء الرحلة';

    renderDone();
    show('done');
  }

  function renderDone() {
    const s = state.startup;
    const d = FVRecommend.dashboardFor(s, state.answers);

    $('#done').innerHTML = `
      <div style="text-align:center">
        <span class="celebrate" aria-hidden="true">🎉</span>
        <h1 class="anim anim-1" style="margin-top:1rem">تم الانتهاء بنجاح</h1>
        <p class="lede anim anim-1" style="margin-top:.5rem">تم إرسال إجاباتك بنجاح.</p>
      </div>

      <div class="anim anim-2" style="display:grid;place-items:center;margin:2rem 0 1.4rem">
        ${ringMarkup(d.score, 'جاهزية شركتك')}
      </div>

      ${d.focus ? `
        <div class="card card--quiet anim anim-2" style="margin-bottom:1rem">
          <p class="card-label">أين طلبت الدعم</p>
          <p class="card-value" style="color:var(--amber)">${esc(d.focus)}</p>
        </div>` : ''}

      <div class="card anim anim-3">
        <p class="eyebrow" style="margin-bottom:.9rem">أهم ٣ أولويات لشركتك</p>
        <ol class="numbered">
          ${d.priorities.map(p => `<li><span>${esc(numText(p))}</span></li>`).join('')}
        </ol>
      </div>

      <div class="stack" style="margin-top:1rem">
        ${finding('tone-strength', '✅', 'أكبر نقطة قوة',  d.strength,    'anim anim-4')}
        ${finding('tone-risk',     '⚠️', 'أهم مخاطرة',     d.risk,        'anim anim-4')}
        ${finding('tone-next',     '🎯', 'أفضل خطوة قادمة', d.nextStep,   'anim anim-5')}
      </div>

      <div class="card card--quiet anim anim-5" style="margin-top:1.2rem">
        <p class="lede" style="font-size:.98rem">
          شكراً لمشاركتك.<br>
          سيتم استخدام إجاباتك بشكل مجهول لمناقشة التحديات المشتركة بين الشركات
          في نهاية الورشة.
        </p>
      </div>

      <div class="actions anim anim-5">
        <span class="savestate" data-savestate></span>
        <button class="btn btn--primary" id="done-finish">إنهاء</button>
        <button class="btn-back" id="done-edit" style="align-self:center">تعديل إجاباتي</button>
        <button class="btn-back" id="done-restart-top" style="align-self:center">بدء جلسة جديدة</button>
      </div>`;

    requestAnimationFrame(() => {
      const fill = $('#done .fill');
      if (fill) fill.style.strokeDashoffset = fill.dataset.target;
      countUp($('#done .score-number'), d.score, { suffix: '٪' });
    });

    $('#done-finish').addEventListener('click', () => {
      $('#done').innerHTML = `
        <div style="text-align:center" class="anim anim-1">
          <img src="assets/images/fba-mark-light.svg" alt="" width="46" height="54"
               style="opacity:.45;margin-bottom:1.6rem">
          <h2>شكراً لك</h2>
          <p class="lede" style="margin-top:.7rem">
            يمكنك إغلاق هذه الصفحة الآن والعودة إلى الورشة.
          </p>
          <div class="actions">
            <button class="btn btn--ghost" id="done-restart">بدء جلسة جديدة</button>
          </div>
        </div>`;
      $('#done-restart').addEventListener('click', startFresh);
    });

    /* Editing re-opens the journey on this device, so the pointer has to come
       back — it was released at submit. */
    $('#done-edit').addEventListener('click', () => {
      FVStore.setSession(state.startup.id);
      goToQuestion(0);
    });

    $('#done-restart-top').addEventListener('click', startFresh);
  }

  /** Full reset — used when the phone is handed to the next founder. */
  function startFresh() {
    FVSession.resetAll();
    resetToSearch();
    FVUI.toast('تم بدء جلسة جديدة');
  }

  function ringMarkup(score, caption) {
    const size = 190, r = 84;
    const c = 2 * Math.PI * r;
    return `
      <div class="score-ring" style="width:${size}px;height:${size}px"
           role="img" aria-label="${esc(caption)} ${num(score)} بالمئة">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stop-color="#F89C49"/>
              <stop offset="100%" stop-color="#FBAE40"/>
            </linearGradient>
          </defs>
          <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}"/>
          <circle class="fill"  cx="${size / 2}" cy="${size / 2}" r="${r}"
                  stroke-dasharray="${c}" stroke-dashoffset="${c}"
                  data-target="${c * (1 - score / 100)}"/>
        </svg>
        <div class="score-center">
          <div>
            <div class="score-number tabular">${num(0)}٪</div>
            <div class="score-caption">${esc(caption)}</div>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------ الاختيارات ------------------------------ */

  function choiceMarkup(id, label, checked) {
    return `
      <button type="button" class="choice" role="radio" data-value="${esc(id)}"
              aria-checked="${checked ? 'true' : 'false'}">
        <span class="choice-dot" aria-hidden="true"></span>
        <span>${esc(label)}</span>
      </button>`;
  }

  /**
   * Radio-group behaviour on buttons: single selection, arrow-key roving, and
   * aria-checked as the one source of truth for what is on.
   */
  function wireChoiceGroup(group, onSelect) {
    if (!group) return;
    const options = $$('.choice', group);

    const select = (btn) => {
      options.forEach(o => o.setAttribute('aria-checked', String(o === btn)));
      onSelect(btn.dataset.value);
    };

    options.forEach((btn, i) => {
      btn.addEventListener('click', () => select(btn));

      btn.addEventListener('keydown', (e) => {
        /* RTL: ArrowLeft moves forward through the list, ArrowRight back. */
        const step = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const next = options[(i + step + options.length) % options.length];
        next.focus();
        select(next);
      });
    });
  }

  /* -------------------------------- انطلق -------------------------------- */

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

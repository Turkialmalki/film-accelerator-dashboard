/* ==========================================================================
   رحلة التحقق — the founder journey.

   One screen, one task, five steps, about ten minutes. This file replaces the
   thirteen-section dashboard entirely.

   Screen order:
     search → welcome → ١ المرحلة → ٢ الفرضيات → ٣ التحدي
                      → ٤ التوصيات → ٥ الالتزام → النهاية

   The sync layer (api.js), the search engine (search.js), the draft cache
   (storage.js) and the Supabase schema survive the redesign untouched.
   ========================================================================== */

(() => {
  const { $, $$, esc, num, minutes, countUp, debounce } = FVUI;

  /* ------------------------------ الحالة ------------------------------ */

  const state = {
    startups: [],
    startup: null,
    answers: null,
    screen: 'search',
    participantName: ''
  };

  /* Only the five answered steps carry a progress number. The search, welcome
     and final screens sit outside the count. */
  const STEPS = ['stage', 'assumptions', 'challenge', 'insights', 'commitment'];
  const TOTAL_STEPS = STEPS.length;

  /* Rough minutes still to spend, read off the step the founder is on. It is
     a reassurance, not a countdown — deliberately never ticking in real time,
     because a running clock turns reflection into a race. */
  const REMAINING = { stage: 9, assumptions: 7, challenge: 5, insights: 3, commitment: 2 };

  /* ------------------------------ المحتوى ------------------------------ */

  const CHALLENGE_AREAS = [
    { id: 'customers',  label: 'العملاء' },
    { id: 'marketing',  label: 'التسويق' },
    { id: 'product',    label: 'المنتج' },
    { id: 'pricing',    label: 'التسعير' },
    { id: 'investment', label: 'الاستثمار' },
    { id: 'team',       label: 'الفريق' }
  ];

  const ASSUMPTION_QUESTIONS = [
    {
      key: 'talked',
      question: 'هل تحدثت مع عملائك؟',
      options: [{ id: 'yes', label: 'نعم' }, { id: 'no', label: 'لا' }, { id: 'partly', label: 'جزئياً' }]
    },
    {
      key: 'paid',
      question: 'هل سبق أن دفع أحد مقابل خدمتك؟',
      options: [{ id: 'yes', label: 'نعم' }, { id: 'no', label: 'لا' }]
    },
    {
      key: 'problem',
      question: 'هل تعرف بالضبط المشكلة التي تحلها؟',
      options: [{ id: 'yes', label: 'نعم' }, { id: 'no', label: 'لا' }]
    }
  ];

  /* --------------------------- المزامنة والحفظ --------------------------- */

  function payload(submitted) {
    return {
      participantName: state.participantName,
      challenge: state.answers.challenge,
      reflections: state.answers.reflections,
      assumptions: state.answers.assumptions,
      commitment: state.answers.commitment,
      validationScore: FVStore.readinessOf(state.answers, state.startup),
      completionPercentage: FVStore.completionOf(state.answers),
      submitted: submitted ?? state.answers.submitted
    };
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

    /* Returning on the same device — pick the journey back up rather than
       asking the founder to identify themselves a second time. */
    const resumeId = FVStore.getSession();
    const resume = resumeId && state.startups.find(s => s.id === resumeId);
    if (resume) await openStartup(resume, '', true);
    else show('search');
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
    const idx = STEPS.indexOf(state.screen);

    /* The bar is a step counter, so it exists only during the five steps. */
    if (idx < 0) { bar.hidden = true; return; }
    bar.hidden = false;

    const step = idx + 1;
    $('#progress-step').textContent = `الخطوة ${num(step)} من ${num(TOTAL_STEPS)}`;
    $('#progress-time').textContent = `الوقت المتبقي: ${minutes(REMAINING[state.screen] ?? 2)}`;
    $('#progress-fill').style.width = `${(step / TOTAL_STEPS) * 100}%`;
    $('#progress-steps').innerHTML = STEPS
      .map((_, i) => `<span class="${i < idx ? 'done' : i === idx ? 'now' : ''}"></span>`)
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
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();

      if (!text) return fail('يرجى كتابة اسمك أو اسم شركتك.');

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
      if (!match) {
        return fail('لم يتم العثور على الاسم.<br>يرجى التأكد من كتابة اسمك أو اسم الشركة بشكل صحيح.');
      }

      await openStartup(match.startup, text);
    });

    function fail(html) {
      error.innerHTML = html;
      error.classList.add('show');
      input.classList.add('error');
      input.focus();
    }
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* --------------------------- فتح رحلة شركة --------------------------- */

  async function openStartup(startup, typedName, resuming = false) {
    state.startup = startup;
    state.participantName = typedName || state.participantName;
    FVStore.setSession(startup.id);

    /* The server holds the team's shared answers — a co-founder may already
       have filled part of this in from another phone. */
    const row = await FVApi.fetchOne(startup.id);
    state.answers = row
      ? FVStore.hydrate(startup.id, FVApi.rowToResponse(row))
      : FVStore.get(startup.id);

    renderWelcome(resuming);
    renderStage();
    renderAssumptions();
    renderChallenge();
    renderCommitment();

    if (state.answers.submitted) { renderDone(); show('done'); }
    else show('welcome');
  }

  /* ------------------------ الشاشة ٢ — الترحيب ------------------------ */

  function renderWelcome(resuming) {
    const s = state.startup;

    $('#welcome').innerHTML = `
      <p class="eyebrow anim anim-1">${resuming ? 'مرحباً بعودتك' : 'مرحباً 👋'}</p>

      <h1 class="anim anim-1" style="margin-top:.5rem">
        أهلاً بك في ورشة<br>التحقق من الشركات الناشئة.
      </h1>

      <div class="stack anim anim-2" style="margin-top:2rem">
        <div class="card">
          <p class="card-label">الشركة</p>
          <p class="card-value">${esc(s.startup_name_ar)}</p>
        </div>

        <div class="card card--quiet">
          <p class="card-label">هدف هذه الرحلة</p>
          <p class="lede" style="color:var(--ink-1);margin-top:.2rem">
            سنساعدك في معرفة أهم خطوة يجب تنفيذها بعد هذه الورشة.
          </p>
        </div>

        <div class="card card--quiet">
          <p class="card-label">مدة التمرين</p>
          <p class="card-value">حوالي ${minutes(10)}</p>
        </div>
      </div>

      <div class="actions anim anim-3">
        <p class="muted" style="font-size:.82rem;text-align:center">
          الخطوة ${num(1)} من ${num(TOTAL_STEPS)}
        </p>
        <button class="btn btn--primary" id="welcome-start">
          ${resuming ? 'أكمل رحلتك' : 'ابدأ'}
        </button>
        <button class="btn-back" id="welcome-switch" style="align-self:center">
          هذه ليست شركتي
        </button>
      </div>`;

    $('#welcome-start').addEventListener('click', () => show('stage'));

    $('#welcome-switch').addEventListener('click', () => {
      FVStore.clearSession();
      state.startup = null;
      $('#search-input').value = '';
      show('search');
    });
  }

  /* ---------------------- الخطوة ١ — مرحلتك الحالية ---------------------- */

  function renderStage() {
    const s = state.startup;
    const chosen = (state.answers.challenge?.tags || [])[0] || '';

    $('#stage').innerHTML = `
      <h2 class="anim anim-1">مرحلتك الحالية</h2>

      <div class="card anim anim-2" style="margin-top:1.2rem">
        <p class="card-label">أين تقف شركتك اليوم</p>
        <p class="card-value" style="color:var(--amber);font-size:1.42rem">${esc(s.stage_ar)}</p>
        <p class="lede" style="margin-top:.8rem;font-size:1rem">${esc(s.stage_summary_ar)}</p>
      </div>

      <hr class="rule anim anim-3">

      <h3 class="anim anim-3">ما هو أكبر تحدٍ تواجهه اليوم؟</h3>

      <div class="choices anim anim-4" role="radiogroup" id="stage-choices"
           aria-label="ما هو أكبر تحدٍ تواجهه اليوم؟" style="margin-top:1rem">
        ${CHALLENGE_AREAS.map(a => choiceMarkup(a.id, a.label, a.id === chosen)).join('')}
      </div>

      <div class="actions anim anim-5">
        <span class="savestate" data-savestate></span>
        <button class="btn btn--primary" id="stage-next" ${chosen ? '' : 'aria-disabled="true"'}>التالي</button>
        <button class="btn-back" id="stage-back" style="align-self:center">رجوع</button>
      </div>`;

    wireChoiceGroup($('#stage-choices'), (id) => {
      record({ challenge: { ...state.answers.challenge, tags: [id] } });
      $('#stage-next').removeAttribute('aria-disabled');
    });

    $('#stage-next').addEventListener('click', () => show('assumptions'));
    $('#stage-back').addEventListener('click', () => show('welcome'));
  }

  /* -------------------- الخطوة ٢ — التحقق من الفرضيات -------------------- */

  function renderAssumptions() {
    const saved = state.answers.assumptions || {};

    $('#assumptions').innerHTML = `
      <h2 class="anim anim-1">التحقق من الفرضيات</h2>
      <p class="lede anim anim-1" style="margin-top:.5rem">ثلاثة أسئلة فقط.</p>

      <div class="stack-l anim anim-2" style="margin-top:1.8rem">
        ${ASSUMPTION_QUESTIONS.map(q => `
          <div>
            <h3 style="margin-bottom:.85rem">${esc(q.question)}</h3>
            <div class="choices choices--${q.options.length}" role="radiogroup"
                 aria-label="${esc(q.question)}" data-question="${esc(q.key)}">
              ${q.options.map(o => choiceMarkup(o.id, o.label, saved[q.key] === o.id)).join('')}
            </div>
          </div>`).join('')}
      </div>

      <div class="actions anim anim-3">
        <span class="savestate" data-savestate></span>
        <button class="btn btn--primary" id="assumptions-next">التالي</button>
        <button class="btn-back" id="assumptions-back" style="align-self:center">رجوع</button>
      </div>`;

    $$('[data-question]', $('#assumptions')).forEach(group => {
      wireChoiceGroup(group, (value) => {
        record({ assumptions: { ...state.answers.assumptions, [group.dataset.question]: value } });
        syncAssumptionsButton();
      });
    });

    syncAssumptionsButton();

    $('#assumptions-next').addEventListener('click', () => show('challenge'));
    $('#assumptions-back').addEventListener('click', () => show('stage'));
  }

  function syncAssumptionsButton() {
    const btn = $('#assumptions-next');
    if (!btn) return;
    const a = state.answers.assumptions || {};
    const done = ASSUMPTION_QUESTIONS.every(q => a[q.key]);

    /* Not toggleAttribute: it writes aria-disabled="", which is a valid
       "present" attribute but never matches [aria-disabled="true"], so both
       the dimmed style and the pointer-events guard would silently no-op. */
    if (done) btn.removeAttribute('aria-disabled');
    else btn.setAttribute('aria-disabled', 'true');
  }

  /* ---------------------- الخطوة ٣ — تحديك الحالي ---------------------- */

  function renderChallenge() {
    $('#challenge').innerHTML = `
      <h2 class="anim anim-1">تحديك الحالي</h2>

      <label class="field anim anim-2" style="margin-top:1.5rem">
        <span class="field-label">ما هو أكبر تحدٍ تواجهه شركتك اليوم؟</span>
        <textarea class="textarea" id="challenge-text" rows="6"
                  placeholder="اكتب بصراحة — لن يُعرض اسم شركتك مع هذه الإجابة."
        >${esc(state.answers.challenge?.text || '')}</textarea>
      </label>

      <div class="actions anim anim-3">
        <span class="savestate" data-savestate></span>
        <button class="btn btn--primary" id="challenge-next">التالي</button>
        <button class="btn-back" id="challenge-back" style="align-self:center">رجوع</button>
      </div>`;

    const box = $('#challenge-text');
    box.addEventListener('input', () => {
      record({ challenge: { ...state.answers.challenge, text: box.value } });
    });

    $('#challenge-next').addEventListener('click', () => {
      renderInsights();
      show('insights');
    });
    $('#challenge-back').addEventListener('click', () => show('assumptions'));
  }

  /* ------------------ الخطوة ٤ — توصيات خاصة بشركتك ------------------ */

  /* Rendered on entry rather than up front, because it reads the answers the
     founder gave on the three steps before it. */
  function renderInsights() {
    const rec = FVRecommend.forStartup(state.startup, state.answers);

    $('#insights').innerHTML = `
      <h2 class="anim anim-1">توصيات خاصة بشركتك</h2>
      <p class="lede anim anim-1" style="margin-top:.5rem">بناءً على مرحلتك وإجاباتك.</p>

      <div class="stack anim anim-2" style="margin-top:1.6rem">
        ${finding('tone-strength', '✅', 'نقطة قوة',        rec.strength)}
        ${finding('tone-risk',     '⚠️', 'أكبر مخاطرة',     rec.risk)}
        ${finding('tone-next',     '🎯', 'أفضل خطوة تالية', rec.nextStep)}
      </div>

      <div class="actions anim anim-3">
        <button class="btn btn--primary" id="insights-next">التالي</button>
        <button class="btn-back" id="insights-back" style="align-self:center">رجوع</button>
      </div>`;

    $('#insights-next').addEventListener('click', () => show('commitment'));
    $('#insights-back').addEventListener('click', () => show('challenge'));
  }

  function finding(tone, icon, title, body) {
    return `
      <div class="finding ${tone}">
        <span class="finding-icon" aria-hidden="true">${icon}</span>
        <div>
          <p class="finding-title">${esc(title)}</p>
          <p class="finding-body">${esc(body)}</p>
        </div>
      </div>`;
  }

  /* ----------------------- الخطوة ٥ — التزامك ----------------------- */

  function renderCommitment() {
    $('#commitment').innerHTML = `
      <h2 class="anim anim-1">التزامك</h2>

      <label class="field anim anim-2" style="margin-top:1.5rem">
        <span class="field-label">ما أول خطوة ستقوم بها بعد انتهاء هذه الورشة؟</span>
        <textarea class="textarea" id="commitment-text" rows="5"
                  placeholder="قبل الورشة القادمة سأقوم بـ..."
        >${esc(state.answers.commitment || '')}</textarea>
      </label>

      <div class="actions anim anim-3">
        <span class="savestate" data-savestate></span>
        <button class="btn btn--primary" id="commitment-submit">إنهاء الرحلة</button>
        <button class="btn-back" id="commitment-back" style="align-self:center">رجوع</button>
      </div>`;

    const box = $('#commitment-text');
    box.addEventListener('input', () => record({ commitment: box.value }));

    $('#commitment-submit').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.setAttribute('aria-disabled', 'true');
      btn.textContent = 'جارٍ الإرسال...';

      state.answers = FVStore.markSubmitted(state.startup.id);

      /* The one write that is not debounced: the founder is about to stop
         touching the page, so it has to leave now. */
      await FVApi.save(state.startup.id, payload(true));

      btn.removeAttribute('aria-disabled');
      btn.textContent = 'إنهاء الرحلة';

      renderDone();
      show('done');
    });

    $('#commitment-back').addEventListener('click', () => show('insights'));
  }

  /* -------------------------- الشاشة النهائية -------------------------- */

  function renderDone() {
    const s = state.startup;
    const rec = FVRecommend.forStartup(s, state.answers);
    const score = FVStore.readinessOf(state.answers, s);

    $('#done').innerHTML = `
      <div style="text-align:center">
        <span class="celebrate" aria-hidden="true">🎉</span>
        <h1 class="anim anim-1" style="margin-top:1rem">تم الانتهاء بنجاح</h1>
        <p class="lede anim anim-1" style="margin-top:.5rem">تم إرسال إجابتك بنجاح.</p>
      </div>

      <div class="anim anim-2" style="display:grid;place-items:center;margin:2.2rem 0 1.6rem">
        ${ringMarkup(score)}
      </div>

      <div class="stack anim anim-3">
        ${finding('tone-risk', '⚠️', 'أهم مخاطرة',      rec.risk)}
        ${finding('tone-next', '🎯', 'أفضل خطوة قادمة', rec.nextStep)}
      </div>

      <div class="card card--quiet anim anim-4" style="margin-top:1.4rem">
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
      </div>`;

    /* Ring and number animate together, once the screen is actually on. */
    requestAnimationFrame(() => {
      const fill = $('#done .fill');
      if (fill) fill.style.strokeDashoffset = fill.dataset.target;
      countUp($('#done .score-number'), score, { suffix: '٪' });
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
        </div>`;
    });

    $('#done-edit').addEventListener('click', () => show('stage'));
  }

  function ringMarkup(score) {
    const size = 190, r = 84;
    const c = 2 * Math.PI * r;
    return `
      <div class="score-ring" style="width:${size}px;height:${size}px"
           role="img" aria-label="جاهزية شركتك ${num(score)} بالمئة">
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
            <div class="score-caption">جاهزية شركتك</div>
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

/* ==========================================================================
   لوحة المدرب — anonymous cohort view.

   The privacy rule is structural, not a habit: analyse() is the only function
   that touches a database row, and it never copies startup_name, founder
   names, participant_name, session_id or startup_id onto the object the UI
   renders. Nothing downstream can leak an identity even by accident.

   Six numbers, two rankings, a word cloud, three insights, five topics and a
   live completion bar. No charts.
   ========================================================================== */

(() => {
  const { $, $$, esc, num, companies, times, countUp, debounce, toast } = FVUI;

  const PASSWORD = 'accelerator2026';
  const UNLOCK_KEY = 'fvip:mentor-unlocked';

  /* responses: startup_id → row. A map so one realtime event replaces exactly
     one entry instead of refetching the whole workshop. */
  const state = {
    startups: [],
    responses: {},
    lastEventAt: null,
    summaryOpen: false
  };

  /* Earliest to latest. Mirrors the stage_ar values in data/startups.json,
     which follow the accelerator report's own vocabulary. */
  const STAGE_ORDER = ['ما قبل التأسيس', 'المنتج الأولي', 'التأسيس',
                       'ما قبل الجولة أ', 'الجولة أ'];

  const AREA_LABELS = {
    customers: 'العملاء', marketing: 'التسويق', product: 'المنتج',
    pricing: 'التسعير', investment: 'الاستثمار', team: 'الفريق'
  };

  const ASSUMPTION_LABELS = {
    talked:  'التحدث مع العملاء',
    paid:    'وجود عميل دافع',
    problem: 'وضوح المشكلة'
  };

  /* The multi-select from the question engine. Founders name these themselves,
     which makes them the strongest read on what the room has not validated. */
  const UNTESTED_LABELS = {
    willingness: 'استعداد العميل للدفع بالسعر الحالي',
    channel:     'قناة وصول متكررة للعملاء',
    retention:   'بقاء العميل بعد أول تجربة',
    problem:     'أن المشكلة مؤلمة بما يكفي',
    margin:      'أن الهامش يصمد عند التوسع',
    ops:         'قدرة التشغيل على الحمل الأكبر'
  };

  /* ------------------------------ البوابة ------------------------------ */

  function initGate() {
    if (sessionStorage.getItem(UNLOCK_KEY) === '1') return unlock();

    const form  = $('#gate-form');
    const input = $('#gate-password');
    const error = $('#gate-error');

    input.addEventListener('input', () => error.classList.remove('show'));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input.value === PASSWORD) {
        sessionStorage.setItem(UNLOCK_KEY, '1');
        unlock();
      } else {
        error.textContent = 'كلمة المرور غير صحيحة. يرجى مراجعة منظم الورشة.';
        error.classList.add('show');
        input.value = '';
        input.focus();
      }
    });
  }

  function unlock() {
    $('#gate').hidden = true;
    $('#dash').hidden = false;
    boot();
  }

  /* ------------------------------ الإقلاع ------------------------------ */

  async function boot() {
    FVApi.init();
    mountConnectionBadge();

    try {
      const res = await fetch(FVConfig.dataUrl());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.startups = await res.json();
    } catch (err) {
      console.error('Failed to load cohort data', err);
      $('#content').innerHTML = `
        <div class="card" style="text-align:center">
          <h2 style="margin-bottom:.6rem">تعذّر تحميل بيانات الورشة</h2>
          <p class="lede">يرجى تشغيل الموقع عبر خادم HTTP والمحاولة مرة أخرى.</p>
        </div>`;
      return;
    }

    await loadResponses();
    render();
    startRealtime();
    showBackendNotice();

    $('#refresh').addEventListener('click', async () => {
      await loadResponses();
      render();
      toast('تم تحديث البيانات');
    });
  }

  /**
   * State the backend problem in the page, not in the console.
   *
   * An unconfigured deployment is the single most likely reason this
   * dashboard shows nothing: every founder answer goes to a local outbox that
   * never drains, so the room fills in while the facilitator watches zeros.
   */
  function showBackendNotice() {
    if (FVApi.isLive()) return;
    const host = $('#content');
    if (!host) return;

    const text = FVApi.reason === 'library-missing'
      ? 'تعذّر تحميل مكتبة الاتصال بقاعدة البيانات. تحقق من الاتصال بالإنترنت ثم أعد تحميل الصفحة.'
      : 'قاعدة البيانات غير مهيأة، لذلك لن تصل إجابات المشاركين إلى هذه اللوحة. '
      + `القيم الناقصة في ملف assets/js/config.js: ${FVConfig.missing().join('، ')}. `
      + 'كما يجب تشغيل ملف supabase/schema.sql مرة واحدة قبل بدء الورشة.';

    const note = document.createElement('div');
    note.className = 'notice';
    note.setAttribute('role', 'alert');
    note.innerHTML = `<span class="notice-icon" aria-hidden="true">⚠️</span><span>${esc(text)}</span>`;
    host.prepend(note);
  }

  async function loadResponses() {
    const rows = await FVApi.fetchAll();
    const map = {};
    rows.forEach(row => { map[row.startup_id] = row; });
    state.responses = map;
  }

  /**
   * Realtime is what makes this a live view rather than a report.
   *
   * The re-render is debounced because twenty founders typing produce a
   * continuous stream of updates, and rebuilding the page on every keystroke
   * would make the facilitator's laptop unusable mid-session.
   */
  function startRealtime() {
    if (!FVApi.isLive()) return;

    FVApi.subscribe((eventType, row) => {
      if (!row?.startup_id) return;
      if (eventType === 'DELETE') delete state.responses[row.startup_id];
      else state.responses[row.startup_id] = row;

      state.lastEventAt = new Date();
      scheduleRender();
      pulse();
    });
  }

  const scheduleRender = debounce(() => render(), 500);

  function pulse() {
    const badge = $('#live');
    if (!badge) return;
    badge.classList.remove('pulse');
    void badge.offsetWidth;                    // restart the animation
    badge.classList.add('pulse');
  }

  function mountConnectionBadge() {
    FVApi.onStatus((status) => {
      const badge = $('#live');
      if (!badge) return;
      const map = {
        live:    ['live',    'مباشر'],
        polling: ['live',    'تحديث تلقائي'],
        offline: ['offline', 'جارٍ إعادة الاتصال...'],
        local:   ['',        'وضع محلي']
      };
      const [cls, label] = map[status] || map.local;
      badge.className = `badge ${cls}`;
      badge.innerHTML = `<span class="badge-dot"></span>${esc(label)}`;
    });
  }

  /* --------------------------- التحليل المجهول --------------------------- */

  /**
   * The single place a database row is read. Participants carry an index and
   * nothing else — no name, no id, no session.
   */
  function analyse() {
    const participants = state.startups.map((s, i) => {
      const row = state.responses[s.id] || null;
      const r = row ? FVApi.rowToResponse(row) : null;

      return {
        index: i + 1,
        stage: s.stage_ar,
        started: Boolean(row),
        submitted: Boolean(row?.submitted),
        completion: row ? (row.completion_percentage ?? 0) : 0,
        readiness: row
          ? (row.validation_score || FVStore.readinessOf(r, s))
          : null,
        area: (r?.challenge?.tags || [])[0] || null,
        assumptions: r?.assumptions || {},
        untested: Array.isArray(r?.reflections?.untested) ? r.reflections.untested : [],
        challengeText: (r?.challenge?.text || '').trim(),
        commitment: (r?.commitment || '').trim()
      };
    });

    const answered = participants.filter(p => p.readiness !== null);

    return {
      total: participants.length,
      participants,
      started: participants.filter(p => p.started).length,
      submitted: participants.filter(p => p.submitted).length,
      avgCompletion: mean(participants.map(p => p.completion)),
      avgReadiness: answered.length ? mean(answered.map(p => p.readiness)) : 0,
      areas: rank(participants, p => p.area && AREA_LABELS[p.area]),
      /* Only founders who actually started. Counting the whole cohort file
         here would report stages for companies that never scanned the QR,
         and would disagree with the challenge ranking directly above it,
         which can only count people who answered. */
      stages: rank(participants.filter(p => p.started), p => p.stage, STAGE_ORDER),
      unvalidated: unvalidatedAssumptions(participants),
      untested: rank(participants.flatMap(p => p.untested.map(u => ({ u }))), x => UNTESTED_LABELS[x.u]),
      words: wordFrequencies(participants),
      /* Kept separate from the cloud: the summary calls these the recurring
         questions, so they must come from what founders raised as problems,
         not from what they promised to do next. */
      challengeWords: wordFrequencies(participants, p => p.challengeText)
    };
  }

  const mean = ns => (ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : 0);

  function rank(items, keyFn, order) {
    const map = new Map();
    items.forEach(item => {
      const k = keyFn(item);
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    });
    const entries = [...map.entries()].map(([label, value]) => ({ label, value }));
    if (order) {
      entries.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    } else {
      entries.sort((a, b) => b.value - a.value);
    }
    return entries;
  }

  /** How many founders answered "no" to each of the three step-2 questions. */
  function unvalidatedAssumptions(participants) {
    return Object.entries(ASSUMPTION_LABELS).map(([key, label]) => ({
      key,
      label,
      value: participants.filter(p => p.assumptions[key] === 'no').length,
      partial: participants.filter(p => p.assumptions[key] === 'partly').length
    })).sort((a, b) => b.value - a.value);
  }

  /* Arabic and English function words. They dominate any raw frequency count
     and say nothing about what the cohort is struggling with. */
  const STOP = new Set([
    'من', 'في', 'على', 'إلى', 'الى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي',
    'أن', 'ان', 'إن', 'كان', 'كانت', 'يكون', 'لكن', 'لأن', 'لان', 'حتى', 'قد', 'كل',
    'بعد', 'قبل', 'عند', 'عندما', 'حيث', 'أو', 'او', 'ثم', 'ما', 'لا', 'لم', 'لن',
    'هو', 'هي', 'نحن', 'أنا', 'انا', 'هناك', 'بين', 'خلال', 'أيضا', 'ايضا', 'جدا',
    'جداً', 'فقط', 'أكثر', 'اكثر', 'يجب', 'سوف', 'الآن', 'الان', 'شيء', 'شركة',
    'شركتي', 'عندي', 'لدي', 'لدينا', 'يوجد', 'أصبح', 'اصبح', 'بشكل', 'بسبب',
    'the', 'and', 'for', 'that', 'with', 'have', 'this', 'from', 'they', 'been',
    'were', 'what', 'when', 'will', 'would', 'could', 'should', 'there', 'their',
    'which', 'about', 'more', 'than', 'into', 'only', 'them', 'then', 'some',
    'because', 'just', 'very', 'much', 'also', 'over', 'after', 'before', 'still'
  ]);

  function wordFrequencies(participants, corpusOf = p => `${p.challengeText} ${p.commitment}`) {
    const map = new Map();
    participants.forEach(p => {
      String(corpusOf(p) || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP.has(w))
        .forEach(w => map.set(w, (map.get(w) || 0) + 1));
    });
    return [...map.entries()]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }

  /* ---------------------------- الاستنتاجات ---------------------------- */

  /**
   * Rule-based. Each rule tests a cohort-level condition and only fires when
   * the data actually supports the claim, so the facilitator is never handed
   * a confident sentence about a pattern that is not there.
   */
  function insights(a) {
    const out = [];
    const answered = a.participants.filter(p => p.started).length || 1;
    const share = n => Math.round((n / answered) * 100);

    const noPaid = a.participants.filter(p => p.assumptions.paid === 'no').length;
    const noTalk = a.participants.filter(p => p.assumptions.talked === 'no').length;
    const noProblem = a.participants.filter(p => p.assumptions.problem === 'no').length;
    const topArea = a.areas[0];

    if (noPaid >= 2) {
      out.push({
        weight: noPaid * 3,
        text: `${companies(noPaid)} (${num(share(noPaid))}٪ من المشاركين) لم يحصل على عميل دافع بعد. `
            + `هذه أوضح فجوة في القاعة، وتستحق تمريناً جماعياً حول كيفية طلب الدفع مبكراً.`
      });
    }

    if (noTalk >= 2) {
      out.push({
        weight: noTalk * 4,
        text: `${companies(noTalk)} لم تتحدث مع عملائها إطلاقاً. `
            + `أي نقاش عن المنتج أو التسعير سيكون سابقاً لأوانه قبل معالجة هذه النقطة.`
      });
    }

    if (noProblem >= 2) {
      out.push({
        weight: noProblem * 3,
        text: `${companies(noProblem)} لا تعرف بدقة المشكلة التي تحلها، `
            + `وهو مؤشر على أن الحل سبق المشكلة — وهو أكثر أنماط الفشل شيوعاً في هذه المرحلة.`
      });
    }

    if (topArea && topArea.value >= 2) {
      out.push({
        weight: topArea.value * 2,
        text: `«${topArea.label}» هو التحدي الأول لدى ${companies(topArea.value, { oblique: true })}، `
            + `ما يجعله أفضل موضوع لفتح النقاش الجماعي في نهاية الورشة.`
      });
    }

    if (a.avgReadiness && a.avgReadiness < 45) {
      out.push({
        weight: 6,
        text: `متوسط جاهزية القاعة ${num(a.avgReadiness)}٪ — أقل من المتوقع. `
            + `الأنسب التركيز على أساسيات التحقق بدلاً من مواضيع النمو والاستثمار.`
      });
    } else if (a.avgReadiness >= 65) {
      out.push({
        weight: 5,
        text: `متوسط جاهزية القاعة ${num(a.avgReadiness)}٪ — مرتفع نسبياً. `
            + `يمكن رفع سقف النقاش نحو التوسع وبناء الفريق بدلاً من التحقق الأساسي.`
      });
    }

    if (a.stages.length >= 4) {
      out.push({
        weight: 4,
        text: `الشركات موزعة على ${num(a.stages.length)} مراحل مختلفة. `
            + `النقاش الجماعي الموحّد سيخدم جزءاً منهم فقط — يُفضّل تقسيمهم إلى مجموعتين.`
      });
    }

    if (a.submitted && a.submitted < a.total / 2) {
      out.push({
        weight: 2,
        text: `أقل من نصف الشركات أنهت التمرين حتى الآن. `
            + `قد يحتاج البعض إلى دقيقتين إضافيتين قبل بدء النقاش.`
      });
    }

    if (!out.length) {
      out.push({
        weight: 0,
        text: 'لم تصل إجابات كافية بعد لاستخلاص أنماط على مستوى القاعة.'
      });
    }

    return out.sort((x, y) => y.weight - x.weight).slice(0, 3).map(i => i.text);
  }

  /* -------------------------- مواضيع النقاش -------------------------- */

  function topics(a) {
    const out = [];
    const count = key => a.participants.filter(p => p.assumptions[key] === 'no').length;

    if (count('talked') >= 1) {
      out.push({ w: count('talked') * 4, t: 'كيف تُجري خمس محادثات عملاء مفيدة دون أن تبيع أي شيء' });
    }
    if (count('paid') >= 1) {
      out.push({ w: count('paid') * 3, t: 'كيف تطلب الدفع قبل أن يكون المنتج جاهزاً' });
    }
    if (count('problem') >= 1) {
      out.push({ w: count('problem') * 3, t: 'صياغة المشكلة في جملة واحدة يتعرف عليها العميل فوراً' });
    }

    a.areas.forEach((area, i) => {
      const byArea = {
        customers:  'من هو عميلك الحقيقي، ومن الذي تظن أنه عميلك',
        marketing:  'لماذا زيادة التسويق قبل إثبات التحويل تُهدر الميزانية',
        product:    'متى تتوقف عن إضافة الميزات وتبدأ بحذفها',
        pricing:    'كيف تختبر رفع السعر دون أن تخسر عملاءك الحاليين',
        investment: 'ما الذي يبحث عنه المستثمر فعلاً في هذه المرحلة',
        team:       'أول توظيف يجب أن تقوم به، وأول توظيف يجب أن تؤجله'
      };
      const key = Object.keys(AREA_LABELS).find(k => AREA_LABELS[k] === area.label);
      if (byArea[key]) out.push({ w: area.value * 2 - i, t: byArea[key] });
    });

    /* Stable filler so the facilitator always leaves with five topics, even
       in a room that has barely started answering. */
    const fallback = [
      'الفرق بين الاهتمام والطلب الحقيقي، وكيف تفرّق بينهما',
      'ما الذي يجب أن يتغير في شركتك خلال التسعين يوماً القادمة',
      'أخطر افتراض في شركتك، وكيف تختبره بأقل تكلفة',
      'كيف تقيس التقدّم عندما لا يوجد إيراد بعد',
      'متى يكون التوقف عن فكرة قراراً صحيحاً وليس فشلاً'
    ];
    fallback.forEach((t, i) => out.push({ w: -10 - i, t }));

    const seen = new Set();
    return out
      .sort((x, y) => y.w - x.w)
      .filter(o => !seen.has(o.t) && seen.add(o.t))
      .slice(0, 5)
      .map(o => o.t);
  }

  /* ---------------------------- ملخص الورشة ---------------------------- */

  /**
   * The ✨ summary. Composed locally from the same anonymous analysis the page
   * already renders — deliberately not a network call, because the workshop
   * venue's wifi is the one thing that cannot be relied on, and a facilitator
   * pressing this in front of the room needs it to answer every time.
   */
  function buildSummary(a) {
    const noAnswer = !a.started;
    if (noAnswer) return null;

    const topAreas = a.areas.slice(0, 3);
    const unvalidated = a.unvalidated.filter(u => u.value > 0);
    const recurring = a.challengeWords.filter(w => w.count >= 2).slice(0, 5);

    return [
      {
        title: 'أهم التحديات',
        items: topAreas.length
          ? topAreas.map(x => `${x.label} — ${companies(x.value)}`)
          : ['لم تُسجَّل تحديات كافية بعد.']
      },
      {
        /* Phrased around the answer rather than a verb, so the count never
           has to agree with a subject that changes number. */
        title: 'أكثر الفرضيات غير المثبتة',
        items: unvalidated.length
          ? unvalidated.map(u => `${u.label} — إجابة «لا» لدى ${companies(u.value, { oblique: true })}`)
          : ['جميع الفرضيات الثلاث مثبتة لدى من أجاب حتى الآن.']
      },
      {
        title: 'ما لم يُختبر بعد — بكلمات المؤسسين',
        items: a.untested.length
          ? a.untested.slice(0, 5).map(x => `${x.label} — ${companies(x.value)}`)
          : ['لم يصل عدد كافٍ من الإجابات بعد.']
      },
      {
        /* A word seen once is not a recurring theme, so the threshold is two.
           Below it the section says so rather than padding with noise. */
        title: 'أكثر الأسئلة تكراراً',
        items: recurring.length
          ? recurring.map(w => `«${w.text}» — وردت ${times(w.count)}`)
          : ['لم تتكرر أي كلمة بعد — التحديات المكتوبة ما زالت قليلة أو متباينة.']
      },
      {
        title: 'توصيات الجلسة القادمة',
        items: sessionAdvice(a)
      },
      {
        title: 'أفضل ٥ مواضيع للنقاش',
        items: topics(a)
      }
    ];
  }

  function sessionAdvice(a) {
    const out = [];
    const noTalk = a.participants.filter(p => p.assumptions.talked === 'no').length;
    const noPaid = a.participants.filter(p => p.assumptions.paid === 'no').length;

    if (noTalk >= 2) out.push('ابدأ الجلسة القادمة بتمرين محادثات عملاء إلزامي قبل أي محتوى آخر.');
    if (noPaid >= 2) out.push('خصص نصف الجلسة لطلب الدفع المبكر واختبار الاستعداد للدفع.');
    if (a.stages.length >= 4) out.push('قسّم القاعة إلى مجموعتين حسب المرحلة، فالفجوة بينهم كبيرة.');
    if (a.avgReadiness && a.avgReadiness < 45) out.push('أجّل مواضيع الاستثمار والتوسع — القاعة ليست جاهزة لها بعد.');
    if (a.avgReadiness >= 65) out.push('ارفع سقف النقاش نحو التوسع وبناء الفريق والعمليات.');
    if (a.submitted < a.total) out.push(`تابع مع ${companies(a.total - a.submitted, { oblique: true })} لم تُنهِ التمرين بعد.`);

    if (!out.length) out.push('القاعة متجانسة ومتقدمة — يمكن المضي في الخطة كما هي.');
    return out.slice(0, 5);
  }

  /* ------------------------------- العرض ------------------------------- */

  function render() {
    const a = analyse();

    $('#content').innerHTML = `
      ${metricsSection(a)}
      ${completionSection(a)}
      ${rankSection('أكثر التحديات انتشاراً', a.areas, a.total, false)}
      ${rankSection('أكثر مرحلة انتشاراً', a.stages, a.total, true)}
      ${cloudSection(a)}
      ${insightsSection(a)}
      ${topicsSection(a)}
      ${summarySection(a)}
    `;

    /* Animate the numbers and bars once, after the markup is in the document. */
    $$('[data-count]').forEach(node => countUp(node, Number(node.dataset.count), {
      suffix: node.dataset.suffix || ''
    }));
    requestAnimationFrame(() => {
      $$('.rank-fill').forEach(bar => { bar.style.width = bar.dataset.width + '%'; });
    });

    wireSummary(a);
  }

  function metricsSection(a) {
    return `
      <section class="section">
        <div class="metrics">
          ${metric(a.started, 'عدد الشركات المشاركة')}
          ${metric(a.submitted, 'عدد الشركات المكتملة')}
          ${metric(a.avgCompletion, 'نسبة الإنجاز', '٪')}
          ${metric(a.avgReadiness, 'متوسط جاهزية الشركات', '٪')}
        </div>
      </section>`;
  }

  function metric(value, label, suffix = '') {
    return `
      <div class="metric">
        <div class="metric-value tabular" data-count="${value}" data-suffix="${suffix}">${num(0)}${suffix}</div>
        <div class="metric-label">${esc(label)}</div>
      </div>`;
  }

  function completionSection(a) {
    /* One block per company: filled when submitted, half-lit once started. */
    const blocks = a.participants
      .map(p => `<span class="${p.submitted ? 'done' : p.started ? 'started' : ''}"></span>`)
      .join('');

    return `
      <section class="section">
        <div class="section-head">
          <h2>الإنجاز المباشر</h2>
          <span class="muted" style="font-size:.85rem">
            ${num(a.submitted)} من ${companies(a.total, { oblique: true })}
          </span>
        </div>
        <div class="card">
          <div class="blocks" role="img"
               aria-label="${esc(`${num(a.submitted)} من ${companies(a.total, { oblique: true })} أنهت التمرين`)}">${blocks}</div>
        </div>
      </section>`;
  }

  function rankSection(title, rows, total, alt) {
    if (!rows.length) {
      return emptySection(title, 'لم تصل إجابات بعد.');
    }
    const max = Math.max(...rows.map(r => r.value), 1);

    return `
      <section class="section">
        <div class="section-head"><h2>${esc(title)}</h2></div>
        <div class="card">
          <div class="rank">
            ${rows.map(r => `
              <div class="rank-row">
                <div class="rank-head">
                  <span>${esc(r.label)}</span>
                  <span class="rank-count tabular">${companies(r.value)}</span>
                </div>
                <div class="rank-track">
                  <div class="rank-fill ${alt ? 'alt' : ''}" data-width="${(r.value / max) * 100}"></div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </section>`;
  }

  function cloudSection(a) {
    if (!a.words.length) {
      return emptySection('الكلمات الأكثر تكراراً', 'لم تُكتب إجابات نصية بعد.');
    }
    const max = a.words[0].count;

    return `
      <section class="section">
        <div class="section-head"><h2>الكلمات الأكثر تكراراً</h2></div>
        <div class="card">
          <div class="cloud">
            ${a.words.map(w => {
              const ratio = w.count / max;
              const size = (0.86 + ratio * 0.95).toFixed(2);
              const cls = ratio > .66 ? 'hot' : ratio > .33 ? 'warm' : '';
              return `<span class="${cls}" style="font-size:${size}rem"
                            title="${esc(`${w.text} — ${num(w.count)}`)}">${esc(w.text)}</span>`;
            }).join('')}
          </div>
        </div>
      </section>`;
  }

  function insightsSection(a) {
    return `
      <section class="section">
        <div class="section-head"><h2>٣ استنتاجات ذكية</h2></div>
        <div class="card">
          <ol class="numbered">
            ${insights(a).map(t => `<li><span>${esc(t)}</span></li>`).join('')}
          </ol>
        </div>
      </section>`;
  }

  function topicsSection(a) {
    return `
      <section class="section">
        <div class="section-head"><h2>أفضل ٥ مواضيع للنقاش</h2></div>
        <div class="card">
          <ol class="numbered">
            ${topics(a).map(t => `<li><span>${esc(t)}</span></li>`).join('')}
          </ol>
        </div>
      </section>`;
  }

  function summarySection() {
    return `
      <section class="section">
        <button class="btn btn--primary" id="summary-btn">
          ✨ إنشاء ملخص الورشة بالذكاء الاصطناعي
        </button>
        <div id="summary-out" style="margin-top:1.2rem"></div>
      </section>`;
  }

  function emptySection(title, body) {
    return `
      <section class="section">
        <div class="section-head"><h2>${esc(title)}</h2></div>
        <div class="card card--quiet"><p class="lede" style="font-size:.95rem">${esc(body)}</p></div>
      </section>`;
  }

  /* ------------------------- زر الملخص ------------------------- */

  function wireSummary(a) {
    const btn = $('#summary-btn');
    const out = $('#summary-out');
    if (!btn) return;

    /* Re-rendering rebuilds the section, so a summary already on screen is
       restored rather than silently disappearing under the facilitator. */
    if (state.summaryOpen) return paint();

    btn.addEventListener('click', async () => {
      btn.setAttribute('aria-disabled', 'true');
      out.innerHTML = `
        <div class="card" style="text-align:center">
          <div class="loader-ring" role="status" aria-label="جارٍ إنشاء الملخص"></div>
          <p class="muted" style="margin-top:1rem;font-size:.9rem">جارٍ تحليل إجابات القاعة...</p>
        </div>`;

      await new Promise(r => setTimeout(r, 900));

      btn.removeAttribute('aria-disabled');
      state.summaryOpen = true;
      paint();
    });

    function paint() {
      const sections = buildSummary(a);
      btn.textContent = '✨ تحديث ملخص الورشة';

      if (!sections) {
        out.innerHTML = `
          <div class="card card--quiet">
            <p class="lede" style="font-size:.95rem">لم تصل أي إجابات بعد. ابدأ الورشة أولاً.</p>
          </div>`;
        return;
      }

      out.innerHTML = `
        <div class="card">
          <p class="eyebrow" style="margin-bottom:1.2rem">ملخص الورشة</p>
          <div class="stack-l">
            ${sections.map(s => `
              <div>
                <h3 style="margin-bottom:.7rem">${esc(s.title)}</h3>
                <ol class="numbered">
                  ${s.items.map(i => `<li><span>${esc(i)}</span></li>`).join('')}
                </ol>
              </div>`).join('')}
          </div>
        </div>`;
    }
  }

  /* -------------------------------- انطلق -------------------------------- */

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGate);
  else initGate();
})();

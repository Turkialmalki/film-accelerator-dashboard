/* ==========================================================================
   Founder Portal — view routing, personalization, and all 13 sections.
   ========================================================================== */

(() => {
  const { $, $$, esc, countUp, observeReveals, scrollProgress,
          scoreColor, scoreLabel, overallScore, ringMeter, animateRing,
          CHART, initChartDefaults, scales, BAR_STYLE,
          initials, nameSpan, debounce, toast, reducedMotion } = FVUI;

  /* ---------------------------- State ---------------------------- */

  const state = {
    startups: [],
    current: null,
    charts: {},
    activeSuggestion: -1,
    suggestions: [],
    participantName: null,   // the identity searched for; stored, never shown to the mentor
    submitting: false
  };

  /* ---------------------------- Sync ---------------------------- */

  /**
   * Push the current draft to Supabase. Every edit calls this (debounced), so
   * "submission" is continuous rather than a single event — the mentor sees
   * a founder's answers appear as they work, and Submit is just the final,
   * immediate push that flags the response complete.
   */
  function pushSync(startup) {
    const draft = FVStore.get(startup.id);
    return FVApi.save(startup.id, {
      participantName: state.participantName,
      challenge: draft.challenge,
      reflections: draft.reflections,
      assumptions: draft.assumptions,
      commitment: draft.commitment,
      submitted: draft.submitted,
      validationScore: overallScore(startup.validation_scores),
      completionPercentage: FVStore.completion(startup.id, startup)
    });
  }

  const queueSync = debounce((startup) => { pushSync(startup); }, 700);

  /** Small live indicator so a founder can tell their answers are landing. */
  function mountSyncBadge() {
    const host = document.getElementById('sync-badge');
    if (!host) return;
    FVApi.onStatus((status) => {
      const pending = FVApi.pendingCount();
      const map = {
        live:    ['var(--good)',     'Synced'],
        offline: ['var(--warning)',  pending ? `Saving… (${pending} pending)` : 'Reconnecting…'],
        local:   ['var(--ink-3)',    'Offline mode']
      };
      const [color, label] = map[status] || map.local;
      host.innerHTML =
        `<span class="legend-swatch" style="background:${color};border-radius:50%"></span>${esc(label)}`;
      host.title = status === 'local'
        ? 'Supabase is not configured, so answers stay on this device only.'
        : 'Your answers sync automatically to the workshop dashboard.';
    });
  }

  /* ---------------------------- Static knowledge ---------------------------- */

  const STAGES = [
    'Idea', 'Problem Validation', 'Customer Discovery', 'MVP',
    'First Revenue', 'Product Market Fit', 'Growth', 'Scale'
  ];

  /* Stage-level mentoring. Personalization comes from combining this with the
     startup's own current_status and mentor_notes. */
  const STAGE_GUIDE = {
    'Idea': {
      why: 'You have a hypothesis, not yet a business. Nothing has been tested against reality, so every plan is still an assumption wearing a confident tone.',
      mistakes: 'Building the product before speaking to anyone. Confusing personal enthusiasm with market demand. Choosing an expensive model to test a cheap question.',
      next: 'Talk to twenty potential customers before writing a line of code or spending real money. Find the cheapest possible experiment that could prove you wrong.'
    },
    'Problem Validation': {
      why: 'You believe you have found a real problem, but you have not yet proven that the people who have it will change their behaviour or pay to solve it.',
      mistakes: 'Asking leading questions that invite agreement. Treating polite enthusiasm as evidence. Validating the problem with people who are not the buyer.',
      next: 'Separate the person who feels the pain from the person who controls the budget, and validate both. Get a signed commitment or a payment, not a compliment.'
    },
    'Customer Discovery': {
      why: 'You are learning who your customer actually is. Early users are teaching you things that will reshape the product — this is the most valuable learning phase you will have.',
      mistakes: 'Generalising from your loudest users. Adding features for every request. Failing to write down what you learn, so patterns never emerge.',
      next: 'Segment your users and find the one group that would be genuinely upset without you. Build for them specifically rather than for everyone.'
    },
    'MVP': {
      why: 'You have something real that people can use. The question has shifted from "would anyone want this" to "does this actually solve the problem well enough to pay for".',
      mistakes: 'Polishing the product instead of testing willingness to pay. Measuring signups instead of usage. Building the next feature before understanding why the last one was ignored.',
      next: 'Get to a paid transaction. Revenue is the only feedback that cannot be faked, and it will tell you more than a hundred conversations.'
    },
    'First Revenue': {
      why: 'Someone has paid you, which proves the value is real. Now the question is whether it is repeatable — whether you can do this again without heroics.',
      mistakes: 'Assuming the first customers represent the market. Not measuring what it costs to acquire a customer. Saying yes to every request and losing focus.',
      next: 'Find the repeatable pattern: which customer, which channel, which pitch. Then measure unit economics honestly before you try to scale anything.'
    },
    'Product Market Fit': {
      why: 'Demand is pulling you rather than you pushing the product. Customers return, refer others, and complain when you are unavailable — the clearest signal there is.',
      mistakes: 'Scaling the team before scaling the system. Ignoring pricing when demand is high. Losing the customer intimacy that got you here.',
      next: 'Systemise delivery, fix pricing while you have leverage, and build the operational foundation before growth exposes every crack.'
    },
    'Growth': {
      why: 'The model works and you are now compounding it. Your constraints have shifted from finding demand to serving it — capital, hiring, and process become the bottleneck.',
      mistakes: 'Hiring faster than you can onboard. Letting quality slip as volume rises. Treating a temporary advantage as a permanent moat.',
      next: 'Protect what makes you different while you scale, and convert temporary advantages into durable assets before competitors catch up.'
    },
    'Scale': {
      why: 'You are building an organisation, not just a product. The work is now about leadership, systems, and strategic choices with long time horizons.',
      mistakes: 'Losing the culture that created the product. Over-centralising decisions. Defending the existing business instead of building the next one.',
      next: 'Build leaders rather than followers, and place deliberate bets on what the company becomes in three years.'
    }
  };

  const SCORE_DIMENSIONS = [
    ['problem',     'Problem Validation'],
    ['customer',    'Customer Validation'],
    ['solution',    'Solution Validation'],
    ['revenue',     'Revenue Validation'],
    ['market',      'Market Validation'],
    ['execution',   'Execution Readiness'],
    ['team',        'Team Readiness'],
    ['investor',    'Investor Readiness'],
    ['competition', 'Competition Awareness']
  ];

  const CHALLENGE_TAGS = [
    'Customer Discovery', 'Pricing', 'Marketing', 'Sales', 'Fundraising',
    'Technology', 'Hiring', 'Product', 'Partnerships', 'Legal',
    'Operations', 'AI', 'Distribution', 'Scaling'
  ];

  const ASSUMPTION_GROUPS = [
    ['customer_assumptions',  'Customer'],
    ['business_assumptions',  'Business'],
    ['technical_assumptions', 'Technical'],
    ['pricing_assumptions',   'Pricing']
  ];

  const STATUS_META = {
    not:       { dot: '🔴', label: 'Not Validated' },
    partial:   { dot: '🟡', label: 'Partially Validated' },
    validated: { dot: '🟢', label: 'Validated' }
  };

  const SECTIONS = [
    ['snapshot',    'Snapshot'],
    ['journey',     'Journey'],
    ['scorecard',   'Scorecard'],
    ['risks',       'Risks'],
    ['assumptions', 'Assumptions'],
    ['reflection',  'Reflection'],
    ['challenge',   'Challenge'],
    ['swot',        'SWOT'],
    ['investor',    'Investor'],
    ['plan',        '30-Day Plan'],
    ['learning',    'Learning'],
    ['commitment',  'Commitment']
  ];

  /* ---------------------------- Boot ---------------------------- */

  async function boot() {
    initChartDefaults();
    scrollProgress($('#rail-fill'));
    FVApi.init();
    mountSyncBadge();

    try {
      const res = await fetch('data/startups.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.startups = await res.json();
    } catch (err) {
      console.error('Failed to load startup data', err);
      showDataError();
      return;
    }

    FVSearch.buildIndex(state.startups);
    wireSearch();
    renderQuickPicks();
    wireHashRouting();

    // Returning to a journey already in progress on this device.
    const currentId = FVStore.getSession();
    if (currentId && !location.hash) {
      const startup = state.startups.find(s => s.id === currentId);
      if (startup) {
        state.participantName = startup.startup_name_en;
        await hydrateStartup(startup);
        showWelcome(startup, true);
      }
    }
  }

  function showDataError() {
    $('#view-search').innerHTML = `
      <div class="wrap" style="min-height:80vh;display:grid;place-items:center;text-align:center">
        <div class="card" style="max-width:520px">
          <h2 style="margin-bottom:.8rem">Could not load the workshop data</h2>
          <p class="muted" style="margin-bottom:1.4rem">
            The startup database could not be reached. If you are opening this file directly
            from your computer, it needs to be served over HTTP — the browser blocks local
            file requests for security.
          </p>
          <button class="btn btn-primary" onclick="location.reload()">Try again</button>
        </div>
      </div>`;
  }

  /* ---------------------------- Routing ---------------------------- */

  function showView(id) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    const onDashboard = id === 'view-dashboard';
    $('#topbar').hidden = !(onDashboard || id === 'view-report');
    $('#section-nav').style.display = onDashboard ? '' : 'none';
  }

  function wireHashRouting() {
    $('#brand-home').addEventListener('click', (e) => {
      e.preventDefault();
      if (state.current) { showWelcome(state.current, true); }
      else { showView('view-search'); }
    });
  }

  /* ---------------------------- Search ---------------------------- */

  function wireSearch() {
    const input = $('#search-input');
    const box = $('#suggestions');

    const run = debounce(() => {
      const results = FVSearch.query(input.value, 6);
      state.suggestions = results;
      state.activeSuggestion = -1;
      renderSuggestions(results, input.value);
    }, 110);

    input.addEventListener('input', run);
    input.addEventListener('focus', () => { if (input.value.trim()) run(); });

    input.addEventListener('keydown', (e) => {
      const count = state.suggestions.length;
      if (e.key === 'ArrowDown' && count) {
        e.preventDefault();
        state.activeSuggestion = (state.activeSuggestion + 1) % count;
        highlightSuggestion();
      } else if (e.key === 'ArrowUp' && count) {
        e.preventDefault();
        state.activeSuggestion = (state.activeSuggestion - 1 + count) % count;
        highlightSuggestion();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = state.activeSuggestion >= 0 ? state.suggestions[state.activeSuggestion] : state.suggestions[0];
        if (pick) selectStartup(pick.startupId, pick.label);
      } else if (e.key === 'Escape') {
        closeSuggestions();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-shell')) closeSuggestions();
    });
  }

  function closeSuggestions() {
    $('#suggestions').classList.remove('open');
    $('#search-input').setAttribute('aria-expanded', 'false');
  }

  function highlightSuggestion() {
    $$('.suggestion').forEach((node, i) => {
      node.classList.toggle('active', i === state.activeSuggestion);
    });
  }

  function renderSuggestions(results, rawQuery) {
    const box = $('#suggestions');
    const input = $('#search-input');

    if (!rawQuery.trim()) { closeSuggestions(); return; }

    if (!results.length) {
      box.innerHTML = `<div class="search-empty">
          No match for “${esc(rawQuery)}”. Try your startup name, or just your first name.
        </div>`;
      box.classList.add('open');
      input.setAttribute('aria-expanded', 'true');
      return;
    }

    box.innerHTML = results.map((r, i) => {
      const s = r.startup;
      const isStartup = r.type === 'startup';
      const subtitle = isStartup
        ? `${esc(s.category)} · ${esc(s.stage)}`
        : `${esc(r.role || 'Team')} · ${esc(s.startup_name_en)}`;
      const tag = isStartup ? 'Startup' : (r.type === 'founder' ? 'Founder' : 'Team');
      return `
        <button class="suggestion" role="option" aria-selected="false"
                data-id="${esc(r.startupId)}" data-label="${esc(r.label)}" data-index="${i}">
          <span class="suggestion-avatar" aria-hidden="true">${esc(initials(isStartup ? s.startup_name_en : r.label))}</span>
          <span class="suggestion-main">
            <span class="suggestion-title">${nameSpan(r.label)}</span><br>
            <span class="suggestion-meta">${subtitle}</span>
          </span>
          <span class="suggestion-tag">${tag}</span>
        </button>`;
    }).join('');

    $$('.suggestion', box).forEach(node => {
      node.addEventListener('click', () => selectStartup(node.dataset.id, node.dataset.label));
    });

    box.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
  }

  function renderQuickPicks() {
    const host = $('#quick-picks');
    host.innerHTML = state.startups.map(s =>
      `<button class="tag" data-id="${esc(s.id)}">${esc(s.startup_name_en)}</button>`
    ).join('');
    $$('.tag', host).forEach(node => {
      node.addEventListener('click', () => selectStartup(node.dataset.id));
    });
  }

  async function selectStartup(id, participantName) {
    const startup = state.startups.find(s => s.id === id);
    if (!startup) return;
    closeSuggestions();
    state.participantName = participantName || startup.startup_name_en;
    FVStore.setSession(id);
    await hydrateStartup(startup);
    showWelcome(startup);
  }

  /**
   * Pull this startup's saved answers from the server before showing anything.
   * A team shares one response, so a founder opening the journey on a second
   * phone must see what their co-founder already wrote — the server copy wins
   * over whatever this device happens to have cached.
   */
  async function hydrateStartup(startup) {
    if (!FVApi.isLive()) return;
    const row = await FVApi.fetchOne(startup.id);
    if (row) FVStore.hydrate(startup.id, FVApi.rowToResponse(row));
  }

  /* ---------------------------- View 2 — Welcome ---------------------------- */

  function showWelcome(startup, resuming = false) {
    state.current = startup;
    const progress = FVStore.completion(startup.id, startup);
    const founderNames = (startup.founders || []).map(f => f.name_en.split(' ')[0]).join(' & ');

    $('#welcome-content').innerHTML = `
      <div class="glass" style="padding:clamp(1.8rem,4vw,3.2rem)">

        <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between;margin-bottom:1.8rem">
          <span class="pill pill-accent">${esc(startup.category)}</span>
          ${resuming && progress > 0
            ? `<span class="pill">${progress}% complete — continue where you left off</span>`
            : `<span class="pill">Estimated time · 25–35 minutes</span>`}
        </div>

        <h1 style="font-size:clamp(1.9rem,4.4vw,3rem);margin-bottom:.6rem">
          Welcome ${nameSpan(startup.startup_name_en)} <span aria-hidden="true">👋</span>
        </h1>
        <p style="color:var(--ink-2);font-size:1.05rem;max-width:60ch;margin-bottom:.6rem">
          ${esc(startup.description)}
        </p>
        <p class="muted" style="font-size:.9rem;margin-bottom:2.2rem">
          ${founderNames ? `Prepared for ${esc(founderNames)} and the ${esc(startup.startup_name_en)} team.` : ''}
        </p>

        <div class="grid grid-4" style="margin-bottom:2rem">
          <div class="stat">
            <div class="stat-label">Startup</div>
            <div class="stat-value" style="font-size:1.15rem">${nameSpan(startup.startup_name_ar)}</div>
            <div class="stat-note">${esc(startup.startup_name_en)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Stage</div>
            <div class="stat-value" style="font-size:1.15rem">${esc(startup.stage)}</div>
            <div class="stat-note">Step ${STAGES.indexOf(startup.stage) + 1} of ${STAGES.length}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Revenue</div>
            <div class="stat-value" style="font-size:1.15rem">${esc(startup.revenue)}</div>
            <div class="stat-note">Current run rate</div>
          </div>
          <div class="stat">
            <div class="stat-label">Team Size</div>
            <div class="stat-value" style="font-size:1.15rem">${esc(String(startup.team_size))}</div>
            <div class="stat-note">People today</div>
          </div>
        </div>

        <div class="grid grid-2" style="align-items:center;margin-bottom:2.2rem">
          <div style="display:flex;justify-content:center">
            ${ringMeter(startup.readiness, 'Readiness', 160)}
          </div>
          <div>
            <div class="section-eyebrow">Mission for today</div>
            <p style="font-size:1.02rem;color:var(--ink-2);margin-bottom:1rem">
              ${esc(missionFor(startup))}
            </p>
            <p class="muted" style="font-size:.9rem">
              You will review your risks, update your assumptions, answer a short set of
              reflection questions, and leave with a 30-day action plan.
            </p>
          </div>
        </div>

        <button class="btn btn-primary btn-lg" id="start-journey" style="width:100%">
          ${resuming && progress > 0 ? 'Continue My Validation Journey' : 'Start My Validation Journey'}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6"></path>
          </svg>
        </button>

        <button class="btn btn-ghost" id="not-me" style="width:100%;margin-top:.7rem">
          Not you? Search again
        </button>
      </div>`;

    $('#start-journey').addEventListener('click', () => runLoading(startup));
    $('#not-me').addEventListener('click', () => {
      FVStore.clearSession();
      state.current = null;
      $('#search-input').value = '';
      showView('view-search');
    });

    showView('view-welcome');
    animateRing($('#welcome-content'));
  }

  /** A one-line mission derived from the startup's weakest validation dimension. */
  function missionFor(startup) {
    const scores = startup.validation_scores || {};
    const weakest = SCORE_DIMENSIONS
      .map(([key, label]) => ({ key, label, value: scores[key] ?? 100 }))
      .sort((a, b) => a.value - b.value)[0];
    return `Confront the weakest part of your validation — ${weakest.label.toLowerCase()} — and leave with a concrete plan to fix it.`;
  }

  /* ---------------------------- View 3 — Loading ---------------------------- */

  const LOADING_STEPS = [
    'Analyzing startup profile...',
    'Reviewing validation evidence...',
    'Identifying your biggest risks...',
    'Preparing your personalized mentor recommendations...',
    'Loading validation journey...'
  ];

  function runLoading(startup) {
    const host = $('#loader-steps');
    host.innerHTML = LOADING_STEPS.map((s, i) =>
      `<div class="loader-step" data-step="${i}">
         <span class="loader-check" aria-hidden="true">✓</span>
         <span>${esc(s)}</span>
       </div>`
    ).join('');

    showView('view-loading');

    const perStep = reducedMotion ? 60 : 520;
    LOADING_STEPS.forEach((label, i) => {
      setTimeout(() => {
        const node = host.querySelector(`[data-step="${i}"]`);
        if (node) node.classList.add('on');
        $('#loader-headline').textContent = label;
      }, i * perStep);
    });

    setTimeout(() => renderDashboard(startup), LOADING_STEPS.length * perStep + (reducedMotion ? 60 : 420));
  }

  /* ---------------------------- View 4 — Dashboard ---------------------------- */

  function renderDashboard(startup) {
    state.current = startup;
    const saved = FVStore.get(startup.id);

    $('#brand-context').textContent = `· ${startup.startup_name_en}`;
    $('#section-nav').innerHTML = SECTIONS.map(([id, label]) =>
      `<button class="nav-pill" data-target="sec-${id}">${esc(label)}</button>`
    ).join('');
    $$('#section-nav .nav-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const target = document.getElementById(pill.dataset.target);
        if (target) target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });

    $('#dashboard-content').innerHTML = [
      sectionSnapshot(startup),
      sectionJourney(startup),
      sectionScorecard(startup),
      sectionRisks(startup),
      sectionAssumptions(startup, saved),
      sectionReflection(startup, saved),
      sectionChallenge(startup, saved),
      sectionSwot(startup),
      sectionInvestor(startup),
      sectionPlan(startup),
      sectionLearning(startup),
      sectionCommitment(startup, saved),
      sectionCompletion(startup)
    ].join('');

    showView('view-dashboard');

    wireAssumptions(startup);
    wireReflection(startup);
    wireChallenge(startup);
    wireCommitment(startup);
    wireCompletion(startup);

    observeReveals($('#dashboard-content'));
    animateRing($('#dashboard-content'));
    buildScorecardChart(startup);
    wireScrollSpy();
  }

  function wireScrollSpy() {
    if (!('IntersectionObserver' in window)) return;
    const pills = $$('#section-nav .nav-pill');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        pills.forEach(p => p.classList.toggle('active', p.dataset.target === entry.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach(([id]) => {
      const node = document.getElementById(`sec-${id}`);
      if (node) io.observe(node);
    });
  }

  const head = (eyebrow, title, sub) => `
    <div class="section-head reveal">
      <div class="section-eyebrow">${esc(eyebrow)}</div>
      <h2>${esc(title)}</h2>
      ${sub ? `<p class="section-sub">${esc(sub)}</p>` : ''}
    </div>`;

  /* --- Section 1 — Snapshot --- */

  function sectionSnapshot(s) {
    const overall = overallScore(s.validation_scores);
    return `
    <section class="section" id="sec-snapshot">
      <div class="wrap">
        ${head('Section 01', 'Startup Snapshot', 'Where you stand today, in the numbers that matter.')}

        <div class="grid grid-2 reveal" style="align-items:stretch;margin-bottom:1rem">
          <div class="card card--flat" style="display:flex;align-items:center;gap:1.6rem;flex-wrap:wrap">
            ${ringMeter(overall, 'Validation', 150)}
            <div style="flex:1;min-width:180px">
              <div class="stat-label">Overall assessment</div>
              <div style="font-size:1.35rem;font-weight:640;margin:.2rem 0 .5rem;color:${scoreColor(overall)}">
                ${scoreLabel(overall)}
              </div>
              <p class="muted" style="font-size:.9rem">${esc(s.current_status)}</p>
            </div>
          </div>

          <div class="card card--flat">
            <div class="stat-label" style="margin-bottom:.8rem">Business model</div>
            <p style="font-size:1.02rem;font-weight:560;margin-bottom:1.1rem">${esc(s.business_model)}</p>
            <div class="stat-label" style="margin-bottom:.5rem">Target customer</div>
            <p class="muted" style="font-size:.92rem;margin-bottom:1.1rem">${esc(s.target_customer)}</p>
            <div class="stat-label" style="margin-bottom:.5rem">Traction</div>
            <p class="muted" style="font-size:.92rem">${esc(s.traction)}</p>
          </div>
        </div>

        <div class="grid grid-6 reveal">
          ${statTile('Stage', s.stage, `Step ${STAGES.indexOf(s.stage) + 1} of ${STAGES.length}`)}
          ${statTile('Revenue', s.revenue, 'Current run rate')}
          ${statTile('Team Size', String(s.team_size), `${(s.founders || []).length} founder${(s.founders || []).length === 1 ? '' : 's'}`)}
          ${statTile('Category', s.category, 'Sector')}
          ${statTile('Readiness', `${s.readiness}%`, 'Self-assessed')}
          ${statTile('Validation', `${overall}%`, scoreLabel(overall))}
        </div>

        <div class="card card--flat reveal" style="margin-top:1rem">
          <div class="grid grid-2">
            <div>
              <div class="stat-label" style="margin-bottom:.5rem">The problem you solve</div>
              <p style="font-size:.96rem;color:var(--ink-2)">${esc(s.problem_statement)}</p>
            </div>
            <div>
              <div class="stat-label" style="margin-bottom:.5rem">Your value proposition</div>
              <p style="font-size:.96rem;color:var(--ink-2)">${esc(s.value_proposition)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>`;
  }

  const statTile = (label, value, note) => `
    <div class="stat">
      <div class="stat-label">${esc(label)}</div>
      <div class="stat-value" style="font-size:1.25rem">${esc(value)}</div>
      <div class="stat-note">${esc(note)}</div>
    </div>`;

  /* --- Section 2 — Journey --- */

  function sectionJourney(s) {
    const currentIndex = STAGES.indexOf(s.stage);
    const guide = STAGE_GUIDE[s.stage] || {};

    const steps = STAGES.map((stage, i) => {
      const isCurrent = i === currentIndex;
      const reached = i < currentIndex;
      const cls = isCurrent ? 'current' : (reached ? 'reached' : '');
      return `
        <div class="road-step ${cls}">
          <div class="road-marker">
            <span class="road-dot"></span>
            ${i < STAGES.length - 1 ? '<span class="road-line"></span>' : ''}
          </div>
          <div class="road-body">
            <div class="road-title">
              ${esc(stage)}
              ${isCurrent ? '<span class="road-badge">You are here</span>' : ''}
            </div>
            ${isCurrent ? `
              <div class="road-detail">
                <div class="road-detail-item">
                  <div class="road-detail-label">Why you are here</div>
                  <div class="road-detail-text">${esc(guide.why || '')}</div>
                </div>
                <div class="road-detail-item">
                  <div class="road-detail-label">Typical founder mistakes at this stage</div>
                  <div class="road-detail-text">${esc(guide.mistakes || '')}</div>
                </div>
                <div class="road-detail-item">
                  <div class="road-detail-label">What must happen next</div>
                  <div class="road-detail-text">${esc(guide.next || '')}</div>
                </div>
              </div>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
    <section class="section" id="sec-journey">
      <div class="wrap-narrow">
        ${head('Section 02', 'Your Validation Journey', 'Every startup travels the same path. Knowing exactly where you are prevents you from solving the wrong problem.')}
        <div class="card card--flat reveal">
          <div class="roadmap">${steps}</div>
        </div>
      </div>
    </section>`;
  }

  /* --- Section 3 — Scorecard --- */

  function sectionScorecard(s) {
    const scores = s.validation_scores || {};
    const values = SCORE_DIMENSIONS.map(([k]) => scores[k] ?? 0);
    const overall = overallScore(scores);
    const sorted = SCORE_DIMENSIONS
      .map(([k, label]) => ({ label, value: scores[k] ?? 0 }))
      .sort((a, b) => a.value - b.value);

    const rows = SCORE_DIMENSIONS.map(([k, label]) =>
      `<tr><td>${esc(label)}</td><td>${scores[k] ?? 0}</td><td>${esc(scoreLabel(scores[k] ?? 0))}</td></tr>`
    ).join('');

    return `
    <section class="section" id="sec-scorecard">
      <div class="wrap">
        ${head('Section 03', 'Validation Scorecard', 'Nine dimensions of startup validation, scored from your profile and evidence to date.')}

        <div class="grid reveal" style="grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:1rem">
          <div class="chart-card">
            <div class="chart-title">Validation by dimension</div>
            <div class="chart-sub">Scored 0–100. Colour marks the band; the number is shown on every bar.</div>
            <div class="chart-box tall">
              <canvas id="chart-scorecard" aria-label="Validation score by dimension"></canvas>
            </div>
            <div class="chart-legend">
              ${bandLegend()}
            </div>
            <button class="table-toggle" data-table="scorecard-table">Show data table</button>
            <div class="scroll-x" id="scorecard-table" hidden>
              <table class="data-table">
                <thead><tr><th>Dimension</th><th>Score</th><th>Band</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>

          <div class="stack">
            <div class="card card--flat" style="text-align:center">
              ${ringMeter(overall, 'Overall', 150)}
              <p class="muted" style="font-size:.88rem;margin-top:.8rem">
                Average across all nine dimensions
              </p>
            </div>
            <div class="card card--flat">
              <div class="stat-label" style="margin-bottom:.7rem">Weakest three</div>
              ${sorted.slice(0, 3).map(d => `
                <div style="display:flex;justify-content:space-between;gap:1rem;padding:.45rem 0;font-size:.9rem">
                  <span>${esc(d.label)}</span>
                  <strong style="color:${scoreColor(d.value)};font-variant-numeric:tabular-nums">${d.value}</strong>
                </div>`).join('')}
              <p class="muted" style="font-size:.85rem;margin-top:.8rem">
                This is where your next 30 days should go.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>`;
  }

  function bandLegend() {
    return [
      ['Strong (70+)', 'var(--good)'],
      ['Developing (50–69)', 'var(--warning)'],
      ['Weak (30–49)', 'var(--serious)'],
      ['Critical (<30)', 'var(--critical)']
    ].map(([label, color]) =>
      `<span class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${label}</span>`
    ).join('');
  }

  /* Canvas needs literal hex; scoreColor() returns CSS custom properties for the DOM. */
  function scoreHex(score) {
    if (score >= 70) return CHART.status.good;
    if (score >= 50) return CHART.status.warning;
    if (score >= 30) return CHART.status.serious;
    return CHART.status.critical;
  }

  /** Direct value labels at each bar end — no reliance on colour alone. */
  const valueLabelPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach((bar, i) => {
          const value = dataset.data[i];
          if (value === null || value === undefined) return;
          ctx.save();
          ctx.fillStyle = CHART.ink2;
          ctx.font = '600 11px system-ui, -apple-system, sans-serif';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText(String(value), bar.x + 7, bar.y);
          ctx.restore();
        });
      });
    }
  };

  function buildScorecardChart(s) {
    const canvas = $('#chart-scorecard');
    if (!canvas || typeof Chart === 'undefined') return;
    const scores = s.validation_scores || {};
    const labels = SCORE_DIMENSIONS.map(([, label]) => label);
    const values = SCORE_DIMENSIONS.map(([k]) => scores[k] ?? 0);

    if (state.charts.scorecard) state.charts.scorecard.destroy();
    state.charts.scorecard = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Score',
          data: values,
          backgroundColor: values.map(scoreHex),
          ...BAR_STYLE,
          maxBarThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        layout: { padding: { right: 26 } },
        scales: {
          x: { beginAtZero: true, max: 100, grid: { color: CHART.grid, drawBorder: false }, border: { display: false }, ticks: { color: CHART.muted, stepSize: 25 } },
          y: { grid: { display: false, drawBorder: false }, border: { color: CHART.axis }, ticks: { color: CHART.ink2, font: { size: 11.5 } } }
        },
        plugins: {
          tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.x} / 100 · ${scoreLabel(ctx.parsed.x)}` } }
        }
      },
      plugins: [valueLabelPlugin]
    });

    wireTableToggles();
  }

  function wireTableToggles(root = document) {
    $$('.table-toggle', root).forEach(btn => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', () => {
        const table = document.getElementById(btn.dataset.table);
        if (!table) return;
        table.hidden = !table.hidden;
        btn.textContent = table.hidden ? 'Show data table' : 'Hide data table';
      });
    });
  }

  /* --- Section 4 — Risks --- */

  function sectionRisks(s) {
    const cards = (s.risks || []).map((r, i) => `
      <div class="risk reveal" data-delay="${i * 80}">
        <div class="risk-head">
          <span class="risk-icon" aria-hidden="true">⚠</span>
          <div>
            <div class="risk-title">${esc(r.title)}</div>
          </div>
        </div>
        <div class="risk-block">
          <div class="risk-label">Why this matters</div>
          <p class="risk-text">${esc(r.why)}</p>
        </div>
        <div class="risk-block">
          <div class="risk-label is-consequence">Possible consequences</div>
          <p class="risk-text">${esc(r.consequences)}</p>
        </div>
        <div class="risk-block">
          <div class="risk-label is-solution">Suggested solution</div>
          <p class="risk-text">${esc(r.solution)}</p>
        </div>
        <div class="risk-example">${esc(r.example)}</div>
      </div>`).join('');

    return `
    <section class="section" id="sec-risks">
      <div class="wrap">
        ${head('Section 04', 'Your Biggest Risks', 'These are the specific things most likely to stop this company. They are not generic — they come from your profile.')}
        <div class="grid grid-2">${cards}</div>
      </div>
    </section>`;
  }

  /* --- Section 5 — Assumptions --- */

  function sectionAssumptions(s, saved) {
    const groups = ASSUMPTION_GROUPS.map(([key, groupLabel]) => {
      const items = s[key] || [];
      if (!items.length) return '';
      return items.map((a, i) => {
        const id = `${key}:${i}`;
        const status = saved.assumptions[id] || a.status || 'not';
        return `
          <div class="assumption reveal">
            <div class="assumption-main">
              <span class="assumption-cat">${esc(groupLabel)}</span>
              <div class="assumption-title">${esc(a.title)}</div>
              <p class="assumption-desc">${esc(a.description)}</p>
            </div>
            <div class="status-toggle" role="group" aria-label="Validation status for ${esc(a.title)}">
              ${Object.entries(STATUS_META).map(([value, meta]) => `
                <button class="status-btn" data-assumption="${esc(id)}" data-status="${value}"
                        aria-pressed="${status === value}">
                  <span aria-hidden="true">${meta.dot}</span>${meta.label}
                </button>`).join('')}
            </div>
          </div>`;
      }).join('');
    }).join('');

    return `
    <section class="section" id="sec-assumptions">
      <div class="wrap">
        ${head('Section 05', 'Assumptions to Validate', 'Every startup runs on assumptions. The dangerous ones are the ones you have not noticed you are making. Update each status honestly.')}
        <div class="stack">${groups}</div>
        <p class="muted reveal" style="font-size:.87rem;margin-top:1rem">
          <span class="saved-flag" id="assumptions-saved">✓ Saved</span>
          Your updates save automatically on this device.
        </p>
      </div>
    </section>`;
  }

  function wireAssumptions(startup) {
    $$('[data-assumption]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.assumption;
        const status = btn.dataset.status;
        FVStore.setField(startup.id, 'assumptions', id, status);
        btn.closest('.status-toggle').querySelectorAll('.status-btn').forEach(sib => {
          sib.setAttribute('aria-pressed', String(sib === btn));
        });
        queueSync(startup);
        flashSaved('assumptions-saved');
      });
    });
  }

  function flashSaved(id) {
    const flag = document.getElementById(id);
    if (!flag) return;
    flag.classList.add('show');
    clearTimeout(flag._t);
    flag._t = setTimeout(() => flag.classList.remove('show'), 1600);
  }

  /* --- Section 6 — Reflection --- */

  function sectionReflection(s, saved) {
    const items = (s.reflection_questions || []).map((q, i) => `
      <div class="card card--flat reveal">
        <label class="field-label" for="reflect-${i}">${esc(q)}</label>
        <textarea class="textarea" id="reflect-${i}" data-reflect="${i}"
                  placeholder="Take a moment. Write what is actually true, not what sounds good."
                  style="min-height:104px">${esc(saved.reflections[i] || '')}</textarea>
      </div>`).join('');

    return `
    <section class="section" id="sec-reflection">
      <div class="wrap-narrow">
        ${head('Section 06', 'Reflection Exercise', 'These questions are uncomfortable on purpose. The honest answer is more useful than the impressive one.')}
        <div class="stack">${items}</div>
        <p class="muted reveal" style="font-size:.87rem;margin-top:1rem">
          <span class="saved-flag" id="reflection-saved">✓ Saved</span>
          Your answers stay on your device and appear anonymously in the cohort summary.
        </p>
      </div>
    </section>`;
  }

  function wireReflection(startup) {
    $$('[data-reflect]').forEach(area => {
      const save = debounce(() => {
        FVStore.setField(startup.id, 'reflections', area.dataset.reflect, area.value);
        queueSync(startup);
        flashSaved('reflection-saved');
      }, 550);
      area.addEventListener('input', save);
    });
  }

  /* --- Section 7 — Challenge --- */

  function sectionChallenge(s, saved) {
    const tags = CHALLENGE_TAGS.map(tag => `
      <button class="tag" data-challenge-tag="${esc(tag)}"
              aria-pressed="${saved.challenge.tags.includes(tag)}">${esc(tag)}</button>`).join('');

    return `
    <section class="section" id="sec-challenge">
      <div class="wrap-narrow">
        ${head('Section 07', 'Your Current Challenge', 'What is genuinely blocking you right now? This shapes the discussion for the rest of the workshop.')}

        <div class="card card--flat reveal">
          <label class="field-label" for="challenge-text">Describe your biggest challenge</label>
          <textarea class="textarea" id="challenge-text"
                    placeholder="Describe the biggest challenge your startup is facing today.">${esc(saved.challenge.text)}</textarea>

          <div style="margin-top:1.5rem">
            <div class="field-label">Which areas does it touch?</div>
            <p class="field-hint">Select as many as apply.</p>
            <div class="tags">${tags}</div>
          </div>

          <p class="muted" style="font-size:.87rem;margin-top:1.2rem">
            <span class="saved-flag" id="challenge-saved">✓ Saved</span>
            Shared anonymously with your mentor as part of the cohort analytics.
          </p>
        </div>
      </div>
    </section>`;
  }

  function wireChallenge(startup) {
    const area = $('#challenge-text');
    const save = debounce(() => {
      const current = FVStore.get(startup.id);
      FVStore.set(startup.id, { challenge: { ...current.challenge, text: area.value } });
      queueSync(startup);
      flashSaved('challenge-saved');
    }, 550);
    area.addEventListener('input', save);

    $$('[data-challenge-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.challengeTag;
        const current = FVStore.get(startup.id);
        const tags = new Set(current.challenge.tags);
        if (tags.has(tag)) tags.delete(tag); else tags.add(tag);
        btn.setAttribute('aria-pressed', String(tags.has(tag)));
        FVStore.set(startup.id, { challenge: { ...current.challenge, tags: [...tags] } });
        queueSync(startup);
        flashSaved('challenge-saved');
      });
    });
  }

  /* --- Section 8 — SWOT --- */

  function sectionSwot(s) {
    const quad = (cls, icon, title, items) => `
      <div class="swot ${cls} reveal">
        <div class="swot-head">
          <span aria-hidden="true" style="font-size:1.1rem">${icon}</span>
          <span class="swot-title">${esc(title)}</span>
        </div>
        <ul class="swot-list">${(items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>`;

    return `
    <section class="section" id="sec-swot">
      <div class="wrap">
        ${head('Section 08', 'SWOT Analysis', 'An honest read of your position — including the parts that are uncomfortable.')}
        <div class="grid grid-2">
          ${quad('swot-s', '💪', 'Strengths', s.strengths)}
          ${quad('swot-w', '🔻', 'Weaknesses', s.weaknesses)}
          ${quad('swot-o', '🚀', 'Opportunities', s.opportunities)}
          ${quad('swot-t', '⚡', 'Threats', s.threats)}
        </div>
      </div>
    </section>`;
  }

  /* --- Section 9 — Investor --- */

  function sectionInvestor(s) {
    const items = (s.investor_questions || []).map((q, i) => `
      <div class="q-item reveal" data-delay="${i * 55}">
        <span class="q-num">${i + 1}</span>
        <span class="q-text">${esc(q)}</span>
      </div>`).join('');

    return `
    <section class="section" id="sec-investor">
      <div class="wrap-narrow">
        ${head('Section 09', 'If I Were Your Investor', 'The questions you would actually be asked. If you cannot answer one clearly, that is the work.')}
        <div class="stack">${items}</div>
        <div class="card card--flat reveal" style="margin-top:1.4rem;border-color:rgba(124,109,242,.3)">
          <div class="stat-label" style="margin-bottom:.6rem">Mentor note</div>
          <p style="font-size:.98rem;color:var(--ink-2)">${esc(s.mentor_notes)}</p>
        </div>
      </div>
    </section>`;
  }

  /* --- Section 10 — Plan --- */

  function sectionPlan(s) {
    const items = (s.action_plan || []).slice(0, 3).map((a, i) => `
      <div class="action reveal" data-delay="${i * 80}">
        <span class="action-rank">${i + 1}</span>
        <div class="action-task">${esc(a.task)}</div>
        <div class="action-meta">
          <div class="action-meta-item">
            <span class="action-meta-label">Why</span>
            <span class="action-meta-text">${esc(a.reason)}</span>
          </div>
          <div class="action-meta-item">
            <span class="action-meta-label">Expected impact</span>
            <span class="action-meta-text">${esc(a.impact)}</span>
          </div>
          <div class="action-meta-item">
            <span class="action-meta-label">Success metric</span>
            <span class="action-meta-text">${esc(a.metric)}</span>
          </div>
        </div>
        <span class="action-deadline"><span aria-hidden="true">⏱</span> ${esc(a.deadline)}</span>
      </div>`).join('');

    const kpis = (s.kpis || []).map(k => `
      <div class="stat">
        <div class="stat-label">${esc(k.name)}</div>
        <div class="stat-value" style="font-size:1.1rem">${esc(k.target)}</div>
        <div class="stat-note">${esc(k.why)}</div>
      </div>`).join('');

    return `
    <section class="section" id="sec-plan">
      <div class="wrap">
        ${head('Section 10', 'Your 30-Day Action Plan', 'Only three priorities. A longer list is a way of avoiding the hard one.')}
        <div class="grid grid-3">${items}</div>

        <div class="section-head reveal" style="margin-top:2.6rem">
          <h3>Metrics worth tracking</h3>
          <p class="section-sub">If you only watch four numbers this quarter, watch these.</p>
        </div>
        <div class="grid grid-4 reveal">${kpis}</div>
      </div>
    </section>`;
  }

  /* --- Section 11 — Learning --- */

  function sectionLearning(s) {
    const card = (kind, title, author, why) => `
      <div class="learn-card reveal">
        <span class="learn-kind">${esc(kind)}</span>
        <div class="learn-title">${esc(title)}</div>
        ${author ? `<div class="learn-author">${esc(author)}</div>` : ''}
        <p class="learn-why">${esc(why)}</p>
      </div>`;

    const books = (s.recommended_books || []).map(b => card('Book', b.title, b.author, b.why)).join('');
    const frameworks = (s.recommended_frameworks || []).map(f => card('Framework', f.name, '', f.why)).join('');
    const tools = (s.recommended_tools || []).map(t => card('Tool', t.name, '', t.why)).join('');
    const videos = (s.recommended_videos || []).map(v => card('Video', v.title, v.source, v.why)).join('');

    return `
    <section class="section" id="sec-learning">
      <div class="wrap">
        ${head('Section 11', 'Learning Center', 'Chosen for the specific problems in your profile — not a generic reading list.')}
        <div class="grid grid-3">${books}${frameworks}${tools}${videos}</div>
      </div>
    </section>`;
  }

  /* --- Section 12 — Commitment --- */

  function sectionCommitment(s, saved) {
    return `
    <section class="section" id="sec-commitment">
      <div class="wrap-narrow">
        ${head('Section 12', 'Founder Commitment', 'Write one thing you will actually do. Specific beats ambitious.')}
        <div class="glass reveal" style="padding:2rem">
          <label class="field-label" for="commitment-text" style="font-size:1.15rem;margin-bottom:1rem">
            Before the next workshop I commit to...
          </label>
          <textarea class="textarea" id="commitment-text"
                    placeholder="...completing 15 customer interviews and writing down what surprised me."
                    style="min-height:120px">${esc(saved.commitment)}</textarea>
          <p class="muted" style="font-size:.87rem;margin-top:.9rem">
            <span class="saved-flag" id="commitment-saved">✓ Saved</span>
            You will be asked about this at the next session.
          </p>
        </div>
      </div>
    </section>`;
  }

  function wireCommitment(startup) {
    const area = $('#commitment-text');
    const save = debounce(() => {
      FVStore.set(startup.id, { commitment: area.value });
      queueSync(startup);
      flashSaved('commitment-saved');
    }, 550);
    area.addEventListener('input', save);
  }

  /* --- Section 13 — Completion --- */

  function sectionCompletion(s) {
    return `
    <section class="section" id="sec-completion">
      <div class="wrap-narrow">
        <div class="glass reveal" style="padding:clamp(1.8rem,4vw,3rem);text-align:center">
          <div style="font-size:3rem;margin-bottom:1rem" aria-hidden="true">🎉</div>
          <h2 style="margin-bottom:.8rem">Congratulations</h2>
          <p style="color:var(--ink-2);max-width:52ch;margin:0 auto 2rem">
            You have completed your validation journey. Submit your responses so your mentor
            can see them, then generate your personal report to take everything with you.
          </p>
          <div style="display:flex;gap:.7rem;flex-wrap:wrap;justify-content:center">
            <button class="btn btn-primary btn-lg" id="submit-responses">
              Submit My Responses
            </button>
            <button class="btn btn-ghost btn-lg" id="generate-report">
              Generate My Validation Report
            </button>
            <button class="btn btn-ghost btn-lg" id="back-top">Back to top</button>
          </div>
          <p id="submit-note" class="muted" style="font-size:.87rem;margin-top:1.1rem">
            Your answers already save as you type. Submitting marks them final.
          </p>
        </div>
      </div>
    </section>`;
  }

  function wireCompletion(startup) {
    const submitBtn = $('#submit-responses');
    const note = $('#submit-note');

    submitBtn.addEventListener('click', async () => {
      if (state.submitting) return;              // guards a double-tap
      state.submitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';

      FVStore.markSubmitted(startup.id);
      const result = await pushSync(startup);

      state.submitting = false;
      submitBtn.disabled = false;

      if (result.ok) {
        submitBtn.textContent = '✓ Submitted';
        note.textContent = 'Your mentor can see your responses now. You can keep editing — changes sync automatically.';
        toast('Submitted to your mentor');
      } else if (result.queued) {
        submitBtn.textContent = 'Submit My Responses';
        note.textContent = 'Saved on your device. You are offline right now, so it will send automatically when the connection returns.';
        toast('Saved — will send when back online');
      }
    });

    $('#generate-report').addEventListener('click', () => {
      renderReport(startup);
    });
    $('#back-top').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------- View 5 — Report ---------------------------- */

  function renderReport(s) {
    const saved = FVStore.get(s.id);
    const scores = s.validation_scores || {};
    const overall = overallScore(scores);
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const scoreRows = SCORE_DIMENSIONS.map(([k, label]) => `
      <div class="score-row">
        <div class="score-head">
          <span class="score-name">${esc(label)}</span>
          <span class="score-num">${scores[k] ?? 0} · ${esc(scoreLabel(scores[k] ?? 0))}</span>
        </div>
        <div class="score-track">
          <div class="score-fill" data-width="${scores[k] ?? 0}"
               style="background:${scoreColor(scores[k] ?? 0)}"></div>
        </div>
      </div>`).join('');

    const reflections = (s.reflection_questions || []).map((q, i) => {
      const answer = (saved.reflections[i] || '').trim();
      return `
        <div style="margin-bottom:1.2rem">
          <p style="font-size:.92rem;font-weight:560;margin-bottom:.35rem">${esc(q)}</p>
          <p style="font-size:.93rem;color:var(--ink-2)">
            ${answer ? esc(answer) : '<em class="muted">Not answered</em>'}
          </p>
        </div>`;
    }).join('');

    const assumptionSummary = ASSUMPTION_GROUPS.flatMap(([key, groupLabel]) =>
      (s[key] || []).map((a, i) => {
        const status = saved.assumptions[`${key}:${i}`] || a.status || 'not';
        return `<tr>
          <td>${esc(groupLabel)}</td>
          <td>${esc(a.title)}</td>
          <td>${STATUS_META[status].dot} ${esc(STATUS_META[status].label)}</td>
        </tr>`;
      })
    ).join('');

    const risks = (s.risks || []).map((r, i) => `
      <div style="margin-bottom:1.2rem">
        <p style="font-weight:600;margin-bottom:.3rem">${i + 1}. ${esc(r.title)}</p>
        <p style="font-size:.92rem;color:var(--ink-2);margin-bottom:.3rem">${esc(r.why)}</p>
        <p style="font-size:.92rem;color:var(--ink-2)"><strong>Do this:</strong> ${esc(r.solution)}</p>
      </div>`).join('');

    const plan = (s.action_plan || []).slice(0, 3).map((a, i) => `
      <div style="margin-bottom:1.1rem">
        <p style="font-weight:600">${i + 1}. ${esc(a.task)} <span class="muted" style="font-weight:400">— ${esc(a.deadline)}</span></p>
        <p style="font-size:.92rem;color:var(--ink-2)">Success metric: ${esc(a.metric)}</p>
      </div>`).join('');

    $('#report-content').innerHTML = `
      <div class="wrap-narrow" style="padding:2.5rem 0 4rem">

        <div class="no-print" style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:2rem">
          <button class="btn btn-primary" id="print-report">
            <span aria-hidden="true">🖨</span> Print / Save as PDF
          </button>
          <button class="btn btn-ghost" id="report-back">← Back to dashboard</button>
        </div>

        <div class="glass" style="padding:clamp(1.6rem,4vw,2.6rem)">

          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;align-items:flex-start;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid var(--line)">
            <div>
              <p class="muted" style="font-size:.74rem;letter-spacing:.13em;text-transform:uppercase;margin-bottom:.5rem">
                Film Business Accelerator
              </p>
              <h1 style="font-size:1.9rem;margin-bottom:.4rem">Personal Validation Report</h1>
              <p style="color:var(--ink-2)">${nameSpan(s.startup_name_en)} · ${nameSpan(s.startup_name_ar)}</p>
            </div>
            <div style="text-align:right">
              <div class="stat-label">Overall validation</div>
              <div style="font-size:2.4rem;font-weight:680;color:${scoreColor(overall)};line-height:1">${overall}</div>
              <div class="muted" style="font-size:.82rem">${esc(scoreLabel(overall))} · ${now}</div>
            </div>
          </div>

          <div class="report-section">
            <div class="report-h">Profile</div>
            <div class="grid grid-3">
              ${statTile('Stage', s.stage, '')}
              ${statTile('Revenue', s.revenue, '')}
              ${statTile('Team', String(s.team_size), '')}
            </div>
          </div>

          <div class="report-section">
            <div class="report-h">Validation Scorecard</div>
            ${scoreRows}
          </div>

          <div class="report-section">
            <div class="report-h">Biggest Risks</div>
            ${risks}
          </div>

          <div class="report-section">
            <div class="report-h">Assumption Status</div>
            <div class="scroll-x">
              <table class="data-table">
                <thead><tr><th>Type</th><th>Assumption</th><th>Status</th></tr></thead>
                <tbody>${assumptionSummary}</tbody>
              </table>
            </div>
          </div>

          <div class="report-section">
            <div class="report-h">Your Reflection Answers</div>
            ${reflections}
          </div>

          <div class="report-section">
            <div class="report-h">Your Current Challenge</div>
            <p style="font-size:.95rem;color:var(--ink-2);margin-bottom:.8rem">
              ${saved.challenge.text.trim() ? esc(saved.challenge.text) : '<em class="muted">Not answered</em>'}
            </p>
            ${saved.challenge.tags.length
              ? `<div class="tags">${saved.challenge.tags.map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div>`
              : ''}
          </div>

          <div class="report-section">
            <div class="report-h">30-Day Action Plan</div>
            ${plan}
          </div>

          <div class="report-section">
            <div class="report-h">Your Commitment</div>
            <p style="font-size:1rem;font-style:italic;color:var(--ink-1)">
              “Before the next workshop I commit to
              ${saved.commitment.trim() ? esc(saved.commitment) : '<span class="muted">— not yet written</span>'}”
            </p>
          </div>

          <div class="report-section" style="margin-bottom:0">
            <div class="report-h">Mentor Notes</div>
            <p style="font-size:.95rem;color:var(--ink-2)">${esc(s.mentor_notes)}</p>
          </div>

        </div>
      </div>`;

    showView('view-report');
    FVUI.animateScoreBars($('#report-content'));

    $('#print-report').addEventListener('click', () => window.print());
    $('#report-back').addEventListener('click', () => showView('view-dashboard'));
  }

  /* ---------------------------- Go ---------------------------- */

  document.addEventListener('DOMContentLoaded', boot);
})();

/* ==========================================================================
   Mentor Dashboard — anonymous cohort analytics.

   Privacy rule, enforced throughout: no startup name and no founder name is
   ever read into this view. Participants are referred to only by an index.
   ========================================================================== */

(() => {
  const { $, $$, esc, countUp, observeReveals, scrollProgress,
          scoreColor, scoreLabel, average, overallScore,
          CHART, initChartDefaults, BAR_STYLE, pct, toast, reducedMotion } = FVUI;

  const PASSWORD = 'accelerator2026';
  const UNLOCK_KEY = 'fvip:mentor-unlocked';

  /* responses: startup_id -> database row. Kept as a map so a realtime event
     can replace exactly one entry instead of refetching the whole workshop. */
  const state = {
    startups: [],
    responses: {},
    charts: {},
    rendered: false,
    lastEventAt: null,
    connection: 'local'
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

  const STAGES = ['Idea', 'Problem Validation', 'Customer Discovery', 'MVP',
                  'First Revenue', 'Product Market Fit', 'Growth', 'Scale'];

  const ASSUMPTION_GROUPS = ['customer_assumptions', 'business_assumptions',
                             'technical_assumptions', 'pricing_assumptions'];

  /* ---------------------------- Gate ---------------------------- */

  function initGate() {
    const form = $('#gate-form');
    const input = $('#gate-password');
    const error = $('#gate-error');

    if (sessionStorage.getItem(UNLOCK_KEY) === '1') { unlock(); return; }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input.value === PASSWORD) {
        sessionStorage.setItem(UNLOCK_KEY, '1');
        unlock();
      } else {
        error.textContent = 'Incorrect password. Please check with the workshop organiser.';
        error.style.display = 'block';
        input.value = '';
        input.focus();
      }
    });
  }

  function unlock() {
    $('#view-gate').classList.remove('active');
    $('#view-dash').classList.add('active');
    boot();
  }

  /* ---------------------------- Boot ---------------------------- */

  async function boot() {
    initChartDefaults();
    scrollProgress($('#rail-fill'));
    FVApi.init();
    mountConnectionBadge();

    try {
      const res = await fetch('data/startups.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.startups = await res.json();
    } catch (err) {
      console.error('Failed to load cohort data', err);
      $('#dash-content').innerHTML = `
        <div class="wrap section center">
          <div class="card" style="max-width:520px;margin:0 auto">
            <h3 style="margin-bottom:.7rem">Could not load cohort data</h3>
            <p class="muted">The startup database could not be reached. Serve this site over HTTP and try again.</p>
          </div>
        </div>`;
      return;
    }

    await loadResponses();
    render();
    startRealtime();

    $('#refresh-data').addEventListener('click', async () => {
      await loadResponses();
      render();
      toast('Cohort data refreshed');
    });
    $('#print-workshop').addEventListener('click', () => window.print());
  }

  async function loadResponses() {
    const rows = await FVApi.fetchAll();
    const map = {};
    rows.forEach(row => { map[row.startup_id] = row; });
    state.responses = map;
  }

  /**
   * Realtime is what turns this from a report into a live dashboard: when a
   * founder submits, the row arrives here and the charts rebuild.
   *
   * Re-render is debounced because twenty founders typing produce a stream of
   * updates, and rebuilding eight charts on every keystroke would thrash the
   * facilitator's laptop mid-session.
   */
  function startRealtime() {
    if (!FVApi.isLive()) return;

    FVApi.subscribe((eventType, row) => {
      if (!row?.startup_id) return;
      if (eventType === 'DELETE') delete state.responses[row.startup_id];
      else state.responses[row.startup_id] = row;

      state.lastEventAt = new Date();
      scheduleRender();
      pulseLiveBadge();
    });
  }

  const scheduleRender = FVUI.debounce(() => render(), 450);

  function pulseLiveBadge() {
    const badge = document.getElementById('live-badge');
    if (!badge) return;
    badge.classList.remove('pulse');
    void badge.offsetWidth;              // restart the animation
    badge.classList.add('pulse');
  }

  function mountConnectionBadge() {
    FVApi.onStatus((status) => {
      state.connection = status;
      const badge = document.getElementById('live-badge');
      if (!badge) return;
      const map = {
        live:    ['var(--good)',    'Live'],
        offline: ['var(--warning)', 'Reconnecting…'],
        local:   ['var(--ink-3)',   'Local mode']
      };
      const [color, label] = map[status] || map.local;
      const stamp = state.lastEventAt
        ? ` · updated ${state.lastEventAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
        : '';
      badge.innerHTML =
        `<span class="legend-swatch" style="background:${color};border-radius:50%"></span>${esc(label + stamp)}`;
      badge.title = status === 'local'
        ? 'Supabase is not configured — showing baseline profiles only.'
        : `Connected to workshop “${esc(FVApi.workshopId())}”. Charts update as founders submit.`;
    });
  }

  /* ---------------------------- Derived analytics ---------------------------- */

  /**
   * Everything the dashboard renders comes from this one computation, so the
   * anonymity guarantee lives in a single place: participants carry an index,
   * never a name.
   */
  function analyse() {
    const startups = state.startups;
    const total = startups.length;

    const participants = startups.map((s, i) => {
      /* The database row is read here and nowhere else. participant_name and
         session_id are deliberately not copied onto this object, so no part
         of the UI can render them even by accident. */
      const row = state.responses[s.id] || null;
      const r = row ? FVApi.rowToResponse(row) : {
        assumptions: {}, reflections: {}, challenge: { text: '', tags: [] },
        commitment: '', submitted: false
      };
      return {
        index: i + 1,
        label: `Participant ${String(i + 1).padStart(2, '0')}`,
        hasResponse: Boolean(row),
        submitted: Boolean(row?.submitted),
        updatedAt: row?.updated_at || null,
        stage: s.stage,
        category: s.category,
        businessModel: modelBucket(s.business_model),
        revenueStage: revenueBucket(s.revenue),
        teamBucket: teamBucket(s.team_size),
        scores: s.validation_scores || {},
        overall: overallScore(s.validation_scores),
        readiness: s.readiness,
        completion: row
          ? (row.completion_percentage ?? FVStore.completionOf(r, s))
          : 0,
        challengeText: (r.challenge.text || '').trim(),
        challengeTags: r.challenge.tags || [],
        reflections: Object.values(r.reflections || {}).map(v => (v || '').trim()).filter(Boolean),
        commitment: (r.commitment || '').trim(),
        assumptionStatuses: assumptionStatuses(s, r),
        riskCount: (s.risks || []).length,
        discussionTopics: s.discussion_topics || []
      };
    });

    const dimensionAverages = SCORE_DIMENSIONS.map(([key, label]) => ({
      key, label,
      value: Math.round(average(participants.map(p => p.scores[key] ?? 0)))
    }));

    return {
      total,
      participants,
      dimensionAverages,
      responded: participants.filter(p => p.hasResponse).length,
      submittedCount: participants.filter(p => p.submitted).length,
      completed: participants.filter(p => p.completion >= 80).length,
      avgCompletion: Math.round(average(participants.map(p => p.completion))),
      avgOverall: Math.round(average(participants.map(p => p.overall))),
      avgInvestor: Math.round(average(participants.map(p => p.scores.investor ?? 0))),
      avgCustomer: Math.round(average(participants.map(p => p.scores.customer ?? 0))),
      avgRevenue: Math.round(average(participants.map(p => p.scores.revenue ?? 0))),
      avgHealth: Math.round(average(participants.map(p => (p.overall + p.readiness) / 2))),
      stageDist: countBy(participants, p => p.stage, STAGES),
      scoreDist: scoreBuckets(participants),
      investorDist: readinessBuckets(participants),
      riskDist: riskBuckets(participants),
      modelDist: countBy(participants, p => p.businessModel),
      revenueDist: countBy(participants, p => p.revenueStage,
        ['Pre-revenue', 'Under SAR 100K', 'SAR 100K–500K', 'SAR 500K–1M', 'Above SAR 1M']),
      teamDist: countBy(participants, p => p.teamBucket, ['1–2', '3–5', '6–10', '11+']),
      challengeCounts: challengeCounts(participants),
      assumptionTotals: assumptionTotals(participants),
      quotes: collectQuotes(participants),
      words: wordFrequencies(participants)
    };
  }

  function modelBucket(model) {
    const m = (model || '').toLowerCase();
    // Order matters: a marketplace that also sells subscriptions is still a
    // marketplace, so the more specific model is tested first.
    if (m.includes('marketplace') || m.includes('take rate')) return 'Marketplace';
    if (m.includes('subscription') || m.includes('saas')) return 'Subscription / SaaS';
    if (m.includes('licens')) return 'IP / Licensing';
    if (m.includes('project') || m.includes('service')) return 'Services / Projects';
    return 'Other';
  }

  function revenueBucket(revenue) {
    const r = String(revenue || '').toLowerCase();
    if (r.includes('pre-revenue')) return 'Pre-revenue';
    const num = parseFloat(r.replace(/[^0-9.]/g, ''));
    if (!num) return 'Pre-revenue';
    const inThousands = r.includes('m') ? num * 1000 : num;
    if (inThousands < 100) return 'Under SAR 100K';
    if (inThousands < 500) return 'SAR 100K–500K';
    if (inThousands < 1000) return 'SAR 500K–1M';
    return 'Above SAR 1M';
  }

  function teamBucket(size) {
    if (size <= 2) return '1–2';
    if (size <= 5) return '3–5';
    if (size <= 10) return '6–10';
    return '11+';
  }

  function countBy(items, keyFn, order) {
    const map = new Map();
    (order || []).forEach(k => map.set(k, 0));
    items.forEach(item => {
      const k = keyFn(item);
      map.set(k, (map.get(k) || 0) + 1);
    });
    let entries = [...map.entries()];
    if (!order) entries.sort((a, b) => b[1] - a[1]);
    else entries = entries.filter(([, v]) => v > 0);
    return entries.map(([label, value]) => ({ label, value }));
  }

  function scoreBuckets(participants) {
    const buckets = [
      { label: '0–29',   min: 0,  max: 29 },
      { label: '30–49',  min: 30, max: 49 },
      { label: '50–69',  min: 50, max: 69 },
      { label: '70–100', min: 70, max: 100 }
    ];
    return buckets.map(b => ({
      label: b.label,
      value: participants.filter(p => p.overall >= b.min && p.overall <= b.max).length
    }));
  }

  function readinessBuckets(participants) {
    return [
      { label: 'Not ready (<30)',    value: participants.filter(p => (p.scores.investor ?? 0) < 30).length },
      { label: 'Early (30–49)',      value: participants.filter(p => (p.scores.investor ?? 0) >= 30 && (p.scores.investor ?? 0) < 50).length },
      { label: 'Developing (50–69)', value: participants.filter(p => (p.scores.investor ?? 0) >= 50 && (p.scores.investor ?? 0) < 70).length },
      { label: 'Ready (70+)',        value: participants.filter(p => (p.scores.investor ?? 0) >= 70).length }
    ];
  }

  /* Risk level is derived from overall validation: weaker validation means
     more of the business rests on untested assumptions. */
  function riskBuckets(participants) {
    return [
      { label: 'Critical', value: participants.filter(p => p.overall < 30).length, color: CHART.status.critical },
      { label: 'High',     value: participants.filter(p => p.overall >= 30 && p.overall < 50).length, color: CHART.status.serious },
      { label: 'Moderate', value: participants.filter(p => p.overall >= 50 && p.overall < 70).length, color: CHART.status.warning },
      { label: 'Low',      value: participants.filter(p => p.overall >= 70).length, color: CHART.status.good }
    ];
  }

  function assumptionStatuses(startup, response) {
    const out = [];
    ASSUMPTION_GROUPS.forEach(group => {
      (startup[group] || []).forEach((a, i) => {
        out.push(response.assumptions[`${group}:${i}`] || a.status || 'not');
      });
    });
    return out;
  }

  function assumptionTotals(participants) {
    const all = participants.flatMap(p => p.assumptionStatuses);
    return {
      total: all.length,
      validated: all.filter(s => s === 'validated').length,
      partial: all.filter(s => s === 'partial').length,
      not: all.filter(s => s === 'not').length
    };
  }

  function challengeCounts(participants) {
    const map = new Map();
    participants.forEach(p => p.challengeTags.forEach(tag => {
      map.set(tag, (map.get(tag) || 0) + 1);
    }));
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  function collectQuotes(participants) {
    const quotes = [];
    participants.forEach(p => {
      p.reflections.forEach(text => {
        if (text.length > 25) quotes.push({ text, source: 'Reflection' });
      });
      if (p.challengeText.length > 25) quotes.push({ text: p.challengeText, source: 'Current challenge' });
      if (p.commitment.length > 20) quotes.push({ text: p.commitment, source: 'Commitment' });
    });
    return quotes;
  }

  const STOP = new Set(['the','and','for','that','with','have','this','from','they','been','were','what',
    'when','will','would','could','should','there','their','which','about','more','than','into','only',
    'them','then','some','because','just','very','much','also','over','after','before','still','need',
    'needs','make','made','take','know','like','want','wants','ويجب','لكن','هذا','على','في','من','الى','مع']);

  function wordFrequencies(participants) {
    const map = new Map();
    participants.forEach(p => {
      const corpus = [p.challengeText, ...p.reflections, p.commitment].join(' ');
      corpus.toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP.has(w))
        .forEach(w => map.set(w, (map.get(w) || 0) + 1));
    });
    return [...map.entries()]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 34);
  }

  /* ---------------------------- Insights ---------------------------- */

  /**
   * Rule-based insight generation. Each rule tests a cohort-level condition
   * and only fires when the data actually supports the claim.
   */
  function generateInsights(a) {
    const insights = [];
    const dim = key => a.dimensionAverages.find(d => d.key === key)?.value ?? 0;

    const revenue = dim('revenue');
    const execution = dim('execution');
    const customer = dim('customer');
    const problem = dim('problem');
    const investor = dim('investor');
    const competition = dim('competition');

    if (revenue < 40) {
      insights.push({
        icon: '💸', severity: 'critical',
        title: 'The majority of startups have not validated willingness to pay',
        text: `Revenue validation averages ${revenue} across the cohort — the weakest signal in the room. Most founders can describe demand but cannot point to money that has actually moved. This is the single highest-leverage discussion topic today.`
      });
    }

    if (execution - revenue >= 15) {
      insights.push({
        icon: '⚖️', severity: 'warning',
        title: 'Revenue validation is significantly weaker than execution readiness',
        text: `Execution readiness averages ${execution} while revenue validation averages ${revenue}, a gap of ${execution - revenue} points. The cohort is better at building than at proving anyone will pay — the classic pattern behind well-executed products that never find a market.`
      });
    }

    if (customer < 60) {
      insights.push({
        icon: '🎧', severity: 'warning',
        title: 'Most founders need more customer interviews',
        text: `Customer validation averages ${customer}. Very few participants have spoken to enough customers to see a pattern rather than an anecdote. Push for a specific number: how many interviews, and what surprised them.`
      });
    }

    if (problem - customer >= 12) {
      insights.push({
        icon: '🧭', severity: 'warning',
        title: 'Founders are confident about the problem but not about who has it',
        text: `Problem validation (${problem}) runs well ahead of customer validation (${customer}). The cohort believes the problem is real but has not pinned down which specific segment feels it most acutely — which is where focus and pricing come from.`
      });
    }

    const notValidatedPct = pct(a.assumptionTotals.not, a.assumptionTotals.total);
    if (notValidatedPct >= 40) {
      insights.push({
        icon: '🔴', severity: 'critical',
        title: 'Many founders are building on untested assumptions',
        text: `${notValidatedPct}% of all tracked assumptions across the cohort remain unvalidated. Founders are making roadmap and hiring decisions on beliefs they have not yet checked — the most expensive kind of mistake at this stage.`
      });
    }

    if (investor < 45) {
      insights.push({
        icon: '📉', severity: 'warning',
        title: 'Investor readiness is the cohort\'s weakest commercial dimension',
        text: `Investor readiness averages ${investor}. Most participants would struggle with basic diligence questions on unit economics, retention and customer acquisition cost. Worth a dedicated session before any of them pitch.`
      });
    }

    if (competition < 50) {
      insights.push({
        icon: '👀', severity: 'warning',
        title: 'Competitive awareness is low across the cohort',
        text: `Competition awareness averages ${competition}. Founders are largely inward-facing, which makes them vulnerable to being surprised — particularly in the fastest-moving categories represented here.`
      });
    }

    const preRevenue = a.revenueDist.find(r => r.label === 'Pre-revenue')?.value ?? 0;
    if (preRevenue / a.total >= 0.4) {
      insights.push({
        icon: '🌱', severity: 'warning',
        title: `${preRevenue} of ${a.total} startups are still pre-revenue`,
        text: 'A large share of the cohort has never completed a paid transaction. For these founders, the single most valuable outcome of this workshop is a concrete plan to earn their first riyal — not a better product.'
      });
    }

    const topChallenge = a.challengeCounts[0];
    if (topChallenge && topChallenge.value >= 2) {
      insights.push({
        icon: '🔥', severity: 'warning',
        title: `${topChallenge.label} is the most shared challenge in the room`,
        text: `${topChallenge.value} of ${a.total} participants named ${topChallenge.label.toLowerCase()} as a live blocker. A shared problem is the best possible use of group time — solve it once, in front of everyone.`
      });
    }

    const strong = a.participants.filter(p => p.overall >= 70).length;
    if (strong > 0) {
      insights.push({
        icon: '⭐', severity: 'good',
        title: `${strong} startup${strong === 1 ? '' : 's'} ${strong === 1 ? 'is' : 'are'} materially ahead of the cohort`,
        text: 'These participants have validated most of their core assumptions and face scaling questions rather than existence questions. Consider pairing them with earlier-stage founders — peer teaching will land harder than mentor teaching.'
      });
    }

    if (a.avgCompletion < 50) {
      insights.push({
        icon: '📝', severity: 'warning',
        title: 'Workshop completion is still low',
        text: `Average completion is ${a.avgCompletion}%. Encourage founders to finish the reflection and challenge sections — the cohort analytics get sharper with every response, and the discussion topics below depend on them.`
      });
    }

    return insights;
  }

  function recommendedTopics(a) {
    const scored = new Map();
    const bump = (topic, weight) => scored.set(topic, (scored.get(topic) || 0) + weight);

    // Weakest cohort dimensions drive the agenda.
    [...a.dimensionAverages].sort((x, y) => x.value - y.value).slice(0, 3).forEach((d, i) => {
      bump(dimensionTopic(d.key), 30 - i * 6);
    });

    // Live challenges from founders carry real weight.
    a.challengeCounts.slice(0, 4).forEach(c => bump(`${c.label}: what is actually blocking progress`, 8 * c.value));

    // Topics the startups themselves flagged.
    a.participants.forEach(p => p.discussionTopics.forEach(t => bump(t, 4)));

    if (pct(a.assumptionTotals.not, a.assumptionTotals.total) >= 40) {
      bump('How to design a cheap experiment for your riskiest assumption', 26);
    }

    return [...scored.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 5)
      .map(([topic], i) => ({ rank: i + 1, topic }));
  }

  function dimensionTopic(key) {
    return ({
      problem:     'Proving the problem is real before building the solution',
      customer:    'Running customer interviews that produce evidence, not encouragement',
      solution:    'Testing whether your solution actually solves the problem',
      revenue:     'Validating willingness to pay — getting to the first real transaction',
      market:      'Sizing the market honestly and choosing a beachhead',
      execution:   'Building operating discipline that survives growth',
      team:        'Closing capability gaps in the founding team',
      investor:    'What investors actually ask, and how to answer with evidence',
      competition: 'Knowing your competitive landscape before it surprises you'
    })[key] || 'Validation fundamentals';
  }

  /* ---------------------------- Render ---------------------------- */

  /**
   * Counters animate on the first paint only. Re-rendering on every realtime
   * event would otherwise snap every KPI back to zero and count up again each
   * time a founder submits, which reads as flickering during a live session.
   */
  function render() {
    const animate = !state.rendered;
    state.rendered = true;
    const a = analyse();
    const insights = generateInsights(a);
    const topics = recommendedTopics(a);

    $('#dash-content').innerHTML = [
      overviewSection(a),
      analyticsSection(a),
      challengeSection(a),
      assumptionSection(a),
      heatmapSection(a),
      insightsSection(insights),
      topicsSection(topics),
      quotesSection(a),
      wordcloudSection(a),
      reportFooter(a)
    ].join('');

    observeReveals($('#dash-content'));
    buildCharts(a, animate);
    wireQuotes(a);
    wireTableToggles();

    $$('[data-count]').forEach(node => {
      const value = Number(node.dataset.count);
      const suffix = node.dataset.suffix || '';
      if (animate) countUp(node, value, { suffix });
      else node.textContent = value + suffix;
    });
  }

  const head = (eyebrow, title, sub) => `
    <div class="section-head reveal">
      <div class="section-eyebrow">${esc(eyebrow)}</div>
      <h2>${esc(title)}</h2>
      ${sub ? `<p class="section-sub">${esc(sub)}</p>` : ''}
    </div>`;

  const kpi = (label, value, note, suffix = '') => `
    <div class="stat reveal">
      <div class="stat-label">${esc(label)}</div>
      <div class="stat-value"><span data-count="${value}" data-suffix="${suffix}">0</span></div>
      <div class="stat-note">${esc(note)}</div>
    </div>`;

  function overviewSection(a) {
    return `
    <section class="section" id="sec-overview">
      <div class="wrap">
        ${head('Overview', 'Cohort Health', 'Live view of the room, updating as founders submit. Every figure is aggregated — no startup or founder is identifiable.')}
        <div class="grid grid-4">
          ${kpi('Total Participants', a.total, 'Startups in this cohort')}
          ${kpi('Responses Received', a.responded, `${a.submittedCount} marked as submitted`)}
          ${kpi('Assessment Completion', a.avgCompletion, 'Average across the cohort', '%')}
          ${kpi('Avg Validation Score', a.avgOverall, scoreLabel(a.avgOverall), '')}
          ${kpi('Avg Investor Readiness', a.avgInvestor, scoreLabel(a.avgInvestor), '')}
          ${kpi('Avg Customer Validation', a.avgCustomer, scoreLabel(a.avgCustomer), '')}
          ${kpi('Avg Revenue Validation', a.avgRevenue, scoreLabel(a.avgRevenue), '')}
          ${kpi('Avg Overall Health', a.avgHealth, 'Validation and readiness combined', '')}
          ${kpi('Journeys Completed', a.completed, `of ${a.total} at 80% or more`)}
        </div>
      </div>
    </section>`;
  }

  function chartCard(id, title, sub, { legend = '', tall = false, tableId = '', table = '' } = {}) {
    return `
      <div class="chart-card reveal">
        <div class="chart-title">${esc(title)}</div>
        <div class="chart-sub">${esc(sub)}</div>
        <div class="chart-box${tall ? ' tall' : ''}">
          <canvas id="${id}" aria-label="${esc(title)}"></canvas>
        </div>
        ${legend ? `<div class="chart-legend">${legend}</div>` : ''}
        ${table ? `
          <button class="table-toggle" data-table="${tableId}">Show data table</button>
          <div class="scroll-x" id="${tableId}" hidden>${table}</div>` : ''}
      </div>`;
  }

  function simpleTable(headers, rows) {
    return `<table class="data-table">
      <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(String(c))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  }

  function analyticsSection(a) {
    const t = d => simpleTable(['Category', 'Startups'], d.map(x => [x.label, x.value]));
    return `
    <section class="section" id="sec-analytics">
      <div class="wrap">
        ${head('Analytics', 'Cohort Distributions', 'Where the room sits across stage, validation, readiness and business model.')}
        <div class="grid grid-2">
          ${chartCard('c-stage', 'Startup stage distribution', 'How far along the cohort is', { tableId: 't-stage', table: t(a.stageDist) })}
          ${chartCard('c-score', 'Validation score distribution', 'Overall validation score bands', { tableId: 't-score', table: t(a.scoreDist) })}
          ${chartCard('c-investor', 'Investor readiness', 'Readiness to withstand diligence', { tableId: 't-investor', table: t(a.investorDist) })}
          ${chartCard('c-risk', 'Risk levels', 'Derived from overall validation strength', {
            legend: a.riskDist.map(r => `<span class="legend-item"><span class="legend-swatch" style="background:${r.color}"></span>${esc(r.label)}</span>`).join(''),
            tableId: 't-risk', table: t(a.riskDist)
          })}
          ${chartCard('c-model', 'Business models', 'How the cohort plans to make money', { tableId: 't-model', table: t(a.modelDist) })}
          ${chartCard('c-revenue', 'Revenue stages', 'Current revenue bands', { tableId: 't-revenue', table: t(a.revenueDist) })}
          ${chartCard('c-team', 'Team sizes', 'People per startup today', { tableId: 't-team', table: t(a.teamDist) })}
          ${chartCard('c-dims', 'Average score by validation dimension', 'Cohort mean, 0–100', { tall: true, tableId: 't-dims', table: simpleTable(['Dimension', 'Cohort average'], a.dimensionAverages.map(d => [d.label, d.value])) })}
        </div>
      </div>
    </section>`;
  }

  function challengeSection(a) {
    const hasData = a.challengeCounts.length > 0;
    return `
    <section class="section" id="sec-challenges">
      <div class="wrap">
        ${head('Challenge Analytics', 'What Founders Say Is Blocking Them', 'Aggregated from every founder submission in the room.')}
        ${hasData
          ? `<div class="grid" style="grid-template-columns:minmax(0,1fr)">
               ${chartCard('c-challenges', 'Top challenges', `${a.challengeCounts.reduce((n, c) => n + c.value, 0)} selections across ${a.total} participants`, {
                 tall: true, tableId: 't-challenges',
                 table: simpleTable(['Challenge', 'Founders'], a.challengeCounts.map(c => [c.label, c.value]))
               })}
             </div>`
          : emptyState('No challenges submitted yet', 'As founders complete Section 7 of their journey, their selected challenge areas appear here in aggregate. Use the Refresh button after they submit.')}
      </div>
    </section>`;
  }

  function assumptionSection(a) {
    const t = a.assumptionTotals;
    const rows = [
      ['Validated', t.validated, CHART.status.good, '🟢'],
      ['Partially validated', t.partial, CHART.status.warning, '🟡'],
      ['Not validated', t.not, CHART.status.critical, '🔴']
    ];
    return `
    <section class="section" id="sec-assumptions">
      <div class="wrap">
        ${head('Assumption Analytics', 'How Much Is Still Untested', `Across ${t.total} tracked assumptions in the cohort.`)}
        <div class="grid grid-3">
          ${rows.map(([label, value, color, dot]) => `
            <div class="stat reveal">
              <div class="stat-label"><span aria-hidden="true">${dot}</span> ${esc(label)}</div>
              <div class="stat-value" style="color:${color}">
                <span data-count="${pct(value, t.total)}" data-suffix="%">0</span>
              </div>
              <div class="stat-note">${value} of ${t.total} assumptions</div>
            </div>`).join('')}
        </div>
        <div class="chart-card reveal" style="margin-top:1rem">
          <div class="chart-title">Assumption status across the cohort</div>
          <div class="chart-sub">Every assumption from every startup, by current status</div>
          <div style="display:flex;height:34px;border-radius:8px;overflow:hidden;gap:2px;margin-top:1rem">
            ${rows.filter(r => r[1] > 0).map(([label, value, color]) => `
              <div style="width:${pct(value, t.total)}%;background:${color};display:grid;place-items:center;
                          font-size:.78rem;font-weight:660;color:#fff"
                   title="${esc(label)}: ${value}">
                ${pct(value, t.total) >= 8 ? pct(value, t.total) + '%' : ''}
              </div>`).join('')}
          </div>
          <div class="chart-legend">
            ${rows.map(([label, , color]) => `<span class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${esc(label)}</span>`).join('')}
          </div>
        </div>
      </div>
    </section>`;
  }

  function heatmapSection(a) {
    const dims = a.dimensionAverages;
    const cols = a.participants.length;

    const header = `
      <div class="heat-row" style="--cols:${cols}">
        <div class="heat-label"></div>
        ${a.participants.map(p => `<div class="heat-head">${p.index}</div>`).join('')}
      </div>`;

    const rows = dims.map(d => `
      <div class="heat-row" style="--cols:${cols}">
        <div class="heat-label">${esc(d.label)}</div>
        ${a.participants.map(p => {
          const v = p.scores[d.key] ?? 0;
          // Ink flips on the light half of the ramp — white on a pale cell is unreadable.
          return `<div class="heat-cell" style="background:${heatColor(v)};color:${v >= 50 ? '#fff' : '#0b0b0b'}"
                       title="${esc(d.label)} · Participant ${p.index}: ${v}">${v}</div>`;
        }).join('')}
      </div>`).join('');

    return `
    <section class="section" id="sec-heatmap">
      <div class="wrap">
        ${head('Workshop Heatmap', 'Where Founders Struggle Most', 'Each column is one anonymous participant. Darker means stronger validation — the pale bands are where the room needs help.')}
        <div class="chart-card reveal">
          <div class="scroll-x">
            <div class="heatmap">${header}${rows}</div>
          </div>
          <div class="chart-legend" style="align-items:center">
            <span class="legend-item">Weak</span>
            ${CHART.seq.map(c => `<span class="legend-swatch" style="background:${c};width:26px;height:11px;border-radius:2px"></span>`).join('')}
            <span class="legend-item">Strong</span>
          </div>
        </div>
      </div>
    </section>`;
  }

  /* Sequential blue ramp — one hue, light to dark, mapped to score. */
  function heatColor(v) {
    if (v >= 80) return CHART.seq[5];
    if (v >= 65) return CHART.seq[4];
    if (v >= 50) return CHART.seq[3];
    if (v >= 35) return CHART.seq[2];
    if (v >= 20) return CHART.seq[1];
    return CHART.seq[0];
  }

  function insightsSection(insights) {
    return `
    <section class="section" id="sec-insights">
      <div class="wrap">
        ${head('Mentor AI Insights', 'What the Data Is Telling You', 'Generated from cohort patterns. Each insight fired because the underlying condition is actually present.')}
        <div class="grid grid-2">
          ${insights.map((ins, i) => `
            <div class="insight reveal" data-delay="${i * 60}">
              <span class="insight-icon" aria-hidden="true">${ins.icon}</span>
              <div>
                <div class="insight-title">${esc(ins.title)}</div>
                <p class="insight-text">${esc(ins.text)}</p>
                <span class="insight-sev sev-${ins.severity}">${ins.severity === 'good' ? 'Strength' : ins.severity === 'critical' ? 'Urgent' : 'Watch'}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </section>`;
  }

  function topicsSection(topics) {
    return `
    <section class="section" id="sec-topics">
      <div class="wrap-narrow">
        ${head('Recommended Discussion', 'Top 5 Topics for This Session', 'Ranked by cohort weakness and by what founders themselves said is blocking them.')}
        <div class="stack">
          ${topics.map(t => `
            <div class="q-item reveal">
              <span class="q-num">${t.rank}</span>
              <span class="q-text">${esc(t.topic)}</span>
            </div>`).join('')}
        </div>
      </div>
    </section>`;
  }

  function quotesSection(a) {
    return `
    <section class="section" id="sec-quotes">
      <div class="wrap">
        ${head('Reflection Analytics', 'Anonymous Voices from the Room', 'Drawn at random from founder reflections. Identities are never stored alongside these responses.')}
        <div class="grid grid-2" id="quote-grid">
          ${a.quotes.length
            ? renderQuotes(a.quotes)
            : `<div style="grid-column:1/-1">${emptyState('No reflections submitted yet', 'Anonymous founder quotes appear here once participants complete the reflection and challenge sections of their journey.')}</div>`}
        </div>
        ${a.quotes.length > 4
          ? `<div class="center" style="margin-top:1.2rem">
               <button class="btn btn-ghost no-print" id="shuffle-quotes">Show different quotes</button>
             </div>`
          : ''}
      </div>
    </section>`;
  }

  function renderQuotes(quotes) {
    return shuffle([...quotes]).slice(0, 4).map(q => `
      <div class="quote reveal">
        <p class="quote-text">“${esc(q.text)}”</p>
        <p class="quote-attr">Anonymous founder · ${esc(q.source)}</p>
      </div>`).join('');
  }

  function wireQuotes(a) {
    const btn = $('#shuffle-quotes');
    if (!btn) return;
    btn.addEventListener('click', () => {
      $('#quote-grid').innerHTML = renderQuotes(a.quotes);
      observeReveals($('#quote-grid'));
    });
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function wordcloudSection(a) {
    if (!a.words.length) {
      return `
      <section class="section" id="sec-words">
        <div class="wrap">
          ${head('Word Cloud', 'The Language of the Room', 'Built live from every challenge description and reflection answer.')}
          ${emptyState('Nothing to show yet', 'The word cloud builds itself from what founders write in their own words. It will populate as responses come in.')}
        </div>
      </section>`;
    }

    const max = a.words[0].count;
    const min = a.words[a.words.length - 1].count;
    const range = Math.max(max - min, 1);

    return `
    <section class="section" id="sec-words">
      <div class="wrap">
        ${head('Word Cloud', 'The Language of the Room', 'Built live from every challenge description and reflection answer. Size and weight follow frequency.')}
        <div class="chart-card reveal">
          <div class="wordcloud">
            ${a.words.map(w => {
              const t = (w.count - min) / range;
              const size = 0.92 + t * 1.75;
              const opacity = 0.5 + t * 0.5;
              const color = t > 0.66 ? CHART.series[0] : t > 0.33 ? CHART.ink2 : CHART.muted;
              return `<span class="word" style="font-size:${size.toFixed(2)}rem;color:${color};opacity:${opacity.toFixed(2)}"
                            title="${esc(w.text)}: ${w.count} mentions">${esc(w.text)}</span>`;
            }).join('')}
          </div>
        </div>
      </div>
    </section>`;
  }

  function emptyState(title, body) {
    return `
      <div class="card card--flat reveal center" style="padding:2.4rem">
        <h3 style="margin-bottom:.6rem">${esc(title)}</h3>
        <p class="muted" style="font-size:.92rem;max-width:52ch;margin:0 auto">${esc(body)}</p>
      </div>`;
  }

  function reportFooter(a) {
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return `
    <section class="section">
      <div class="wrap-narrow">
        <div class="glass reveal" style="padding:2rem;text-align:center">
          <div class="section-eyebrow" style="justify-content:center">Workshop Report</div>
          <h2 style="margin-bottom:.7rem">Film Business Accelerator</h2>
          <p class="muted" style="margin-bottom:1.6rem">
            Validation Workshop Report · ${esc(now)} · ${a.total} participants ·
            No startup names, no founder names.
          </p>
          <button class="btn btn-primary btn-lg no-print" onclick="window.print()">
            <span aria-hidden="true">🖨</span> Generate PDF Report
          </button>
          <p class="muted no-print" style="font-size:.83rem;margin-top:1rem">
            Prints the full dashboard — charts, insights, anonymous quotes and recommendations.
          </p>
        </div>
      </div>
    </section>`;
  }

  /* ---------------------------- Charts ---------------------------- */

  function buildCharts(a, animate = true) {
    Object.values(state.charts).forEach(c => c && c.destroy());
    state.charts = {};
    // Same reasoning as the counters: replaying every bar growth on each
    // incoming response would make the dashboard restless rather than live.
    const anim = animate ? undefined : false;

    const countAxis = (max) => ({
      beginAtZero: true,
      suggestedMax: Math.max(max + 1, 3),
      ticks: { color: CHART.muted, precision: 0, stepSize: 1 },
      grid: { color: CHART.grid, drawBorder: false },
      border: { display: false }
    });
    const catAxis = {
      grid: { display: false, drawBorder: false },
      border: { color: CHART.axis },
      ticks: { color: CHART.ink2, font: { size: 11 }, autoSkip: false, maxRotation: 40, minRotation: 0 }
    };

    const bar = (id, data, { horizontal = false, colors = null, label = 'Startups' } = {}) => {
      const canvas = document.getElementById(id);
      if (!canvas || !data.length) return;
      const max = Math.max(...data.map(d => d.value));
      state.charts[id] = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: data.map(d => d.label),
          datasets: [{
            label,
            data: data.map(d => d.value),
            backgroundColor: colors || CHART.series[0],
            ...BAR_STYLE
          }]
        },
        options: {
          animation: anim,
          indexAxis: horizontal ? 'y' : 'x',
          scales: horizontal
            ? { x: countAxis(max), y: { ...catAxis, ticks: { ...catAxis.ticks, maxRotation: 0 } } }
            : { x: catAxis, y: countAxis(max) },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = horizontal ? ctx.parsed.x : ctx.parsed.y;
                  return `${v} ${v === 1 ? 'startup' : 'startups'}`;
                }
              }
            }
          }
        }
      });
    };

    bar('c-stage', a.stageDist, { horizontal: true });
    bar('c-score', a.scoreDist);
    bar('c-investor', a.investorDist, { horizontal: true });
    bar('c-risk', a.riskDist, { colors: a.riskDist.map(r => r.color) });
    bar('c-model', a.modelDist, { horizontal: true });
    bar('c-revenue', a.revenueDist, { horizontal: true });
    bar('c-team', a.teamDist);

    // Cohort dimension averages — score scale, not a count scale.
    const dimsCanvas = document.getElementById('c-dims');
    if (dimsCanvas) {
      state.charts['c-dims'] = new Chart(dimsCanvas, {
        type: 'bar',
        data: {
          labels: a.dimensionAverages.map(d => d.label),
          datasets: [{
            label: 'Cohort average',
            data: a.dimensionAverages.map(d => d.value),
            backgroundColor: CHART.series[0],
            ...BAR_STYLE,
            maxBarThickness: 18
          }]
        },
        options: {
          animation: anim,
          indexAxis: 'y',
          scales: {
            x: { beginAtZero: true, max: 100, ticks: { color: CHART.muted, stepSize: 25 }, grid: { color: CHART.grid, drawBorder: false }, border: { display: false } },
            y: { ...catAxis, ticks: { ...catAxis.ticks, maxRotation: 0, font: { size: 11 } } }
          },
          plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.x} / 100 · ${scoreLabel(ctx.parsed.x)}` } } }
        }
      });
    }

    if (a.challengeCounts.length) {
      bar('c-challenges', a.challengeCounts, { horizontal: true, label: 'Founders' });
    }
  }

  function wireTableToggles() {
    $$('.table-toggle').forEach(btn => {
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

  /* ---------------------------- Go ---------------------------- */

  document.addEventListener('DOMContentLoaded', initGate);
})();

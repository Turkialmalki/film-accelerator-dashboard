/* ==========================================================================
   Fuzzy search — Arabic + English, typo tolerant.
   Public API: FVSearch.buildIndex(startups), FVSearch.query(text, limit)
   ========================================================================== */

const FVSearch = (() => {

  /* Words that carry no identifying signal and should never drive a match. */
  const STOPWORDS = new Set([
    'شركة', 'شركه', 'مؤسسة', 'مؤسسه', 'منصة', 'منصه', 'استوديو', 'ستوديو',
    'مجموعة', 'مجموعه', 'ال',
    'company', 'co', 'inc', 'ltd', 'llc', 'studio', 'studios',
    'the', 'a', 'an', 'platform', 'productions', 'production', 'films', 'film', 'labs'
  ]);

  /* Arabic diacritics (harakat), tatweel, and Quranic marks. */
  const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

  /**
   * Collapse the orthographic variation that makes Arabic search hard:
   * hamza forms, alef maqsura, taa marbuta, and Arabic-Indic digits.
   */
  function normalizeArabic(str) {
    return str
      .replace(DIACRITICS, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ئ/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ة/g, 'ه')
      .replace(/گ/g, 'ك')
      .replace(/پ/g, 'ب')
      .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
  }

  function normalize(str) {
    if (!str) return '';
    let s = String(str).toLowerCase().trim();
    s = normalizeArabic(s);
    s = s.replace(/[​-‏‪-‮]/g, '');   // bidi / zero-width marks
    s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');              // punctuation → space
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  /** Normalized form with stopwords stripped — used for the "core name" match. */
  function coreForm(str) {
    const tokens = normalize(str).split(' ').filter(t => t && !STOPWORDS.has(t));
    return tokens.join(' ');
  }

  function tokenize(str) {
    return normalize(str).split(' ').filter(Boolean);
  }

  /* --- Levenshtein with an early-exit ceiling (two-row, O(min(m,n)) space) --- */
  function levenshtein(a, b, ceiling = 4) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > ceiling) return ceiling + 1;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    let curr = new Array(b.length + 1);

    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      let rowMin = curr[0];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > ceiling) return ceiling + 1;   // no path can recover
      [prev, curr] = [curr, prev];
    }
    return prev[b.length];
  }

  /** Typo tolerance scales with word length — short words get almost none. */
  function typoBudget(len) {
    if (len <= 3) return 0;
    if (len <= 5) return 1;
    if (len <= 8) return 2;
    return 3;
  }

  /* ---------------------------- Index ---------------------------- */

  let INDEX = [];

  /**
   * One entry per searchable identity (startup name, founder, team member).
   * Several entries can point at the same startup — that is how every member
   * of a team resolves to the same profile.
   */
  function buildIndex(startups) {
    INDEX = [];

    const push = (label, type, startup, role) => {
      if (!label) return;
      INDEX.push({
        label,
        type,                       // 'startup' | 'founder' | 'member'
        role: role || '',
        startupId: startup.id,
        startup,
        norm: normalize(label),
        core: coreForm(label),
        tokens: tokenize(label)
      });
    };

    startups.forEach(s => {
      push(s.startup_name_en, 'startup', s);
      push(s.startup_name_ar, 'startup', s);
      (s.founders || []).forEach(f => {
        push(f.name_en, 'founder', s, f.role);
        push(f.name_ar, 'founder', s, f.role);
      });
      (s.team_members || []).forEach(m => {
        push(m.name_en, 'member', s, m.role);
        push(m.name_ar, 'member', s, m.role);
      });
    });

    return INDEX;
  }

  /* ---------------------------- Scoring ---------------------------- */

  /**
   * Returns 0–100. Tiers are deliberately wide apart so a weak fuzzy hit can
   * never outrank a genuine prefix match.
   */
  function scoreEntry(entry, qNorm, qCore, qTokens) {
    if (!qNorm) return 0;

    // Tier 1 — exact
    if (entry.norm === qNorm) return 100;
    if (entry.core && entry.core === qCore) return 98;

    // Tier 2 — prefix
    if (entry.norm.startsWith(qNorm)) return 92;
    if (entry.core && entry.core.startsWith(qCore)) return 90;

    // Tier 3 — substring
    if (entry.norm.includes(qNorm)) return 80;
    if (entry.core && qCore && entry.core.includes(qCore)) return 78;

    // Tier 4 — every query token matches some entry token (order-free)
    const tokenScores = qTokens.map(qt => {
      let best = 0;
      for (const et of entry.tokens) {
        if (et === qt) { best = Math.max(best, 100); continue; }
        if (et.startsWith(qt)) {
          // Partial words are a first-class case: "Spec" → "Specter"
          best = Math.max(best, 84 + Math.round((qt.length / et.length) * 8));
          continue;
        }
        if (et.includes(qt) && qt.length >= 3) { best = Math.max(best, 72); continue; }

        const budget = typoBudget(Math.max(qt.length, et.length));
        if (budget > 0) {
          const d = levenshtein(qt, et, budget);
          if (d <= budget) best = Math.max(best, 70 - d * 11);
        }
      }
      return best;
    });

    if (tokenScores.length && tokenScores.every(s => s > 0)) {
      // The per-token scores already encode match quality; the cap keeps this
      // tier below a genuine substring hit without penalising fuzzy twice.
      const avg = tokenScores.reduce((a, b) => a + b, 0) / tokenScores.length;
      return Math.min(76, avg);
    }

    // Tier 5 — whole-string fuzzy, last resort
    const budget = typoBudget(qNorm.length);
    if (budget > 0) {
      const d = levenshtein(qNorm, entry.norm, budget);
      if (d <= budget) return Math.max(30, 58 - d * 10);
    }

    // Partial credit when at least one meaningful token matched
    const hits = tokenScores.filter(s => s > 0).length;
    if (hits > 0 && qTokens.length > 1) {
      return Math.min(48, (hits / qTokens.length) * 46);
    }

    return 0;
  }

  const MIN_SCORE = 34;

  /**
   * Query the index. Results are de-duplicated per startup, keeping the
   * best-scoring identity so a startup never appears twice.
   */
  function query(text, limit = 6) {
    const qNorm = normalize(text);
    if (qNorm.length < 1) return [];

    const qCore = coreForm(text) || qNorm;
    const qTokens = tokenize(text).filter(t => !STOPWORDS.has(t));
    const tokensForScoring = qTokens.length ? qTokens : tokenize(text);

    const scored = [];
    for (const entry of INDEX) {
      const score = scoreEntry(entry, qNorm, qCore, tokensForScoring);
      if (score >= MIN_SCORE) scored.push({ ...entry, score });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.type !== b.type) return a.type === 'startup' ? -1 : 1;  // prefer the startup label
      return a.label.length - b.label.length;
    });

    const seen = new Set();
    const out = [];
    for (const r of scored) {
      if (seen.has(r.startupId)) continue;
      seen.add(r.startupId);
      out.push(r);
      if (out.length >= limit) break;
    }
    return out;
  }

  return { buildIndex, query, normalize, coreForm, levenshtein, get index() { return INDEX; } };
})();

window.FVSearch = FVSearch;

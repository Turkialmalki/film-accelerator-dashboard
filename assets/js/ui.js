/* ==========================================================================
   Shared UI utilities — DOM helpers, animation, chart theming.
   ========================================================================== */

const FVUI = (() => {

  /* ---------------------------- DOM ---------------------------- */

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** All interpolated data passes through here — the JSON is treated as untrusted. */
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  /* ---------------------------- Motion ---------------------------- */

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function countUp(node, target, { duration = 1100, suffix = '', decimals = 0 } = {}) {
    if (reducedMotion) { node.textContent = target.toFixed(decimals) + suffix; return; }
    const start = performance.now();
    const from = 0;
    function frame(now) {
      // Clamped both ends: a clock discontinuity must never render a negative count.
      const p = Math.max(0, Math.min((now - start) / duration, 1));
      const eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
      node.textContent = (from + (target - from) * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /** Reveal-on-scroll. Elements stay visible once shown. */
  function observeReveals(root = document) {
    const targets = $$('.reveal:not(.in)', root);
    if (reducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(t => t.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('in'), delay);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(t => io.observe(t));
  }

  function scrollProgress(railFill) {
    if (!railFill) return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      railFill.style.width = pct + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------------------------- Scores ---------------------------- */

  /* Score bands use the status palette, always paired with the number itself
     so the colour never carries the meaning alone. */
  function scoreColor(score) {
    if (score >= 70) return 'var(--good)';
    if (score >= 50) return 'var(--warning)';
    if (score >= 30) return 'var(--serious)';
    return 'var(--critical)';
  }

  function scoreLabel(score) {
    if (score >= 70) return 'Strong';
    if (score >= 50) return 'Developing';
    if (score >= 30) return 'Weak';
    return 'Critical';
  }

  function average(nums) {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  function overallScore(scores) {
    return Math.round(average(Object.values(scores || {})));
  }

  /** SVG ring meter. Returns the markup; call animateRing after insertion. */
  function ringMeter(value, label, size = 168) {
    const r = (size / 2) - 10;
    const circumference = 2 * Math.PI * r;
    return `
      <div class="ring-wrap" style="width:${size}px;height:${size}px">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}"></circle>
          <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}"
                  stroke="${scoreColor(value)}"
                  stroke-dasharray="${circumference}"
                  stroke-dashoffset="${circumference}"
                  data-target-offset="${circumference * (1 - value / 100)}"></circle>
        </svg>
        <div class="ring-center">
          <div>
            <div class="ring-value" data-ring-value="${value}">0</div>
            <div class="ring-label">${esc(label)}</div>
          </div>
        </div>
      </div>`;
  }

  function animateRing(root = document) {
    $$('.ring-fill', root).forEach(circle => {
      const target = circle.dataset.targetOffset;
      requestAnimationFrame(() => { circle.style.strokeDashoffset = target; });
    });
    $$('[data-ring-value]', root).forEach(node => {
      countUp(node, Number(node.dataset.ringValue), { duration: 1400 });
    });
  }

  function animateScoreBars(root = document) {
    $$('.score-fill', root).forEach((bar, i) => {
      const w = bar.dataset.width;
      setTimeout(() => { bar.style.width = w + '%'; }, reducedMotion ? 0 : i * 70);
    });
  }

  /* ---------------------------- Charts ---------------------------- */

  const CHART = {
    surface: '#1a1a19',
    ink1: '#ffffff',
    ink2: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    series: ['#3987e5', '#d95926', '#199e70'],
    status: { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' },
    seq: ['#cde2fb', '#86b6ef', '#3987e5', '#256abf', '#184f95', '#0d366b']
  };

  /** Applied once, globally — every chart inherits the same recessive chrome. */
  function initChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = CHART.muted;
    Chart.defaults.plugins.legend.display = false;   // legends are rendered in HTML
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(26,26,25,.96)';
    Chart.defaults.plugins.tooltip.titleColor = CHART.ink1;
    Chart.defaults.plugins.tooltip.bodyColor = CHART.ink2;
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,.16)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 11;
    Chart.defaults.plugins.tooltip.cornerRadius = 9;
    Chart.defaults.plugins.tooltip.displayColors = false;
    Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 12.5 };
    Chart.defaults.animation.duration = reducedMotion ? 0 : 900;
    Chart.defaults.animation.easing = 'easeOutQuart';
    Chart.defaults.maintainAspectRatio = false;
  }

  /** Shared cartesian scale config — recessive grid, no vertical gridlines. */
  function scales({ maxY, xTitle, yTitle, horizontal = false } = {}) {
    const value = {
      beginAtZero: true,
      suggestedMax: maxY,
      grid: { color: CHART.grid, drawTicks: false, drawBorder: false },
      border: { display: false },
      ticks: { color: CHART.muted, padding: 8, font: { size: 11 } },
      title: yTitle ? { display: true, text: yTitle, color: CHART.muted, font: { size: 11 } } : undefined
    };
    const category = {
      grid: { display: false, drawBorder: false },
      border: { color: CHART.axis },
      ticks: { color: CHART.ink2, padding: 6, font: { size: 11.5 } },
      title: xTitle ? { display: true, text: xTitle, color: CHART.muted, font: { size: 11 } } : undefined
    };
    return horizontal ? { x: value, y: category } : { x: category, y: value };
  }

  /** Bars: 4px rounded data-end, anchored at the baseline. */
  const BAR_STYLE = { borderRadius: 4, borderSkipped: 'start', maxBarThickness: 46 };

  /* ---------------------------- Formatting ---------------------------- */

  function pct(n, total) {
    if (!total) return 0;
    return Math.round((n / total) * 100);
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  function hasArabic(str) {
    return /[؀-ۿ]/.test(String(str || ''));
  }

  /** Renders a name in its own script direction so Arabic never mirrors badly. */
  function nameSpan(name) {
    const dir = hasArabic(name) ? 'rtl' : 'ltr';
    return `<span dir="${dir}">${esc(name)}</span>`;
  }

  function debounce(fn, wait = 160) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function toast(message) {
    const node = el('div', 'pill pill-accent');
    node.textContent = message;
    Object.assign(node.style, {
      position: 'fixed', bottom: '1.8rem', left: '50%', transform: 'translateX(-50%) translateY(14px)',
      zIndex: '200', opacity: '0', transition: 'opacity .3s var(--ease), transform .3s var(--ease)',
      boxShadow: '0 10px 34px rgba(0,0,0,.5)', background: 'rgba(26,26,25,.97)'
    });
    document.body.appendChild(node);
    requestAnimationFrame(() => {
      node.style.opacity = '1';
      node.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transform = 'translateX(-50%) translateY(14px)';
      setTimeout(() => node.remove(), 320);
    }, 2100);
  }

  return {
    $, $$, esc, el, countUp, observeReveals, scrollProgress,
    scoreColor, scoreLabel, average, overallScore, ringMeter, animateRing, animateScoreBars,
    CHART, initChartDefaults, scales, BAR_STYLE,
    pct, initials, hasArabic, nameSpan, debounce, toast, reducedMotion
  };
})();

window.FVUI = FVUI;

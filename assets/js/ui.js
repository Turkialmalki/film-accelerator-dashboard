/* ==========================================================================
   أدوات مشتركة — Shared UI helpers.

   Deliberately small. The old build carried a chart-theming layer for nine
   Chart.js canvases; none of that survives the redesign, so none of it
   survives here either.
   ========================================================================== */

const FVUI = (() => {

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Every interpolated value passes through here — the JSON is untrusted. */
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ------------------------- الأرقام العربية ------------------------- */

  const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  /**
   * Arabic-Indic numerals everywhere a number is shown to a founder.
   * This is a rendering concern only — stored values stay Western digits.
   */
  function num(value) {
    return String(value).replace(/[0-9]/g, d => AR_DIGITS[+d]);
  }

  /** "٦ دقائق" — Arabic pluralisation is not a suffix, so it is spelled out. */
  function minutes(n) {
    if (n <= 0) return 'أقل من دقيقة';
    if (n === 1) return 'دقيقة واحدة';
    if (n === 2) return 'دقيقتان';
    if (n <= 10) return `${num(n)} دقائق`;
    return `${num(n)} دقيقة`;
  }

  /**
   * "شركتان" / "٣ شركات".
   *
   * The dual is a distinct inflected form, not a number plus a noun, and it
   * changes after a preposition: "شركتان" as a subject but "مع شركتين",
   * "لدى شركتين", "من شركتين". Pass oblique: true at any such position —
   * every other count is invariant, so this is the only case that needs it.
   */
  function companies(n, { oblique = false } = {}) {
    if (n === 0) return 'لا توجد شركات';
    if (n === 1) return 'شركة واحدة';
    if (n === 2) return oblique ? 'شركتين' : 'شركتان';
    if (n <= 10) return `${num(n)} شركات`;
    return `${num(n)} شركة`;
  }

  /** "مرتين" / "٣ مرات" — the dual is a separate word, not a suffixed number. */
  function times(n) {
    if (n === 1) return 'مرة واحدة';
    if (n === 2) return 'مرتين';
    if (n <= 10) return `${num(n)} مرات`;
    return `${num(n)} مرة`;
  }

  /* ------------------------------ Motion ------------------------------ */

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function countUp(node, target, { duration = 1300, suffix = '' } = {}) {
    if (!node) return;
    if (reducedMotion) { node.textContent = num(target) + suffix; return; }
    const start = performance.now();
    function frame(now) {
      const p = Math.max(0, Math.min((now - start) / duration, 1));
      const eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
      node.textContent = num(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function debounce(fn, wait = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  /* ------------------------------ Toast ------------------------------ */

  let toastNode = null;
  let toastTimer = null;

  function toast(message) {
    if (!toastNode) {
      toastNode = document.createElement('div');
      toastNode.className = 'toast';
      toastNode.setAttribute('role', 'status');
      document.body.appendChild(toastNode);
    }
    toastNode.textContent = message;
    requestAnimationFrame(() => toastNode.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove('show'), 2400);
  }

  /* ------------------------------ Text ------------------------------ */

  function hasArabic(str) { return /[؀-ۿ]/.test(String(str || '')); }

  /** Keeps a Latin name from mirroring badly inside an RTL paragraph. */
  function nameSpan(name) {
    return `<span dir="${hasArabic(name) ? 'rtl' : 'ltr'}">${esc(name)}</span>`;
  }

  return { $, $$, esc, num, minutes, companies, times, countUp, debounce, toast,
           hasArabic, nameSpan, reducedMotion };
})();

window.FVUI = FVUI;

import { chromium } from 'playwright';

// Override with E2E_BASE_URL when 4319 is already taken — otherwise the script
// happily runs against whatever unrelated server holds the port and reports
// passes that mean nothing.
const BASE = process.env.E2E_BASE_URL || 'http://localhost:4319';
const results = [];
let browser;

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function newPage(context) {
  const page = await context.newPage();
  page.errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') page.errors.push(msg.text());
  });
  page.on('pageerror', (err) => page.errors.push(String(err)));
  return page;
}

async function signIn(page, which) {
  await page.goto(`${BASE}/ar/sign-in`, { waitUntil: 'networkidle' });
  const label = which === 'admin' ? 'الدخول كمشرف' : 'الدخول كمشارك';
  await page.getByRole('button', { name: label }).click();
  await page.waitForURL(/\/(dashboard|overview)/, { timeout: 15000 });
}

try {
  browser = await chromium.launch();

  /* ------------------------------------------------ 1. page loads (admin) */
  const ctx = await browser.newContext();
  const page = await newPage(ctx);

  await signIn(page, 'admin');
  record('demo admin sign-in', page.url().includes('/dashboard'), page.url());

  const adminRoutes = ['/dashboard', '/teams', '/forms', '/results', '/appearance', '/settings'];
  for (const route of adminRoutes) {
    page.errors.length = 0;
    const res = await page.goto(`${BASE}/ar${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const status = res.status();
    const errs = page.errors.filter((e) => !e.includes('favicon'));
    record(`GET /ar${route}`, status === 200 && errs.length === 0, `status ${status}${errs.length ? ` console: ${errs.join(' | ')}` : ''}`);
  }

  /* ------------------------------------------------------ 2. RTL vs LTR */
  await page.goto(`${BASE}/ar/dashboard`, { waitUntil: 'networkidle' });
  const arDir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
  const arLang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
  record('Arabic route is RTL', arDir === 'rtl' && arLang === 'ar', `dir=${arDir} lang=${arLang}`);

  await page.goto(`${BASE}/en/dashboard`, { waitUntil: 'networkidle' });
  const enDir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
  const enLang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
  record('English route is LTR', enDir === 'ltr' && enLang === 'en', `dir=${enDir} lang=${enLang}`);

  // sidebar side-swap
  await page.goto(`${BASE}/ar/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const arSidebarX = await page.evaluate(() => {
    const el = document.querySelector('aside');
    return el ? el.getBoundingClientRect().left : -1;
  });
  await page.goto(`${BASE}/en/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const enSidebarX = await page.evaluate(() => {
    const el = document.querySelector('aside');
    return el ? el.getBoundingClientRect().left : -1;
  });
  record('sidebar swaps sides with direction', arSidebarX > enSidebarX, `ar left=${arSidebarX} en left=${enSidebarX}`);

  /* ---------------------------------------------- 3. KPI values are real */
  await page.goto(`${BASE}/ar/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  const kpiText = await page.locator('article').first().innerText();
  record('dashboard KPI shows 20 teams', /20/.test(kpiText), kpiText.replace(/\n/g, ' '));

  const teamCount = await (async () => {
    await page.goto(`${BASE}/ar/teams`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    return page.locator('article').count();
  })();
  record('teams page lists 20 real teams', teamCount === 20, `${teamCount} cards`);

  /* ------------------------------- 4. create + publish Workshop Evaluation */
  await page.goto(`${BASE}/ar/forms`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'استمارة جديدة' }).click();
  await page.getByRole('button', { name: /تقييم ورشة عمل/ }).click();
  await page.waitForURL(/\/forms\/form_/, { timeout: 15000 });
  const builderUrl = page.url();
  const newFormId = builderUrl.split('/forms/')[1];
  record('created form from Workshop Evaluation template', !!newFormId, newFormId);

  await page.waitForTimeout(1200);
  const fieldCount = await page.locator('ul li button[aria-label^="ترتيب"]').count();
  record('template generated real fields', fieldCount >= 10, `${fieldCount} fields on canvas`);

  await page.getByRole('button', { name: 'نشر', exact: true }).click();
  await page.waitForTimeout(2500);
  const publishedBadge = await page.locator('text=منشورة').count();
  record('published the form', publishedBadge > 0, `badge count ${publishedBadge}`);

  // share tab -> QR + link
  await page.getByRole('tab', { name: 'المشاركة' }).click();
  await page.waitForTimeout(2000);
  const shareLink = await page.locator('#shareLink').inputValue();
  const qrPresent = await page.locator('img[alt="رمز QR"]').count();
  record('share link + QR generated', shareLink.includes('/f/') && qrPresent === 1, shareLink);

  const slug = shareLink.split('/f/')[1];

  /* ------------------------------------- 5. submit as demo participant */
  const pctx = await browser.newContext();
  const ppage = await newPage(pctx);
  await signIn(ppage, 'participant');
  record('demo participant sign-in', ppage.url().includes('/overview'), ppage.url());

  // route guard: participant tries an admin URL
  ppage.errors.length = 0;
  await ppage.goto(`${BASE}/ar/dashboard`, { waitUntil: 'networkidle' });
  await ppage.waitForTimeout(800);
  record(
    'participant blocked from /dashboard',
    !ppage.url().includes('/dashboard'),
    `landed on ${ppage.url()}`,
  );
  await ppage.goto(`${BASE}/ar/teams`, { waitUntil: 'networkidle' });
  await ppage.waitForTimeout(800);
  record('participant blocked from /teams', !ppage.url().includes('/teams'), `landed on ${ppage.url()}`);
  await ppage.goto(`${BASE}/ar/results`, { waitUntil: 'networkidle' });
  await ppage.waitForTimeout(800);
  record('participant blocked from /results', !ppage.url().includes('/results'), `landed on ${ppage.url()}`);

  // NOTE: the demo store is per-browser-context localStorage, so the form the
  // admin just created does not exist in the participant context. Submit
  // through the public share link inside the ADMIN context instead, which is
  // the same data store the results page reads.
  const fillPage = await newPage(ctx);
  await fillPage.goto(`${BASE}/ar/f/${slug}`, { waitUntil: 'networkidle' });
  await fillPage.waitForTimeout(1500);

  // team selector
  await fillPage.locator('select').first().selectOption({ index: 1 });
  // workshop selector
  const selects = await fillPage.locator('select').count();
  if (selects > 1) await fillPage.locator('select').nth(1).selectOption({ index: 1 });
  // rating stars
  const stars = fillPage.locator('[role="radio"][aria-label="4"]');
  if (await stars.count()) await stars.first().click();
  await fillPage.waitForTimeout(400);

  // step through to the end, filling required radios/likert/nps/text as we go
  for (let step = 0; step < 6; step += 1) {
    // any visible radio groups: pick the first option in each unanswered one
    const radios = fillPage.locator('button[role="radio"], [role="radiogroup"] button');
    const radioCount = await radios.count();
    for (let i = 0; i < radioCount; i += 1) {
      const r = radios.nth(i);
      if ((await r.getAttribute('aria-checked')) === 'false') {
        await r.click().catch(() => {});
      }
    }
    const radixRadios = fillPage.locator('[role="radiogroup"] [role="radio"]');
    const rc = await radixRadios.count();
    for (let i = 0; i < rc; i += 1) {
      const r = radixRadios.nth(i);
      if ((await r.getAttribute('data-state')) === 'unchecked') {
        await r.click().catch(() => {});
        break;
      }
    }
    const areas = fillPage.locator('textarea');
    const ac = await areas.count();
    for (let i = 0; i < ac; i += 1) {
      if (!(await areas.nth(i).inputValue())) {
        await areas.nth(i).fill('إجابة اختبار آلي للتحقق من مسار الإرسال.');
      }
    }
    const texts = fillPage.locator('input[type="text"], input:not([type])');
    const tc = await texts.count();
    for (let i = 0; i < tc; i += 1) {
      if (!(await texts.nth(i).inputValue())) await texts.nth(i).fill('اختبار');
    }

    const next = fillPage.getByRole('button', { name: 'التالي', exact: true });
    const submit = fillPage.getByRole('button', { name: 'إرسال', exact: true });
    if (await submit.count()) {
      await submit.click();
      await fillPage.waitForTimeout(1500);
      if (await fillPage.locator('text=وصلتنا إجابتك').count()) break;
    } else if (await next.count()) {
      await next.click();
      await fillPage.waitForTimeout(700);
    } else break;
  }
  const confirmed = await fillPage.locator('text=وصلتنا إجابتك').count();
  record('submitted a response through the public link', confirmed > 0, `confirmation visible: ${confirmed > 0}`);

  /* ------------------------------------- 6. response shows up in results */
  await page.goto(`${BASE}/ar/results/${newFormId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  const resultsText = await page.locator('main').innerText();
  const responseCountMatch = resultsText.match(/عدد الإجابات[\s\S]{0,40}?(\d+)/);
  const countShown = responseCountMatch ? Number(responseCountMatch[1]) : null;
  record(
    'new response counted in Submission Results',
    countShown !== null && countShown >= 1,
    `response count read as ${countShown}`,
  );

  /* --------------------------------------- 7. theme persists after refresh */
  await page.goto(`${BASE}/ar/appearance`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /عرض منتصف الليل/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'نشر السمة' }).click();
  await page.waitForTimeout(1500);
  const beforeReload = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim(),
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  const afterReload = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim(),
  );
  const stored = await page.evaluate(() => {
    const raw = window.localStorage.getItem('fba.demo.store.v1');
    return raw ? JSON.parse(raw).theme.preset : null;
  });
  record(
    'theme preset published and survives refresh',
    afterReload === beforeReload && stored === 'midnight_screening',
    `accent before=${beforeReload} after=${afterReload} stored preset=${stored}`,
  );

  /* --------------------------------------------- 8. public + auth pages */
  const anon = await browser.newContext();
  const apage = await newPage(anon);
  for (const route of ['/ar/sign-in', '/en/sign-in', '/ar/sign-up', '/ar/forgot-password', '/ar/reset-password', '/ar/invite']) {
    apage.errors.length = 0;
    const res = await apage.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await apage.waitForTimeout(500);
    const errs = apage.errors.filter((e) => !e.includes('favicon'));
    record(`GET ${route} (anonymous)`, res.status() === 200 && errs.length === 0, `status ${res.status()}${errs.length ? ` console: ${errs.join(' | ')}` : ''}`);
  }

  // anonymous hitting an admin route must be bounced to sign-in
  await apage.goto(`${BASE}/ar/dashboard`, { waitUntil: 'networkidle' });
  record('anonymous redirected to sign-in', apage.url().includes('/sign-in'), apage.url());

  // root redirects to a locale, and the locale root lands on sign-in
  const rootRes = await apage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  record(
    'root redirects into a locale and onto sign-in',
    rootRes.status() === 200 && apage.url().includes('/sign-in'),
    `${apage.url()} status ${rootRes.status()}`,
  );

  /* ------------------------------------------- 9. auth + invite surface */
  // The forced password-change screen is a protected route, not an auth
  // route: anonymous must be bounced, not shown it.
  await apage.goto(`${BASE}/ar/change-password`, { waitUntil: 'networkidle' });
  record(
    'anonymous redirected away from /change-password',
    apage.url().includes('/sign-in'),
    apage.url(),
  );

  // The invite route must refuse a caller with no session at all.
  const anonInvite = await anon.request.post(`${BASE}/api/admin/invite`, {
    data: { email: 'nobody@example.com', role: 'participant' },
    failOnStatusCode: false,
  });
  record(
    'POST /api/admin/invite rejects an anonymous caller',
    anonInvite.status() === 401,
    `status ${anonInvite.status()}`,
  );

  // A participant is signed in but may not invite.
  const participantInvite = await pctx.request.post(`${BASE}/api/admin/invite`, {
    data: { email: 'nobody@example.com', role: 'participant' },
    failOnStatusCode: false,
  });
  record(
    'POST /api/admin/invite rejects a participant',
    participantInvite.status() === 403,
    `status ${participantInvite.status()}`,
  );

  // And in demo mode an admin gets the simulated response: nothing is created
  // server-side and no email is sent.
  const adminInvite = await ctx.request.post(`${BASE}/api/admin/invite`, {
    data: { email: 'invited@example.com', role: 'participant', locale: 'ar' },
    failOnStatusCode: false,
  });
  const adminInviteBody = adminInvite.ok() ? await adminInvite.json() : {};
  record(
    'POST /api/admin/invite returns demo mode for an admin',
    adminInvite.status() === 200 && adminInviteBody.mode === 'demo' && adminInviteBody.simulated === true,
    `status ${adminInvite.status()} mode=${adminInviteBody.mode}`,
  );

  /* ------------------------------- 10. every sidebar item actually works */
  // Clicking, not URL-typing: a nav item can be present and still be a dead
  // link. Each click must land on its route and render without a console error.
  const NAV = {
    admin: [
      ['لوحة المؤشرات', '/dashboard'],
      ['الفرق المشاركة', '/teams'],
      ['الاستمارات', '/forms'],
      ['نتائج الاستمارات', '/results'],
      ['المظهر', '/appearance'],
      ['إعدادات البرنامج', '/settings'],
      ['المساعدة', '/help'],
      ['الملف الشخصي', '/profile'],
    ],
    participant: [
      ['نظرة عامة', '/overview'],
      ['فريقي', '/my-team'],
      ['الاستمارات المسندة', '/assigned-forms'],
      ['إجاباتي', '/my-submissions'],
      ['المساعدة', '/help'],
      ['الملف الشخصي', '/profile'],
    ],
  };

  for (const [role, items] of Object.entries(NAV)) {
    const navCtx = await browser.newContext();
    const navPage = await newPage(navCtx);
    await signIn(navPage, role);

    for (const [label, route] of items) {
      navPage.errors.length = 0;
      const link = navPage.getByRole('navigation').getByRole('link', { name: label, exact: true });
      if ((await link.count()) === 0) {
        record(`${role} nav → ${route}`, false, 'nav item not rendered');
        continue;
      }
      await link.first().click();
      // Wait for the URL, not a fixed delay: under `next dev` the first click
      // into a route pays for its compile, which can take several seconds and
      // would otherwise read as a dead link.
      await navPage.waitForURL((url) => url.pathname.includes(route), { timeout: 30000 }).catch(() => {});
      await navPage.waitForTimeout(900);
      const landed = navPage.url().includes(route);
      const current = await link.first().getAttribute('aria-current');
      // _rsc prefetches are aborted by design on client-side navigation.
      const errs = navPage.errors.filter((e) => !e.includes('favicon') && !e.includes('_rsc'));
      const body = await navPage.locator('main').innerText().catch(() => '');
      record(
        `${role} nav → ${route}`,
        landed && errs.length === 0 && current === 'page' && body.trim().length > 0,
        `url=${navPage.url().replace(BASE, '')} aria-current=${current}${errs.length ? ` console: ${errs.join(' | ')}` : ''}`,
      );
    }

    navPage.errors.length = 0;
    await navPage.getByRole('button', { name: 'تسجيل الخروج' }).first().click();
    await navPage.waitForTimeout(2500);
    record(`${role} sign-out returns to sign-in`, navPage.url().includes('/sign-in'), navPage.url());
    await navCtx.close();
  }

  /* --------------------- 11. charts: a11y summary + honest empty states */
  const chartCtx = await browser.newContext();
  const chartPage = await newPage(chartCtx);
  await signIn(chartPage, 'admin');
  await chartPage.goto(`${BASE}/ar/dashboard`, { waitUntil: 'networkidle' });
  await chartPage.waitForTimeout(1800);

  const a11y = await chartPage.evaluate(() => ({
    tables: document.querySelectorAll('table.sr-only').length,
    hidden: document.querySelectorAll('.chart-ltr[aria-hidden="true"]').length,
    sectors: document.querySelectorAll('.recharts-sector').length,
    bars: document.querySelectorAll('.recharts-bar-rectangle').length,
    areas: document.querySelectorAll('.recharts-area-area').length,
  }));
  record(
    'each dashboard chart exposes its numbers as a screen-reader table',
    a11y.tables === 3 && a11y.hidden === 3,
    JSON.stringify(a11y),
  );
  record(
    'all three chart series are drawn',
    a11y.sectors > 0 && a11y.bars > 0 && a11y.areas > 0,
    JSON.stringify(a11y),
  );

  // Zero submissions is the real production state. The charts must say so
  // rather than draw an invented series.
  await chartPage.evaluate(() => {
    const store = JSON.parse(window.localStorage.getItem('fba.demo.store.v1'));
    store.submissions = [];
    store.answers = [];
    store.teams = [];
    window.localStorage.setItem('fba.demo.store.v1', JSON.stringify(store));
  });
  chartPage.errors.length = 0;
  await chartPage.goto(`${BASE}/en/dashboard`, { waitUntil: 'networkidle' });
  await chartPage.waitForTimeout(1800);
  const empty = await chartPage.evaluate(() => ({
    text: document.querySelector('main').innerText,
    series:
      document.querySelectorAll('.recharts-sector').length +
      document.querySelectorAll('.recharts-bar-rectangle').length +
      document.querySelectorAll('.recharts-area-area').length,
  }));
  const emptyErrs = chartPage.errors.filter((e) => !e.includes('favicon') && !e.includes('_rsc'));
  record(
    'zero data renders real empty states and draws no invented series',
    empty.text.includes('No responses yet') &&
      empty.text.includes('Nothing to plot yet') &&
      empty.text.includes('No active teams yet') &&
      empty.series === 0 &&
      emptyErrs.length === 0,
    `series drawn=${empty.series}${emptyErrs.length ? ` console: ${emptyErrs.join(' | ')}` : ''}`,
  );
  await chartCtx.close();

  /* ----------------------------------- 12. prefers-reduced-motion is real */
  const rmCtx = await browser.newContext({ reducedMotion: 'reduce' });
  const rmPage = await newPage(rmCtx);
  await signIn(rmPage, 'admin');
  await rmPage.goto(`${BASE}/en/dashboard`, { waitUntil: 'networkidle' });
  // Deliberately short: with motion reduced everything must already be final.
  await rmPage.waitForTimeout(500);
  const rm = await rmPage.evaluate(() => ({
    matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    railTransitionMs:
      parseFloat(getComputedStyle(document.querySelector('aside')).transitionDuration) * 1000,
    kpiOpacity: getComputedStyle(document.querySelector('article')).opacity,
    series:
      document.querySelectorAll('.recharts-sector').length +
      document.querySelectorAll('.recharts-bar-rectangle').length,
  }));
  record(
    'prefers-reduced-motion: no transitions, content already final',
    rm.matches && rm.railTransitionMs < 1 && rm.kpiOpacity === '1' && rm.series > 0,
    JSON.stringify(rm),
  );
  await rmCtx.close();
} catch (error) {
  record('verification script completed', false, String(error).slice(0, 400));
} finally {
  if (browser) await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((f) => console.log(` - ${f.name}: ${f.detail}`));
  }
  process.exit(failed.length ? 1 : 0);
}

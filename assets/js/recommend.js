/* ==========================================================================
   التوصيات — personalised findings for step 4 and the final screen.

   Three sentences per founder: نقطة قوة، أكبر مخاطرة، أفضل خطوة تالية.

   Two layers produce them:

   1. The authored baseline in data/startups.json → recommendation_ar. Written
      per company from its real traction and risk data, so no two startups in
      the cohort ever see the same three sentences.

   2. Overrides driven by what the founder just answered in steps 1–3. These
      only fire on an answer that genuinely outranks the baseline — a founder
      who says nobody has paid yet has a more urgent risk than whatever the
      profile knew about them beforehand.

   Rules are ordered by urgency and the first match wins, so a founder is
   never handed two "biggest" risks.
   ========================================================================== */

const FVRecommend = (() => {

  /* Stages where "nobody has paid yet" is expected rather than alarming. The
     advice still changes, but the framing does not treat it as a failure.
     These match the `stage` values in data/startups.json, which come from the
     accelerator report — keep them in step if that vocabulary changes. */
  const EARLY_STAGES = ['Pre-Seed', 'MVP'];

  /* ---------------------------- المخاطر ---------------------------- */

  const RISK_RULES = [
    {
      when: a => a.talked === 'no',
      text: 'لم تتحدث مع عملائك بعد. كل قرار تبنيه اليوم — المنتج، السعر، الرسالة — '
          + 'قائم على تخمين، وأسرع طريقة لاكتشاف خطأ مكلف هي محادثة واحدة صادقة.'
    },
    {
      when: a => a.problem === 'no',
      text: 'المشكلة التي تحلها غير محددة بدقة. بدون تعريف واضح للمشكلة ستبني حلاً '
          + 'يعجب الجميع ولا يحتاجه أحد، ولن تعرف متى نجحت.'
    },
    {
      when: (a, s) => a.paid === 'no' && !EARLY_STAGES.includes(s.stage),
      text: 'لم يدفع أحد مقابل خدمتك حتى الآن، رغم أنك تجاوزت مرحلة الفكرة. '
          + 'الاهتمام ليس طلباً، والدفع هو الإشارة الوحيدة التي لا تكذب.'
    },
    {
      when: a => a.talked === 'partly' && a.paid === 'no',
      text: 'تحدثت مع بعض العملاء ولم يدفع أحد بعد. الفجوة بين «الفكرة تعجبني» '
          + 'و«سأدفع لك اليوم» هي أخطر فجوة في شركتك الآن.'
    }
  ];

  /* ------------------------- الخطوة التالية ------------------------- */

  const NEXT_RULES = [
    {
      when: a => a.talked === 'no',
      text: 'قبل الورشة القادمة: أجرِ خمس محادثات مع عملاء محتملين، ولا تعرض عليهم '
          + 'حلك. اسألهم فقط كيف يحلون هذه المشكلة اليوم وكم يكلفهم ذلك.'
    },
    {
      when: a => a.problem === 'no',
      text: 'اكتب المشكلة في جملة واحدة: «[من] يعاني من [ماذا] لأن [لماذا]». '
          + 'اعرضها على ثلاثة عملاء، وإن لم يتعرفوا عليها فوراً فأعد كتابتها.'
    },
    {
      when: (a, s) => a.paid === 'no' && EARLY_STAGES.includes(s.stage),
      text: 'اطلب الدفع المسبق من ثلاثة عملاء محتملين هذا الأسبوع، حتى قبل أن يكون '
          + 'المنتج جاهزاً. من يدفع مقدماً هو دليلك الوحيد على وجود سوق.'
    },
    {
      when: a => a.paid === 'no',
      text: 'أغلق صفقة واحدة مدفوعة خلال ٣٠ يوماً، مهما كانت صغيرة أو يدوية. '
          + 'أول ريال يدخل يغيّر كل قرار بعده.'
    }
  ];

  /* --------------------- تحديات مختارة في الخطوة ١ --------------------- */

  /* Appended to the next step when the founder's own answer in step 1 points
     somewhere the rules above did not already cover. */
  const AREA_NOTE = {
    customers:  'وركّز جهدك هذا الشهر على العملاء تحديداً — لا على المنتج.',
    marketing:  'وقبل زيادة التسويق، تأكد أن من يصلك اليوم يتحول فعلاً إلى عميل.',
    product:    'وقاوم إضافة أي ميزة جديدة قبل أن تثبت أن الميزة الحالية تُستخدم.',
    pricing:    'واختبر سعراً أعلى على عميل جديد واحد قبل تعميم أي تغيير.',
    investment: 'وتذكّر أن أفضل ما يرفع تقييمك ليس العرض التقديمي، بل رقم إيراد متكرر.',
    team:       'وحدد أضعف حلقة في الفريق اليوم بالاسم، وعالجها قبل التوظيف الجديد.'
  };

  /* ------------------------------ البناء ------------------------------ */

  function firstMatch(rules, answers, startup) {
    const rule = rules.find(r => r.when(answers, startup));
    return rule ? rule.text : null;
  }

  /**
   * The three findings for one startup.
   *
   * @param startup  a row from data/startups.json
   * @param response the founder's draft, as stored by FVStore
   */
  function forStartup(startup, response) {
    const base = startup.recommendation_ar || {};
    const answers = (response && response.assumptions) || {};
    const area = ((response && response.challenge && response.challenge.tags) || [])[0];

    /* Strength is never overridden. It comes from what the company has
       actually achieved, and no answer in this journey can change that — the
       point of showing it first is that the risk lands on someone who has
       just been told they are doing something right. */
    const strength = base.strength
      || 'وصلت بشركتك إلى مرحلة تسمح لك بطرح الأسئلة الصعبة، وهذا في حد ذاته تقدّم.';

    const risk = firstMatch(RISK_RULES, answers, startup)
      || base.risk
      || 'أكبر مخاطرة عليك اليوم هي الاستمرار في البناء دون دليل خارجي يؤكد الاتجاه.';

    let nextStep = firstMatch(NEXT_RULES, answers, startup) || base.next_step;

    /* The area note is additive, and only where a rule fired — the authored
       per-company next step is already specific enough on its own. */
    if (!base.next_step || nextStep !== base.next_step) {
      const note = AREA_NOTE[area];
      if (note) nextStep = `${nextStep} ${note}`;
    }

    return {
      strength,
      risk,
      nextStep: nextStep
        || 'اختر تجربة واحدة يمكنك إنهاؤها خلال أسبوعين، وحدد مسبقاً ما الذي سيثبتها أو ينفيها.'
    };
  }

  /* ==========================================================================
     لوحة النهاية — the closing dashboard for one company.

     Built from the company's record crossed with what it just answered, so no
     two founders see the same page and nobody sees a page that ignores what
     they said five minutes ago.
     ========================================================================== */

  const AREA_LABEL = {
    customers: 'العملاء', marketing: 'التسويق', product: 'المنتج',
    pricing: 'التسعير', investment: 'الاستثمار', team: 'الفريق'
  };

  const UNTESTED_LABEL = {
    willingness: 'استعداد العميل للدفع بالسعر الحالي',
    channel:     'قناة وصول متكررة للعملاء',
    retention:   'بقاء العميل بعد أول تجربة',
    problem:     'أن المشكلة مؤلمة بما يكفي',
    margin:      'أن الهامش يصمد عند التوسع',
    ops:         'قدرة التشغيل على الحمل الأكبر'
  };

  /**
   * The three priorities to leave with.
   *
   * Ordered by what the founder just told us, not by what the file said:
   * anything they marked untested outranks anything merely reported, because
   * an admitted gap is better evidence than an analyst's note.
   */
  function prioritiesFor(startup, response) {
    const a = (response && response.assumptions) || {};
    const r = (response && response.reflections) || {};
    const out = [];

    if (a.talked === 'no') out.push({ w: 100, text: 'ابدأ بخمس محادثات عملاء قبل أي قرار منتج أو تسعير.' });
    if (a.problem === 'no') out.push({ w: 95, text: 'اكتب المشكلة في جملة واحدة يتعرف عليها العميل دون شرح.' });
    if (a.paid === 'no') out.push({ w: 90, text: 'أغلق أول عملية دفع حقيقية، مهما كانت صغيرة أو يدوية.' });

    /* Their own multi-select answer, echoed back as work to do. */
    const untested = Array.isArray(r.untested) ? r.untested : [];
    untested.slice(0, 2).forEach((key, i) => {
      if (UNTESTED_LABEL[key]) out.push({ w: 80 - i, text: `اختبر ${UNTESTED_LABEL[key]} خلال المرحلة القادمة.` });
    });

    /* The challenge they personally ranked first, in their own words. */
    const ranked = Array.isArray(r['rank-challenges']) ? r['rank-challenges'] : [];
    const own = startup.current_challenges || [];
    if (ranked.length) {
      const first = ranked[0];
      const idx = /^own(\d+)$/.exec(first);
      if (idx && own[+idx[1]]) out.push({ w: 75, text: own[+idx[1]] });
      else if (first === 'cash') out.push({ w: 75, text: 'عالج التدفق النقدي قبل أي التزام توسّعي جديد.' });
      else if (first === 'talent') out.push({ w: 75, text: 'أغلق فجوة الكوادر الحرجة قبل زيادة الحمل.' });
    }

    if (Number(r['moat-confidence']) <= 2) {
      out.push({ w: 70, text: 'ميزتك التنافسية هشة بتقديرك — ابنِ ما لا يُقلّد: بيانات، أو تكامل، أو مجتمع.' });
    }
    if (r['model-proof'] === 'untested' || r['model-proof'] === 'testing') {
      out.push({ w: 68, text: 'أثبت نموذج الإيراد بتكرار حقيقي مع أكثر من عميل، لا بحالة واحدة.' });
    }
    if (r['bus-factor'] === 'all' || r['bus-factor'] === 'delivery') {
      out.push({ w: 66, text: 'وثّق عملية التسليم حتى لا تتوقف الشركة بغياب شخص واحد.' });
    }
    if (Number(r.runway) <= 3) {
      out.push({ w: 98, text: 'رصيدك النقدي قصير — عالج التمويل أو الإيراد قبل أي شيء آخر.' });
    }

    /* Fall back to the report's own priorities so the list is never thin. */
    (startup.accelerator_priorities || []).forEach((p, i) => out.push({ w: 40 - i, text: p }));

    const seen = new Set();
    return out.sort((x, y) => y.w - x.w)
      .filter(o => o.text && !seen.has(o.text) && seen.add(o.text))
      .slice(0, 3)
      .map(o => o.text);
  }

  /** Where the founder asked for help, in words. */
  function focusFor(response) {
    const tag = ((response && response.challenge && response.challenge.tags) || [])[0];
    return AREA_LABEL[tag] || null;
  }

  /**
   * The closing dashboard payload.
   * @returns { score, focus, strength, risk, nextStep, priorities, opportunity }
   */
  function dashboardFor(startup, response) {
    const base = forStartup(startup, response);
    return {
      score: window.FVStore ? FVStore.readinessOf(response, startup) : Number(startup.readiness) || 0,
      focus: focusFor(response),
      strength: base.strength,
      risk: base.risk,
      nextStep: base.nextStep,
      priorities: prioritiesFor(startup, response),
      opportunity: startup.growth_roadmap || base.nextStep
    };
  }

  return { forStartup, dashboardFor, prioritiesFor, focusFor };
})();

window.FVRecommend = FVRecommend;

/* ==========================================================================
   محرك الأسئلة — the question engine.

   Questions are built per company, not chosen from a fixed list. The strongest
   personalisation is not a generated sentence but a real one: several
   questions put the company's *own* reported challenges and advantages into
   the options, so the founder is ranking their own file rather than a generic
   menu. That cannot read as a template, because it is their text.

   Inputs: stage, revenue, team size, category, business model, competitive
   advantages, current challenges, accelerator priorities, readiness, founder.

   Storage — the shape the database already expects is preserved exactly:
     assumptions.talked | .paid | .problem   the three validation answers
     challenge.tags[0]                       the support area
     challenge.text                          the open challenge
     commitment                              the closing commitment
     reflections[id]                         everything generated here
   The mentor dashboard reads the first four and is unaffected by any question
   added below.
   ========================================================================== */

const FVQuestions = (() => {

  const EARLY = ['Pre-Seed', 'MVP'];
  const LATE  = ['Seed', 'Pre-A', 'Series A'];

  /* Reported lines are full analyst sentences. Inside an option chip they
     need to be short enough to compare at a glance. */
  function short(text, max = 78) {
    let t = String(text || '').trim().replace(/\.$/, '');
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const at = Math.max(cut.lastIndexOf('،'), cut.lastIndexOf(' '));
    return (at > 34 ? cut.slice(0, at) : cut).trim() + '…';
  }

  /* ------------------------- الأسئلة الثابتة ------------------------- */

  /* These four exist because the mentor dashboard aggregates them across the
     cohort — they are the only answers that must be comparable between
     companies, so they are the only ones phrased identically for everyone. */

  const AREA_OPTIONS = [
    { id: 'customers',  label: 'العملاء' },
    { id: 'marketing',  label: 'التسويق' },
    { id: 'product',    label: 'المنتج' },
    { id: 'pricing',    label: 'التسعير' },
    { id: 'investment', label: 'الاستثمار' },
    { id: 'team',       label: 'الفريق' }
  ];

  function coreQuestions(s) {
    const buyer = s.business_model.includes('B2B') || s.business_model.includes('مؤسسي')
      ? 'الجهات التي تستهدفونها'
      : 'عملائك';

    return [
      {
        id: 'talked', type: 'choice', store: ['assumptions', 'talked'], required: true,
        title: `هل تحدثت مع ${buyer} خلال الشهر الماضي؟`,
        hint: 'محادثة حقيقية، لا استبيان ولا عرض بيع.',
        options: [
          { id: 'yes', label: 'نعم' },
          { id: 'no', label: 'لا' },
          { id: 'partly', label: 'جزئياً' }
        ]
      },
      {
        id: 'paid', type: 'choice', store: ['assumptions', 'paid'], required: true,
        title: 'هل دفع أحد مقابل ما تقدمونه؟',
        hint: 'الدفع الفعلي، لا خطاب نوايا ولا اتفاق مبدئي.',
        options: [{ id: 'yes', label: 'نعم' }, { id: 'no', label: 'لا' }]
      },
      {
        id: 'problem', type: 'choice', store: ['assumptions', 'problem'], required: true,
        title: 'هل تعرف بالضبط المشكلة التي تحلها؟',
        hint: 'بحيث يتعرف عليها العميل فوراً دون شرح منك.',
        options: [{ id: 'yes', label: 'نعم' }, { id: 'no', label: 'لا' }]
      },
      {
        id: 'area', type: 'choice', store: ['challengeTag'], required: true,
        title: 'أين تحتاج أكبر دعم اليوم؟',
        hint: 'اختر المجال الواحد الذي لو تحسّن لتغيّر كل شيء.',
        options: AREA_OPTIONS
      }
    ];
  }

  /* ------------------------- الأسئلة المولّدة ------------------------- */

  /* Each generator returns one question. They are not a pool to be truncated:
     the assembly below fills four named slots, so every founder gets the same
     *shape* of enquiry — one ranking, one scale, one branching choice, one
     multi-select — filled with their own material. Blind truncation of a
     longer list silently dropped whole answer types for everyone. */

  /* Their own challenges, ranked. The single most company-specific question
     available, because every option is a line from their own file. */
  function rankChallenges(s) {
    const own = (s.current_challenges || []).map((c, i) => ({
      id: `own${i}`, label: short(c)
    }));
    if (own.length < 2) return null;
    return {
      id: 'rank-challenges', type: 'rank', required: true,
      title: 'رتّب هذه التحديات حسب أولويتها لديك اليوم',
      hint: 'اضغط عليها بالترتيب — الأهم أولاً.',
      options: own.concat([
        { id: 'cash',   label: 'التدفق النقدي وطول دورة التحصيل' },
        { id: 'talent', label: 'إيجاد الكوادر المناسبة والاحتفاظ بها' }
      ])
    };
  }

  /* Their own advantage, stress-tested. */
  function moatConfidence(s) {
    const adv = (s.competitive_advantages || [])[0];
    if (!adv) return null;
    return {
      id: 'moat-confidence', type: 'scale', required: true,
      title: 'ما مدى ثقتك أن هذه الميزة ستبقى صعبة التقليد بعد سنة؟',
      quote: short(adv, 110),
      hint: 'كن صادقاً — التقدير المتفائل هنا يكلّف كثيراً لاحقاً.',
      labels: ['يمكن تقليدها بسهولة', 'يصعب تقليدها']
    };
  }

  /* Slot three branches on what is actually most at risk for this company:
     cash for the earliest, key-person concentration for the smallest teams,
     and proof of the revenue model for everyone else. */
  function runway() {
    return {
      id: 'runway', type: 'slider', required: true,
      title: 'كم شهراً يمكن أن تستمر الشركة بمواردها الحالية؟',
      hint: 'تقدير تقريبي يكفي.',
      min: 0, max: 24, step: 1, value: 6,
      unit: (n) => (n >= 24 ? 'أكثر من ٢٤ شهراً'
                  : n === 0 ? 'أقل من شهر'
                  : n === 1 ? 'شهر واحد'
                  : n === 2 ? 'شهران'
                  : n <= 10 ? `${n} أشهر` : `${n} شهراً`)
    };
  }

  function busFactor(s) {
    return {
      id: 'bus-factor', type: 'choice', required: true,
      title: `فريقكم ${s.team_size_label}. ما الذي يتوقف بالكامل لو غاب شخص واحد أسبوعين؟`,
      options: [
        { id: 'nothing',  label: 'لا شيء — العمل موثّق ومتوزّع' },
        { id: 'slows',    label: 'يبطؤ لكنه يستمر' },
        { id: 'delivery', label: 'التسليم للعملاء يتوقف' },
        { id: 'all',      label: 'كل شيء تقريباً' }
      ]
    };
  }

  function modelProof(s) {
    return {
      id: 'model-proof', type: 'choice', required: true,
      title: `نموذج إيرادكم قائم على «${s.business_model}». ما مدى إثباته حتى الآن؟`,
      hint: 'الإثبات يعني تكراراً، لا حالة واحدة ناجحة.',
      options: [
        { id: 'repeat',   label: 'مُثبت ويتكرر مع أكثر من عميل' },
        { id: 'once',     label: 'نجح مرة أو مرتين فقط' },
        { id: 'testing',  label: 'قيد الاختبار الآن' },
        { id: 'untested', label: 'لم يُختبر بعد' }
      ]
    };
  }

  /* What has never been tested. Multi-select, because the honest answer is
     usually more than one thing, and the options bend to the stage. */
  function untested(s) {
    const early = EARLY.includes(s.stage);
    return {
      id: 'untested', type: 'multi', required: true,
      title: 'ما الذي لم تختبروه فعلياً حتى الآن؟',
      hint: 'اختر كل ما ينطبق.',
      options: [
        { id: 'willingness', label: 'استعداد العميل للدفع بالسعر الحالي' },
        { id: 'channel',     label: 'قناة وصول متكررة للعملاء' },
        { id: 'retention',   label: 'بقاء العميل بعد أول تجربة' },
        early
          ? { id: 'problem', label: 'أن المشكلة مؤلمة بما يكفي' }
          : { id: 'margin',  label: 'أن الهامش يصمد عند التوسع' },
        { id: 'ops',         label: 'قدرة التشغيل على الحمل الأكبر' }
      ]
    };
  }


  /* ---- Slot five: drawn from what this company is actually building ----
     Keyed on business model rather than a generic bucket, so a TVOD platform
     is asked about paying behaviour and a licensing business about renewals.
     This is the slot that stops two companies at the same stage from meeting
     the same interview. */
  const MODEL_QUESTIONS = [
    {
      match: (s) => s.business_model.includes('TVOD') || s.business_model.includes('بيع مباشر'),
      build: () => ({
        id: 'tvod-friction', type: 'cards', required: true,
        title: 'ما أكبر سبب يمنع المشاهد من الدفع اليوم؟',
        hint: 'اختر السبب الأقرب لواقعكم.',
        options: [
          { id: 'free',    label: 'توفر بدائل مجانية',        note: 'المنافسة ليست منصة أخرى، بل المجان' },
          { id: 'habit',   label: 'اعتياد السوق على الاشتراك', note: 'الدفع لكل مشاهدة سلوك غير مألوف' },
          { id: 'value',   label: 'القيمة غير واضحة قبل المشاهدة', note: 'لا يعرف ما الذي يشتريه' },
          { id: 'friction',label: 'احتكاك في تجربة الدفع',     note: 'خطوات كثيرة أو قيود مزعجة' }
        ]
      })
    },
    {
      match: (s) => s.business_model.includes('ترخيص'),
      build: () => ({
        id: 'licensing-repeat', type: 'choice', required: true,
        title: 'هل تحوّل الاهتمام لديكم إلى ترخيص متكرر أم يبقى صفقات مفردة؟',
        hint: 'التكرار هو ما يفصل الترخيص عن العمل بالمشروع.',
        options: [
          { id: 'renewing', label: 'تراخيص تتجدد فعلاً' },
          { id: 'some',     label: 'بعضها يتجدد' },
          { id: 'oneoff',   label: 'صفقات مفردة في الغالب' },
          { id: 'none',     label: 'لا يوجد ترخيص مغلق بعد' }
        ]
      })
    },
    {
      match: (s) => s.business_model.includes('اشتراك'),
      build: () => ({
        id: 'subscription-proof', type: 'choice', required: true,
        title: 'ما الذي يجعل المشترك يبقى بعد الشهر الأول؟',
        hint: 'الاشتراك يُختبر بالبقاء، لا بالتسجيل.',
        options: [
          { id: 'habit',   label: 'يستخدمه في عمله أسبوعياً' },
          { id: 'content', label: 'محتوى جديد باستمرار' },
          { id: 'lockin',  label: 'بياناته أو ملفاته داخل المنصة' },
          { id: 'unknown', label: 'لا نعرف بعد — لم نصل لتجديد حقيقي' }
        ]
      })
    },
    {
      match: (s) => s.business_model.includes('عمولة') || s.business_model.includes('وكالة'),
      build: () => ({
        id: 'marketplace-side', type: 'choice', required: true,
        title: 'أي جانب من السوق هو الأصعب لديكم اليوم؟',
        hint: 'الأسواق ثنائية الجانب تفشل من الجانب المهمل.',
        options: [
          { id: 'supply', label: 'استقطاب مقدمي الخدمة' },
          { id: 'demand', label: 'استقطاب المشترين' },
          { id: 'match',  label: 'إتمام المطابقة بينهما' },
          { id: 'trust',  label: 'بناء الثقة في المعاملة' }
        ]
      })
    },
    {
      match: () => true,   // fallback: services, funds, partnerships, IP
      build: (s) => ({
        id: 'revenue-concentration', type: 'choice', required: true,
        title: 'ما نسبة إيرادكم القادمة من أكبر عميل واحد؟',
        hint: 'التركّز في عميل واحد هو أكثر المخاطر التي تُكتشف متأخرة.',
        options: [
          { id: 'low',    label: 'أقل من الربع' },
          { id: 'mid',    label: 'بين الربع والنصف' },
          { id: 'high',   label: 'أكثر من النصف' },
          { id: 'single', label: 'عميل واحد تقريباً' }
        ]
      })
    }
  ];

  function modelQuestion(s) {
    const rule = MODEL_QUESTIONS.find(r => r.match(s));
    return rule ? rule.build(s) : null;
  }

  /* ---- Slot six: the accelerator's own priorities, as a top-three pick ----
     The options are this company's reported priorities plus its roadmap, so
     the founder is choosing among things written about them. */
  function topThree(s) {
    const opts = [];
    (s.accelerator_priorities || []).forEach((p, i) => opts.push({ id: `pri${i}`, label: short(p, 66) }));
    if (s.growth_roadmap) opts.push({ id: 'road', label: short(s.growth_roadmap, 66) });
    opts.push(
      { id: 'hire',    label: 'توظيف الدور الحرج الناقص' },
      { id: 'pricing', label: 'إعادة النظر في التسعير' },
      { id: 'funding', label: 'تأمين تمويل المرحلة القادمة' }
    );
    if (opts.length < 4) return null;
    return {
      id: 'top-three', type: 'top3', required: true,
      title: 'اختر أهم ثلاث أولويات للتسعين يوماً القادمة',
      hint: 'ثلاث فقط — الاختيار هنا يعني التخلي عن الباقي.',
      max: 3,
      options: opts
    };
  }

  /* ------------------------------ التجميع ------------------------------ */

  const MAX_QUESTIONS = 10;

  /**
   * Build the full ordered question set for one startup.
   *
   * The three validation answers come first — they are quick, they warm the
   * founder up, and they are what the room's aggregate view depends on.
   */
  function buildFor(startup) {
    const core = coreQuestions(startup);

    /* Four generated slots, each branching on a different property, so two
       companies only meet the same interview if they match on all of them.
       Between them the cohort sees every answer type; each founder sees four
       different ones. */
    const readiness = Number(startup.readiness) || 0;

    const slotRisk = startup.stage === 'Pre-Seed' ? runway(startup)         // slider
                   : Number(startup.team_size) <= 3 ? busFactor(startup)    // choice
                   : moatConfidence(startup) || modelProof(startup);        // scale

    /* A company that is not ready yet needs to admit what is untested; one
       that is needs to choose what to drop. Different question, different
       type, decided by where they actually are. */
    const slotFocus = readiness < 60 ? untested(startup) : topThree(startup);

    const generated = [
      rankChallenges(startup) || untested(startup),   // rank — their own challenges
      modelQuestion(startup),                          // cards / choice — their model
      slotRisk,
      slotFocus || untested(startup)
    ].filter(Boolean);

    const open = {
      id: 'open-challenge', type: 'longtext', required: false,
      store: ['challengeText'],
      title: 'ما أكبر تحدٍ تواجهه شركتك اليوم؟',
      hint: 'بكلماتك أنت. لن يُعرض اسم شركتك مع هذه الإجابة.',
      placeholder: 'أكبر تحدٍ نواجهه الآن هو...'
    };

    const commitment = {
      id: 'commitment', type: 'longtext', required: false,
      store: ['commitment'],
      title: 'ما أول خطوة ستقوم بها بعد انتهاء هذه الورشة؟',
      hint: 'خطوة واحدة محددة، قابلة للتنفيذ خلال أسبوعين.',
      placeholder: 'قبل الورشة القادمة سأقوم بـ...'
    };

    /* Ten is a promise about how long this takes. The area question and the
       two open ones are fixed at the end, so the generated middle is what
       gives way — and it gives way from the least company-specific end. */
    const room = MAX_QUESTIONS - 3 - 3;          // core validation + fixed tail
    const middle = generated.slice(0, room);

    return [...core.slice(0, 3), ...middle, core[3], open, commitment];
  }

  return { buildFor, MAX_QUESTIONS, short };
})();

window.FVQuestions = FVQuestions;

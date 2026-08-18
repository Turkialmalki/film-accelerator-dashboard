/* ==========================================================================
   المرشد — the coach message shown before any question is asked.

   Three short paragraphs, composed from the company's own record: where the
   report says it stands, what the report says is holding it back, and what
   this session will therefore do about it.

   The voice is a mentor who has read the file, not an assistant introducing
   itself. It states a position and it is specific — a sentence that would
   read the same for any other company in the room has failed its job.
   ========================================================================== */

const FVCoach = (() => {

  /* Openers per stage. Each names what the stage has already proven, because
     the message has to start from something the founder knows is true before
     it says anything they might resist. */
  const STAGE_OPENER = {
    'Series A':
      'بعد مراجعة ملف شركتك، أنت لم تعد تثبت أن الفكرة تعمل — هذا خلفك. '
      + 'السؤال الآن هو ما إذا كانت الشركة تكبر أسرع مما تتعقد.',
    'Pre-A':
      'بعد مراجعة ملف شركتك، النموذج مُثبت والإيراد يتحرك. '
      + 'ما يفصلك عن الجولة القادمة ليس نمواً أكبر، بل نمواً يمكنك تفسيره ورقمياً إثباته.',
    'Seed':
      'بعد مراجعة ملف شركتك، لديك منتج في السوق وعملاء حقيقيون. '
      + 'الخطر في هذه المرحلة ليس الفشل، بل التوسع في اتجاه لم يُثبت بعد.',
    'MVP':
      'بعد مراجعة ملف شركتك، يبدو أنكم تجاوزتم مرحلة إثبات الفكرة. '
      + 'لكن التحدي الأكبر حالياً لا يتعلق بالمنتج، بل بتحويله إلى نمو مستدام.',
    'Pre-Seed':
      'بعد مراجعة ملف شركتك، الفكرة تبلورت والفريق تشكّل. '
      + 'ما لم يحسم بعد هو حكم السوق، وهذا ما يجب أن تشتريه بأقل تكلفة ممكنة.'
  };

  /* How the session frames itself, by how ready the report says they are. */
  function closing(readiness) {
    if (readiness >= 70) {
      return 'سنطرح عليك أسئلة قصيرة، لكنها ليست أسئلة مبتدئين — '
           + 'هدفها تحديد أين يجب أن تركّز طاقتك المحدودة خلال المرحلة القادمة.';
    }
    if (readiness >= 55) {
      return 'سنطرح عليك عدة أسئلة قصيرة حتى نستطيع تحديد أين يجب أن تركّز '
           + 'خلال المرحلة القادمة، وما الذي يمكن تأجيله بأمان.';
    }
    return 'سنطرح عليك عدة أسئلة قصيرة، وأكثرها أهمية هو ما لم تختبره بعد — '
         + 'لأن أرخص خطأ هو الذي تكتشفه اليوم بدل أن تكتشفه بعد ستة أشهر.';
  }

  /**
   * Trim a reported line into something that reads inside a sentence.
   * The report writes full analyst sentences; quoting one whole mid-paragraph
   * reads like a citation rather than a mentor speaking.
   */
  function clause(text, max = 96) {
    let t = String(text || '').trim().replace(/\.$/, '');
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const at = Math.max(cut.lastIndexOf('،'), cut.lastIndexOf(' '));
    return (at > 40 ? cut.slice(0, at) : cut).trim() + '…';
  }

  function firstName(startup) {
    const full = startup?.founder?.name_ar || '';
    const parts = full.split(/\s+/).filter(Boolean);
    /* "عبد الله" and "عبد الرحمن" are two words that form one given name —
       greeting someone as "عبد" would be wrong. */
    if (parts[0] === 'عبد' && parts[1]) return `${parts[0]} ${parts[1]}`;
    return parts[0] || '';
  }

  /**
   * The message, as an array of paragraphs.
   * @param startup a row from data/startups.json
   */
  function messageFor(startup) {
    const name = firstName(startup);
    const challenge = clause((startup.current_challenges || [])[0]);
    const advantage = clause((startup.competitive_advantages || [])[0], 84);

    const paragraphs = [];

    paragraphs.push(name ? `مرحباً ${name}،` : 'مرحباً،');

    paragraphs.push(
      STAGE_OPENER[startup.stage]
      || 'بعد مراجعة ملف شركتك، لديك ما يكفي للبدء في أسئلة أصعب من أسئلة البداية.'
    );

    /* The specific pair: what the report says protects them, and what it says
       threatens them. This is the sentence a founder cannot mistake for a
       template, because both halves are their own. */
    if (advantage && challenge) {
      paragraphs.push(
        `أقوى ما لديك اليوم هو ${advantage}. وأكثر ما يهدده هو ${challenge}.`
      );
    } else if (challenge) {
      paragraphs.push(`أكثر ما يستحق انتباهك اليوم هو ${challenge}.`);
    }

    paragraphs.push(closing(Number(startup.readiness) || 0));

    return paragraphs;
  }

  return { messageFor, firstName, clause };
})();

window.FVCoach = FVCoach;

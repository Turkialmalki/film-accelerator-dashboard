import type {
  Bilingual,
  FieldOption,
  FieldType,
  FieldValidation,
  FormField,
  FormRule,
  FormSection,
  FormTemplateKey,
} from '@/lib/data/types';

export interface TemplateBlueprint {
  key: FormTemplateKey;
  title: Bilingual;
  description: Bilingual;
  summary: Bilingual;
  icon: string;
  sections: {
    title: Bilingual;
    description: Bilingual;
    fields: DraftField[];
  }[];
}

export interface DraftField {
  key: string;
  type: FieldType;
  label: Bilingual;
  description?: Bilingual;
  placeholder?: Bilingual;
  required?: boolean;
  options?: { value: string; label: Bilingual }[];
  validation?: FieldValidation;
  default_value?: string;
}

const yesNo = (): { value: string; label: Bilingual }[] => [
  { value: 'yes', label: { ar: 'نعم', en: 'Yes' } },
  { value: 'no', label: { ar: 'لا', en: 'No' } },
];

const likertAgreement = (): { value: string; label: Bilingual }[] => [
  { value: '1', label: { ar: 'لا أوافق بشدة', en: 'Strongly disagree' } },
  { value: '2', label: { ar: 'لا أوافق', en: 'Disagree' } },
  { value: '3', label: { ar: 'محايد', en: 'Neutral' } },
  { value: '4', label: { ar: 'أوافق', en: 'Agree' } },
  { value: '5', label: { ar: 'أوافق بشدة', en: 'Strongly agree' } },
];

export const TEMPLATES: TemplateBlueprint[] = [
  {
    key: 'workshop_evaluation',
    icon: 'ClipboardCheck',
    title: { ar: 'تقييم ورشة عمل', en: 'Workshop Evaluation' },
    description: {
      ar: 'استمارة تقييم تُرسل للفرق بعد كل ورشة لقياس جودة المحتوى وأثر الجلسة.',
      en: 'A post-workshop evaluation sent to teams to measure content quality and session impact.',
    },
    summary: {
      ar: 'تقييم بالنجوم، مقياس ليكرت، مؤشر ترشيح، وأسئلة مفتوحة.',
      en: 'Star rating, Likert scale, NPS, and open questions.',
    },
    sections: [
      {
        title: { ar: 'عن الجلسة', en: 'About the session' },
        description: {
          ar: 'حدّد الورشة التي تُقيّمها ثم أعطنا انطباعك العام.',
          en: 'Identify the workshop you are evaluating, then give us your overall impression.',
        },
        fields: [
          {
            key: 'team',
            type: 'team_select',
            label: { ar: 'الفريق', en: 'Team' },
            required: true,
          },
          {
            key: 'workshop',
            type: 'select',
            label: { ar: 'الورشة', en: 'Workshop' },
            required: true,
            options: [
              { value: 'positioning', label: { ar: 'التموضع والسردية', en: 'Positioning & narrative' } },
              { value: 'business_model', label: { ar: 'نموذج العمل والتسعير', en: 'Business model & pricing' } },
              { value: 'financials', label: { ar: 'النموذج المالي', en: 'Financial modelling' } },
              { value: 'pitch', label: { ar: 'بناء العرض الاستثماري', en: 'Building the pitch' } },
              { value: 'distribution', label: { ar: 'التوزيع والوصول للسوق', en: 'Distribution & go-to-market' } },
            ],
          },
          {
            key: 'overall',
            type: 'rating',
            label: { ar: 'التقييم العام للورشة', en: 'Overall workshop rating' },
            required: true,
            validation: { scale: 5 },
          },
        ],
      },
      {
        title: { ar: 'جودة المحتوى', en: 'Content quality' },
        description: {
          ar: 'إلى أي مدى توافق على العبارات التالية؟',
          en: 'How much do you agree with the following statements?',
        },
        fields: [
          {
            key: 'clarity',
            type: 'likert',
            label: { ar: 'كان المحتوى واضحاً ومنظماً', en: 'The content was clear and well structured' },
            required: true,
            options: likertAgreement(),
          },
          {
            key: 'applicability',
            type: 'likert',
            label: {
              ar: 'أستطيع تطبيق ما تعلمته على شركتي خلال أسبوعين',
              en: 'I can apply what I learned to my company within two weeks',
            },
            required: true,
            options: likertAgreement(),
          },
          {
            key: 'pace',
            type: 'radio',
            label: { ar: 'إيقاع الجلسة', en: 'Session pace' },
            required: true,
            options: [
              { value: 'slow', label: { ar: 'بطيء', en: 'Too slow' } },
              { value: 'right', label: { ar: 'مناسب', en: 'Just right' } },
              { value: 'fast', label: { ar: 'سريع', en: 'Too fast' } },
            ],
          },
        ],
      },
      {
        title: { ar: 'الأثر والتوصية', en: 'Impact & recommendation' },
        description: { ar: '', en: '' },
        fields: [
          {
            key: 'nps',
            type: 'nps',
            label: {
              ar: 'ما احتمال أن ترشّح هذه الورشة لمؤسس آخر؟',
              en: 'How likely are you to recommend this workshop to another founder?',
            },
            required: true,
          },
          {
            key: 'most_useful',
            type: 'long_text',
            label: { ar: 'أكثر جزء استفدت منه', en: 'The most useful part for you' },
            placeholder: {
              ar: 'اكتب الجزء الذي غيّر طريقة تفكيرك فعلياً.',
              en: 'Tell us the part that genuinely changed how you think.',
            },
            required: true,
            validation: { maxLength: 800 },
          },
          {
            key: 'improve',
            type: 'long_text',
            label: { ar: 'ما الذي تقترح تحسينه؟', en: 'What would you improve?' },
            validation: { maxLength: 800 },
          },
          {
            key: 'followup',
            type: 'radio',
            label: {
              ar: 'هل ترغب بجلسة متابعة فردية حول هذا الموضوع؟',
              en: 'Would you like a one-to-one follow-up on this topic?',
            },
            required: true,
            options: yesNo(),
          },
          {
            key: 'followup_topic',
            type: 'short_text',
            label: { ar: 'موضوع جلسة المتابعة', en: 'Follow-up topic' },
            description: {
              ar: 'يظهر هذا الحقل فقط عند اختيار «نعم».',
              en: 'This field appears only when you answer “Yes”.',
            },
          },
        ],
      },
    ],
  },
  {
    key: 'presentation_submission',
    icon: 'Presentation',
    title: { ar: 'تسليم العرض التقديمي', en: 'Presentation Submission' },
    description: {
      ar: 'استمارة رفع العرض الاستثماري والمواد المصاحبة قبل يوم العرض.',
      en: 'Upload the investment deck and supporting material ahead of demo day.',
    },
    summary: {
      ar: 'رفع ملف، رابط فيديو، ملخص تنفيذي، وموعد التسليم.',
      en: 'File upload, video link, executive summary, and delivery date.',
    },
    sections: [
      {
        title: { ar: 'بيانات الفريق', en: 'Team details' },
        description: { ar: '', en: '' },
        fields: [
          { key: 'team', type: 'team_select', label: { ar: 'الفريق', en: 'Team' }, required: true },
          {
            key: 'presenter',
            type: 'short_text',
            label: { ar: 'اسم مقدّم العرض', en: 'Presenter name' },
            required: true,
          },
          {
            key: 'presenter_email',
            type: 'email',
            label: { ar: 'البريد الإلكتروني', en: 'Email' },
            required: true,
          },
          { key: 'phone', type: 'phone', label: { ar: 'رقم الجوال', en: 'Mobile number' } },
        ],
      },
      {
        title: { ar: 'مواد العرض', en: 'Presentation material' },
        description: {
          ar: 'يُقبل ملف PDF بحجم أقصى 25 ميجابايت.',
          en: 'A PDF up to 25 MB is accepted.',
        },
        fields: [
          {
            key: 'title',
            type: 'short_text',
            label: { ar: 'عنوان العرض', en: 'Presentation title' },
            required: true,
          },
          {
            key: 'logline',
            type: 'long_text',
            label: { ar: 'الملخص التنفيذي', en: 'Executive summary' },
            required: true,
            validation: { maxLength: 600 },
          },
          {
            key: 'deck',
            type: 'file',
            label: { ar: 'ملف العرض', en: 'Deck file' },
            required: true,
            validation: { accept: ['.pdf', '.key', '.pptx'], maxSizeMb: 25 },
          },
          {
            key: 'video',
            type: 'url',
            label: { ar: 'رابط الفيديو التعريفي', en: 'Teaser video link' },
          },
          {
            key: 'ask',
            type: 'number',
            label: { ar: 'المبلغ المطلوب (ر.س)', en: 'Funding ask (SAR)' },
            validation: { min: 0 },
          },
          {
            key: 'rehearsal',
            type: 'datetime',
            label: { ar: 'موعد البروفة المفضل', en: 'Preferred rehearsal slot' },
          },
          {
            key: 'consent',
            type: 'consent',
            label: {
              ar: 'أوافق على مشاركة هذه المواد مع لجنة التحكيم والشركاء.',
              en: 'I agree to share this material with the jury and programme partners.',
            },
            required: true,
          },
        ],
      },
    ],
  },
  {
    key: 'mentor_feedback',
    icon: 'MessageSquareQuote',
    title: { ar: 'ملاحظات المرشد', en: 'Mentor Feedback' },
    description: {
      ar: 'استمارة يملؤها المرشد بعد كل جلسة إرشاد لتوثيق التقدم والمخاطر.',
      en: 'Completed by the mentor after each session to record progress and risks.',
    },
    summary: {
      ar: 'تقييم الجاهزية، نقاط القوة، المخاطر، والخطوة التالية.',
      en: 'Readiness rating, strengths, risks, and the next step.',
    },
    sections: [
      {
        title: { ar: 'الجلسة', en: 'The session' },
        description: { ar: '', en: '' },
        fields: [
          { key: 'team', type: 'team_select', label: { ar: 'الفريق', en: 'Team' }, required: true },
          {
            key: 'mentor',
            type: 'participant_select',
            label: { ar: 'المرشد', en: 'Mentor' },
            required: true,
          },
          { key: 'session_date', type: 'date', label: { ar: 'تاريخ الجلسة', en: 'Session date' }, required: true },
          {
            key: 'duration',
            type: 'number',
            label: { ar: 'مدة الجلسة (دقيقة)', en: 'Duration (minutes)' },
            validation: { min: 15, max: 240 },
          },
        ],
      },
      {
        title: { ar: 'التقييم', en: 'Assessment' },
        description: { ar: '', en: '' },
        fields: [
          {
            key: 'readiness',
            type: 'rating',
            label: { ar: 'جاهزية الفريق للاستثمار', en: 'Investment readiness' },
            required: true,
            validation: { scale: 5 },
          },
          {
            key: 'focus_areas',
            type: 'multi_select',
            label: { ar: 'مجالات العمل ذات الأولوية', en: 'Priority focus areas' },
            required: true,
            options: [
              { value: 'positioning', label: { ar: 'التموضع', en: 'Positioning' } },
              { value: 'revenue', label: { ar: 'نموذج الإيراد', en: 'Revenue model' } },
              { value: 'team', label: { ar: 'الفريق والتوظيف', en: 'Team & hiring' } },
              { value: 'product', label: { ar: 'المنتج', en: 'Product' } },
              { value: 'gtm', label: { ar: 'الوصول للسوق', en: 'Go-to-market' } },
              { value: 'finance', label: { ar: 'التمويل', en: 'Fundraising' } },
            ],
          },
          {
            key: 'strength',
            type: 'long_text',
            label: { ar: 'أبرز نقطة قوة', en: 'Standout strength' },
            required: true,
          },
          {
            key: 'risk',
            type: 'long_text',
            label: { ar: 'أبرز مخاطرة', en: 'Biggest risk' },
            required: true,
          },
          {
            key: 'next_step',
            type: 'long_text',
            label: { ar: 'الخطوة التالية المتفق عليها', en: 'Agreed next step' },
            required: true,
          },
          {
            key: 'escalate',
            type: 'radio',
            label: { ar: 'هل يحتاج الفريق تدخل إدارة البرنامج؟', en: 'Does this team need programme escalation?' },
            required: true,
            options: yesNo(),
          },
        ],
      },
    ],
  },
  {
    key: 'attendance',
    icon: 'CalendarCheck',
    title: { ar: 'تسجيل الحضور', en: 'Attendance / Check-in' },
    description: {
      ar: 'تسجيل حضور سريع يُمسح عبر رمز QR عند باب القاعة.',
      en: 'A fast check-in scanned from a QR code at the room door.',
    },
    summary: {
      ar: 'اختيار الفريق، وقت الحضور، وحالة الحضور.',
      en: 'Team selector, check-in time, and attendance status.',
    },
    sections: [
      {
        title: { ar: 'الحضور', en: 'Check-in' },
        description: { ar: '', en: '' },
        fields: [
          { key: 'team', type: 'team_select', label: { ar: 'الفريق', en: 'Team' }, required: true },
          {
            key: 'attendee',
            type: 'short_text',
            label: { ar: 'اسم الحاضر', en: 'Attendee name' },
            required: true,
          },
          {
            key: 'status',
            type: 'radio',
            label: { ar: 'حالة الحضور', en: 'Attendance status' },
            required: true,
            options: [
              { value: 'present', label: { ar: 'حاضر', en: 'Present' } },
              { value: 'late', label: { ar: 'متأخر', en: 'Late' } },
              { value: 'remote', label: { ar: 'عن بُعد', en: 'Remote' } },
              { value: 'absent', label: { ar: 'غائب', en: 'Absent' } },
            ],
          },
          { key: 'checkin_time', type: 'time', label: { ar: 'وقت الوصول', en: 'Arrival time' } },
          { key: 'note', type: 'short_text', label: { ar: 'ملاحظة', en: 'Note' } },
          {
            key: 'session_code',
            type: 'hidden',
            label: { ar: 'رمز الجلسة', en: 'Session code' },
            default_value: 'FBA-SESSION',
          },
        ],
      },
    ],
  },
  {
    key: 'blank',
    icon: 'FilePlus2',
    title: { ar: 'استمارة فارغة', en: 'Blank form' },
    description: {
      ar: 'ابدأ من صفحة بيضاء وابنِ الحقول بنفسك.',
      en: 'Start from an empty canvas and build the fields yourself.',
    },
    summary: { ar: 'قسم واحد وحقل نص واحد.', en: 'One section, one text field.' },
    sections: [
      {
        title: { ar: 'القسم الأول', en: 'Section one' },
        description: { ar: '', en: '' },
        fields: [
          {
            key: 'q1',
            type: 'short_text',
            label: { ar: 'السؤال الأول', en: 'First question' },
          },
        ],
      },
    ],
  },
];

export const TEMPLATE_MAP: Record<FormTemplateKey, TemplateBlueprint> = TEMPLATES.reduce(
  (acc, t) => {
    acc[t.key] = t;
    return acc;
  },
  {} as Record<FormTemplateKey, TemplateBlueprint>,
);

const EMPTY: Bilingual = { ar: '', en: '' };

export interface BuiltTemplate {
  sections: FormSection[];
  fields: FormField[];
  rules: FormRule[];
}

/**
 * Materialise a template into concrete rows.
 *
 * `idFor` is injected so the demo seed can produce stable ids (making the
 * fixture data byte-identical on every boot) while the builder UI can use
 * random ids.
 */
export function buildTemplate(
  key: FormTemplateKey,
  formId: string,
  idFor: (scope: string, hint: string) => string,
): BuiltTemplate {
  const blueprint = TEMPLATE_MAP[key];
  const sections: FormSection[] = [];
  const fields: FormField[] = [];
  const rules: FormRule[] = [];
  let position = 0;

  blueprint.sections.forEach((s, si) => {
    const sectionId = idFor('section', `${key}-${si}`);
    sections.push({
      id: sectionId,
      form_id: formId,
      title: s.title,
      description: s.description,
      position: si,
    });

    s.fields.forEach((f) => {
      const fieldId = idFor('field', `${key}-${f.key}`);
      fields.push({
        id: fieldId,
        form_id: formId,
        section_id: sectionId,
        type: f.type,
        label: f.label,
        description: f.description ?? EMPTY,
        placeholder: f.placeholder ?? EMPTY,
        required: f.required ?? false,
        position: position++,
        options: (f.options ?? []).map<FieldOption>((o, oi) => ({
          id: idFor('option', `${key}-${f.key}-${oi}`),
          label: o.label,
          value: o.value,
        })),
        validation: f.validation ?? {},
        default_value: f.default_value ?? '',
      });
    });
  });

  // The one template that ships with a conditional rule, so the rule editor
  // has real data to show on first run.
  if (key === 'workshop_evaluation') {
    const target = fields.find((f) => f.id === idFor('field', 'workshop_evaluation-followup_topic'));
    const source = fields.find((f) => f.id === idFor('field', 'workshop_evaluation-followup'));
    if (target && source) {
      rules.push({
        id: idFor('rule', 'workshop_evaluation-followup'),
        form_id: formId,
        target_field_id: target.id,
        source_field_id: source.id,
        operator: 'equals',
        value: 'yes',
        action: 'show',
      });
    }
  }

  return { sections, fields, rules };
}

import type { Bilingual, FieldType } from '@/lib/data/types';

export interface FieldTypeMeta {
  type: FieldType;
  label: Bilingual;
  /** lucide-react icon name, resolved in the palette component. */
  icon: string;
  group: 'text' | 'choice' | 'scale' | 'datetime' | 'upload' | 'program' | 'layout';
  /** Layout fields never produce an answer. */
  answerable: boolean;
  hasOptions: boolean;
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  { type: 'short_text', label: { ar: 'نص قصير', en: 'Short text' }, icon: 'Type', group: 'text', answerable: true, hasOptions: false },
  { type: 'long_text', label: { ar: 'نص طويل', en: 'Long text' }, icon: 'AlignLeft', group: 'text', answerable: true, hasOptions: false },
  { type: 'email', label: { ar: 'بريد إلكتروني', en: 'Email' }, icon: 'Mail', group: 'text', answerable: true, hasOptions: false },
  { type: 'phone', label: { ar: 'رقم جوال', en: 'Phone' }, icon: 'Phone', group: 'text', answerable: true, hasOptions: false },
  { type: 'number', label: { ar: 'رقم', en: 'Number' }, icon: 'Hash', group: 'text', answerable: true, hasOptions: false },
  { type: 'url', label: { ar: 'رابط', en: 'URL' }, icon: 'Link', group: 'text', answerable: true, hasOptions: false },

  { type: 'select', label: { ar: 'قائمة منسدلة', en: 'Dropdown' }, icon: 'ChevronDown', group: 'choice', answerable: true, hasOptions: true },
  { type: 'multi_select', label: { ar: 'اختيار متعدد', en: 'Multi-select' }, icon: 'ListChecks', group: 'choice', answerable: true, hasOptions: true },
  { type: 'radio', label: { ar: 'اختيار واحد', en: 'Single choice' }, icon: 'CircleDot', group: 'choice', answerable: true, hasOptions: true },
  { type: 'checkbox', label: { ar: 'مربعات اختيار', en: 'Checkboxes' }, icon: 'SquareCheck', group: 'choice', answerable: true, hasOptions: true },
  { type: 'consent', label: { ar: 'إقرار وموافقة', en: 'Consent' }, icon: 'ShieldCheck', group: 'choice', answerable: true, hasOptions: false },

  { type: 'rating', label: { ar: 'تقييم بالنجوم', en: 'Rating' }, icon: 'Star', group: 'scale', answerable: true, hasOptions: false },
  { type: 'likert', label: { ar: 'مقياس ليكرت', en: 'Likert scale' }, icon: 'Rows3', group: 'scale', answerable: true, hasOptions: true },
  { type: 'nps', label: { ar: 'مؤشر الترشيح NPS', en: 'NPS' }, icon: 'Gauge', group: 'scale', answerable: true, hasOptions: false },

  { type: 'date', label: { ar: 'تاريخ', en: 'Date' }, icon: 'Calendar', group: 'datetime', answerable: true, hasOptions: false },
  { type: 'time', label: { ar: 'وقت', en: 'Time' }, icon: 'Clock', group: 'datetime', answerable: true, hasOptions: false },
  { type: 'datetime', label: { ar: 'تاريخ ووقت', en: 'Date & time' }, icon: 'CalendarClock', group: 'datetime', answerable: true, hasOptions: false },

  { type: 'file', label: { ar: 'رفع ملف', en: 'File upload' }, icon: 'Paperclip', group: 'upload', answerable: true, hasOptions: false },
  { type: 'image', label: { ar: 'رفع صورة', en: 'Image upload' }, icon: 'Image', group: 'upload', answerable: true, hasOptions: false },

  { type: 'team_select', label: { ar: 'اختيار فريق', en: 'Team selector' }, icon: 'Users', group: 'program', answerable: true, hasOptions: false },
  { type: 'participant_select', label: { ar: 'اختيار مشارك', en: 'Participant selector' }, icon: 'UserRound', group: 'program', answerable: true, hasOptions: false },

  { type: 'section_heading', label: { ar: 'عنوان قسم', en: 'Section heading' }, icon: 'Heading', group: 'layout', answerable: false, hasOptions: false },
  { type: 'description', label: { ar: 'فقرة شرح', en: 'Description' }, icon: 'Text', group: 'layout', answerable: false, hasOptions: false },
  { type: 'divider', label: { ar: 'فاصل', en: 'Divider' }, icon: 'Minus', group: 'layout', answerable: false, hasOptions: false },
  { type: 'page_break', label: { ar: 'فاصل صفحات', en: 'Page break' }, icon: 'SeparatorHorizontal', group: 'layout', answerable: false, hasOptions: false },
  { type: 'hidden', label: { ar: 'حقل مخفي', en: 'Hidden field' }, icon: 'EyeOff', group: 'layout', answerable: false, hasOptions: false },
];

export const FIELD_TYPE_MAP: Record<FieldType, FieldTypeMeta> = FIELD_TYPES.reduce(
  (acc, meta) => {
    acc[meta.type] = meta;
    return acc;
  },
  {} as Record<FieldType, FieldTypeMeta>,
);

export const FIELD_GROUPS: { key: FieldTypeMeta['group']; label: Bilingual }[] = [
  { key: 'text', label: { ar: 'نصوص', en: 'Text' } },
  { key: 'choice', label: { ar: 'خيارات', en: 'Choice' } },
  { key: 'scale', label: { ar: 'مقاييس', en: 'Scales' } },
  { key: 'datetime', label: { ar: 'تاريخ ووقت', en: 'Date & time' } },
  { key: 'upload', label: { ar: 'مرفقات', en: 'Uploads' } },
  { key: 'program', label: { ar: 'بيانات البرنامج', en: 'Program data' } },
  { key: 'layout', label: { ar: 'تنسيق', en: 'Layout' } },
];

export function isAnswerable(type: FieldType): boolean {
  return FIELD_TYPE_MAP[type].answerable;
}

export function hasOptions(type: FieldType): boolean {
  return FIELD_TYPE_MAP[type].hasOptions;
}

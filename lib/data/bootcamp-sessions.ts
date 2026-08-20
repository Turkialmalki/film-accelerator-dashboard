/**
 * The three-day bootcamp's real mentor sign-up sheet — one mentor group per
 * row, each with the founders assigned to sit with them that day. Sourced
 * directly from the programme's own sign-up spreadsheet (one tab per day),
 * transcribed as static data rather than a database table: this is a fixed
 * historical record of who met whom during the bootcamp, not something the
 * product needs to let anyone edit going forward.
 */

export interface BootcampMentorGroup {
  mentorName: string;
  /** Whether the sheet calls them a "مرشد" (mentor) or "مستشارة" (consultant)
   * — kept verbatim rather than normalised to one word, since that's the
   * real distinction the programme itself draws. */
  role: 'mentor' | 'consultant';
  entrepreneurs: string[];
}

export interface BootcampDay {
  day: 1 | 2 | 3;
  groups: BootcampMentorGroup[];
}

export const BOOTCAMP_DAYS: BootcampDay[] = [
  {
    day: 1,
    groups: [
      {
        mentorName: 'إيمان الحسيني',
        role: 'consultant',
        entrepreneurs: [
          'نزار الشهراني',
          'سالم محمد',
          'احمد حميدان',
          'ريما العبدالكريم',
          'امير الجبيلي',
          'عبدالعزيز الشبل',
          'عبدالعزيز عسيري',
          'ابرار القرشي',
          'رزان القرشي',
          'نواف العازمي',
          'احمد عسيري',
        ],
      },
      {
        mentorName: 'أروى عبدالتواب',
        role: 'consultant',
        entrepreneurs: [
          'يزيد ال الشيخ',
          'محمد القاسم',
          'عبدالملك',
          'يارا المطيري',
          'ناصر البردي',
          'حسن الشولي',
          'رتيل مساوي',
          'عبدالواحد العبدلي',
          'أحمد الحميدان',
          'امير ال بيري',
          'محمد المسعد',
        ],
      },
    ],
  },
  {
    day: 2,
    groups: [
      {
        mentorName: 'ندى النفيعي',
        role: 'consultant',
        entrepreneurs: [
          'نور السالم',
          'رتيل مساوي',
          'مشعل الثبيتي',
          'سمر العبيد',
          'جودة البرق',
          'احمد باحميدان',
          'نواف العازمي',
          'مودة البارقي',
        ],
      },
      {
        mentorName: 'بشرى المباركي',
        role: 'consultant',
        entrepreneurs: [
          'محمد بشير',
          'عبدالله المهنا',
          'عبدالعزيز الشبل',
          'يارا المطيري',
          'مشعل الثبيتي',
          'رغدة الحضرتي',
          'ماجد الازوري',
          'محمد المساعد',
          'نور سالم',
          'ابرار القرشي',
          'رزان القرشي',
          'عبدالملك بن الاحمد',
          'محمد القاسم',
          'احمد باحميدان',
        ],
      },
    ],
  },
  {
    day: 3,
    groups: [
      {
        mentorName: 'سعيد النهدي',
        role: 'mentor',
        entrepreneurs: [
          'عبدالعزيز الشبل',
          'عبدالعزيز عسيري',
          'نور ال سالم',
          'ابرار القرشي',
          'رزان القرشي',
          'قاسم الشافعي',
          'عبدالواحد',
          'يارا المطيري',
          'محمد القاسم',
          'رتيل مساوي',
        ],
      },
      {
        mentorName: 'أروى عبدالتواب',
        role: 'consultant',
        entrepreneurs: [
          'عمر هاشمي',
          'قاسم الشافعي',
          'عبدالواحد',
          'يارا المطيري',
          'نور ال سالم',
          'ماجد الازوري',
          'طلال العسيري',
          'حسن',
          'عبدالملك',
          'محمد القاسم',
        ],
      },
    ],
  },
];

export interface BootcampStats {
  /** One row per mentor-entrepreneur pairing, one row = one session — the
   * same unit the Calendly numbers count in. */
  totalSessions: number;
  sessionsByMentor: Map<string, number>;
}

/**
 * The bootcamp ran 17-19 Aug 2026 — the programme's own first three days —
 * so every session on this sheet already falls inside the "12 Aug onward"
 * reporting window the Mentorship-sessions cards use; nothing here needs
 * its own date filter.
 */
export function bootcampStats(): BootcampStats {
  const sessionsByMentor = new Map<string, number>();
  let totalSessions = 0;
  BOOTCAMP_DAYS.forEach((day) => {
    day.groups.forEach((group) => {
      const count = group.entrepreneurs.length;
      totalSessions += count;
      sessionsByMentor.set(group.mentorName, (sessionsByMentor.get(group.mentorName) ?? 0) + count);
    });
  });
  return { totalSessions, sessionsByMentor };
}

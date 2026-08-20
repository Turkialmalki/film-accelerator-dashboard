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

/**
 * Folds the bootcamp sign-up sheet into the live Calendly numbers — the
 * one place this merge happens, used by both the dashboard panel and the
 * export builder, so a downloaded report can never show different totals
 * than the screen it was exported from.
 *
 * The bootcamp ran 17-19 Aug, inside the same "12 Aug onward" window the
 * Calendly data is already scoped to, so this is genuinely one reporting
 * period. Mentor identity, session count, and hours are all merged.
 * Calendly's own hours are already whole numbers — each real session
 * rounded up to the nearest hour it actually occupied (see
 * `fetchCalendlySummary`), never a fraction. The bootcamp sheet has no
 * recorded start/end time for any of its sessions at all, so each one is
 * costed the same way any short mentor slot is under that same rule: one
 * whole hour, the floor the rounding itself already applies to a real
 * 15-30 minute Calendly session. Cancellations and reschedules stay
 * Calendly-only — the sheet has no cancellation record.
 */
export function mergeBootcampIntoMentorship(data: {
  sessionsCompleted: number;
  hoursCompleted: number;
  sessionsPerMentor: { name: string; sessions: number }[];
}): {
  mentors: number;
  sessionsCompleted: number;
  hoursCompleted: number;
  sessionsPerMentor: { name: string; sessions: number }[];
} {
  const { totalSessions, sessionsByMentor } = bootcampStats();

  const merged = new Map<string, number>();
  data.sessionsPerMentor.forEach((m) => merged.set(m.name, m.sessions));
  sessionsByMentor.forEach((count, name) => merged.set(name, (merged.get(name) ?? 0) + count));

  const bootcampHours = totalSessions;

  return {
    mentors: merged.size,
    sessionsCompleted: data.sessionsCompleted + totalSessions,
    hoursCompleted: data.hoursCompleted + bootcampHours,
    sessionsPerMentor: Array.from(merged.entries())
      .map(([name, sessions]) => ({ name, sessions }))
      .sort((a, b) => b.sessions - a.sessions),
  };
}

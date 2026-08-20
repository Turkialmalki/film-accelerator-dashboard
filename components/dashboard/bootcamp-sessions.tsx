'use client';

import { useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Users } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { EASE_OUT } from '@/components/charts/chart-kit';
import { BOOTCAMP_DAYS, type BootcampMentorGroup } from '@/lib/data/bootcamp-sessions';
import { cn } from '@/lib/utils';

/**
 * The bootcamp's real mentor sign-up sheet, presented as a tabbed section —
 * one tab per day, matching the programme's own spreadsheet exactly. Static
 * data (see lib/data/bootcamp-sessions.ts): a historical record of who met
 * whom, not something that needs a database row or an edit screen.
 */
export function BootcampSessions() {
  const { t, tf, dir } = useI18n();
  const reduced = useReducedMotion();
  const [activeDay, setActiveDay] = useState<1 | 2 | 3>(1);

  const day = BOOTCAMP_DAYS.find((d) => d.day === activeDay) ?? BOOTCAMP_DAYS[0];

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
      transition={{ duration: 0.55, ease: EASE_OUT }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{t.bootcamp.sectionTitle}</p>
          <p className="mt-0.5 text-xs text-ink-subtle">{t.bootcamp.sectionSubtitle}</p>
        </div>

        {/* Day tabs — the same segmented-control styling the Teams page's
            card/table toggle already established, so this reads as the
            same product rather than a bespoke widget. */}
        <div className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-muted p-1">
          {BOOTCAMP_DAYS.map(({ day: n }) => (
            <button
              key={n}
              type="button"
              onClick={() => setActiveDay(n)}
              aria-pressed={activeDay === n}
              className={cn(
                'rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
                activeDay === n ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
              )}
            >
              {tf(t.bootcamp.day, { n })}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnimatePresence mode="wait">
          {day.groups.map((group, i) => (
            <MentorGroupCard key={`${day.day}-${group.mentorName}`} group={group} index={i} dir={dir} />
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function MentorGroupCard({
  group,
  index,
  dir,
}: {
  group: BootcampMentorGroup;
  index: number;
  dir: 'ltr' | 'rtl';
}) {
  const { t, tf } = useI18n();
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.4, delay: reduced ? 0 : index * 0.08, ease: EASE_OUT }}
      className="group relative overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-lift"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/[0.06] to-transparent"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{group.mentorName}</p>
            <Badge tone={group.role === 'mentor' ? 'accent' : 'info'} className="mt-1">
              {group.role === 'mentor' ? t.bootcamp.roleMentor : t.bootcamp.roleConsultant}
            </Badge>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle" dir={dir}>
          <Users className="size-3.5" aria-hidden />
          {tf(t.bootcamp.entrepreneursCount, { n: group.entrepreneurs.length })}
        </span>
      </div>

      <ul className="relative mt-4 flex flex-wrap gap-1.5">
        {group.entrepreneurs.map((name, i) => (
          <motion.li
            key={name}
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: reduced ? 0 : index * 0.08 + i * 0.02, ease: EASE_OUT }}
            className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs text-ink-muted"
          >
            {name}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

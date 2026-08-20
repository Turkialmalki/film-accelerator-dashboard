'use client';

import { FileEdit, HelpCircle, Info, KeyRound, LayoutDashboard, Mail, Users2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/locale-provider';
import { isDemoMode } from '@/lib/data';
import { DEMO_ADMIN_EMAIL, DEMO_PARTICIPANT_EMAIL, DEMO_PASSWORD } from '@/lib/data/seed';

const DEMO_CREDENTIALS_VISIBLE = process.env.NODE_ENV !== 'production';

/** Real support inbox for the programme. Configurable so it can move to a
 * shared team address later without a code change. */
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'turkialmalki202200@gmail.com';

export default function HelpPage() {
  const { t } = useI18n();

  const topics = [
    { icon: KeyRound, title: t.help.topicAccountTitle, body: t.help.topicAccountBody },
    { icon: Users2, title: t.help.topicTeamTitle, body: t.help.topicTeamBody },
    { icon: FileEdit, title: t.help.topicFormsTitle, body: t.help.topicFormsBody },
    { icon: LayoutDashboard, title: t.help.topicDataTitle, body: t.help.topicDataBody },
    { icon: HelpCircle, title: t.help.topicOtherTitle, body: t.help.topicOtherBody },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.help.title} subtitle={t.help.subtitle} />

      <div className="flex flex-col gap-4">
        {/* The one card every visitor actually needs: a real way to reach a
            real person. Everything below it is context, not the primary
            action. */}
        <Card className="border-accent/25 bg-accent-soft/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4 text-accent" aria-hidden />
              {t.help.contactTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm leading-relaxed text-ink-muted">{t.help.contactBody}</p>
            <Button asChild size="lg" className="shrink-0">
              <a href={`mailto:${SUPPORT_EMAIL}`}>
                <Mail aria-hidden />
                {t.help.contactCta}
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.help.topicsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-line">
              {topics.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {isDemoMode() ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="size-4 text-accent" aria-hidden />
                {t.help.demoTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-ink-muted">{t.help.demoBody}</p>
            </CardContent>
          </Card>
        ) : null}

        {DEMO_CREDENTIALS_VISIBLE ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4 text-accent" aria-hidden />
                {t.help.accountsTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">{t.help.accountsBody}</p>
              <dl className="flex flex-col gap-2 text-sm" dir="ltr">
                <Row label={t.roles.admin} value={DEMO_ADMIN_EMAIL} />
                <Row label={t.roles.participant} value={DEMO_PARTICIPANT_EMAIL} />
                <Row label={t.auth.password} value={DEMO_PASSWORD} />
              </dl>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
      <dt className="text-ink-subtle">{label}</dt>
      <dd>
        <Badge tone="neutral" className="font-mono">
          {value}
        </Badge>
      </dd>
    </div>
  );
}

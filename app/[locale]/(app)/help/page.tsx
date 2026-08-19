'use client';

import { Database, Info, KeyRound, LifeBuoy } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/components/providers/locale-provider';
import { isDemoMode } from '@/lib/data';
import { DEMO_ADMIN_EMAIL, DEMO_PARTICIPANT_EMAIL, DEMO_PASSWORD } from '@/lib/data/seed';

const DEMO_CREDENTIALS_VISIBLE = process.env.NODE_ENV !== 'production';

export default function HelpPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.help.title} subtitle={t.help.subtitle} />

      <div className="flex flex-col gap-4">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4 text-accent" aria-hidden />
              {t.help.dataTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-ink-muted">{t.help.dataBody}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="size-4 text-accent" aria-hidden />
              {t.help.contactTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-ink-muted">{t.help.contactBody}</p>
          </CardContent>
        </Card>
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

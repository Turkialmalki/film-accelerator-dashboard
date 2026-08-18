'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, ClipboardCopy, Download, ExternalLink, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import type { FormPublication } from '@/lib/data/types';

/**
 * Generates the QR client-side with the `qrcode` package — a real, scannable
 * code, not an image of one, and no third-party QR service is contacted.
 */
export function SharePanel({ publication }: { publication: FormPublication | null }) {
  const { t, locale } = useI18n();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = publication && origin ? `${origin}/${locale}/f/${publication.slug}` : '';

  useEffect(() => {
    if (!link) {
      setDataUrl(null);
      return;
    }
    void QRCode.toDataURL(link, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0F2837', light: '#FFFFFF' },
    }).then(setDataUrl);
  }, [link]);

  if (!publication) {
    return <EmptyState icon={<QrCode />} title={t.forms.publishHint} body={t.forms.noForms} />;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        <h3 className="text-base font-semibold text-ink">{t.forms.publishTitle}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t.forms.publishHint}</p>

        <label className="mt-5 block text-sm font-medium text-ink" htmlFor="shareLink">
          {t.forms.shareLink}
        </label>
        <div className="mt-1.5 flex gap-2">
          <Input id="shareLink" readOnly dir="ltr" value={link} className="font-mono text-xs" />
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
            {copied ? t.common.copied : t.common.copy}
          </Button>
        </div>

        <Button variant="ghost" size="sm" className="mt-3" asChild>
          <a href={link} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden />
            {t.common.open}
          </a>
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface-muted/40 p-5">
        <p className="text-sm font-medium text-ink">{t.forms.qrCode}</p>
        {dataUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- a runtime
             data: URL cannot be served through next/image's optimiser. */
          <img
            src={dataUrl}
            alt={t.forms.qrCode}
            width={200}
            height={200}
            className="rounded-md border border-line bg-white"
          />
        ) : (
          <div className="size-[200px] animate-pulse rounded-md bg-surface-muted" />
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={!dataUrl}
          onClick={() => {
            if (!dataUrl) return;
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `${publication.slug}-qr.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
        >
          <Download aria-hidden />
          {t.forms.downloadQr}
        </Button>
      </div>
    </div>
  );
}

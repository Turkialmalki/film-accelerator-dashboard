'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/shell/icon';
import { useI18n } from '@/components/providers/locale-provider';
import { TEMPLATES } from '@/lib/forms/templates';
import type { FormTemplateKey } from '@/lib/data/types';

export function TemplateChooser({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (key: FormTemplateKey) => void;
}) {
  const { t, b, dir } = useI18n();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t.forms.chooseTemplate}</DialogTitle>
          <DialogDescription>{t.forms.templateHint}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TEMPLATES.map((template) => (
              <li key={template.key}>
                <button
                  type="button"
                  onClick={() => onChoose(template.key)}
                  className="group flex h-full w-full flex-col rounded-lg border border-line bg-surface p-4 text-start transition-colors hover:border-accent hover:bg-accent-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="flex size-9 items-center justify-center rounded-md bg-accent-soft text-accent">
                    <Icon name={template.icon} className="size-4" />
                  </span>
                  <span className="mt-3 text-sm font-semibold text-ink">{b(template.title)}</span>
                  <span className="mt-1 flex-1 text-xs leading-relaxed text-ink-muted">
                    {b(template.description)}
                  </span>
                  <span className="mt-3 text-[11px] text-ink-subtle">{b(template.summary)}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                    {t.forms.useTemplate}
                    <Arrow className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

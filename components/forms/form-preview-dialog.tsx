'use client';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/components/providers/locale-provider';
import type { Form, FormField, FormRule, Team } from '@/lib/data/types';
import { FormFiller } from './form-filler';

export function FormPreviewDialog({
  open,
  onOpenChange,
  form,
  fields,
  rules,
  teams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Form;
  fields: FormField[];
  rules: FormRule[];
  teams: Team[];
}) {
  const { t, b } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{b(form.title)}</DialogTitle>
          <DialogDescription>{t.common.preview}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Nothing is written in preview: previewOnly short-circuits both the
              autosave and the submit path. */}
          {open ? (
            <FormFiller form={form} fields={fields} rules={rules} teams={teams} previewOnly />
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

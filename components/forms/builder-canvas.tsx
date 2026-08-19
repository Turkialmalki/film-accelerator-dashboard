'use client';

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { ArrowDown, ArrowUp, Copy, GripVertical, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { Icon } from '@/components/shell/icon';
import { useI18n } from '@/components/providers/locale-provider';
import { FIELD_TYPE_MAP } from '@/lib/forms/field-types';
import type { FormField, FormRule } from '@/lib/data/types';
import { cn } from '@/lib/utils';

export function BuilderCanvas({
  fields,
  rules,
  selectedId,
  onSelect,
  onDuplicate,
  onRemove,
  onMove,
}: {
  fields: FormField[];
  rules: FormRule[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-64 rounded-lg border border-dashed p-3 transition-colors',
        isOver ? 'border-accent bg-accent-soft/40' : 'border-line',
      )}
    >
      {fields.length === 0 ? (
        <EmptyState title={t.forms.emptyCanvas} body={t.forms.dragHint} />
      ) : (
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {fields.map((field, index) => (
              <CanvasField
                key={field.id}
                field={field}
                index={index}
                total={fields.length}
                selected={selectedId === field.id}
                ruleCount={rules.filter((r) => r.target_field_id === field.id).length}
                onSelect={() => onSelect(field.id)}
                onDuplicate={() => onDuplicate(field.id)}
                onRemove={() => onRemove(field.id)}
                onMove={(direction) => onMove(field.id, direction)}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </div>
  );
}

function CanvasField({
  field,
  index,
  total,
  selected,
  ruleCount,
  onSelect,
  onDuplicate,
  onRemove,
  onMove,
}: {
  field: FormField;
  index: number;
  total: number;
  selected: boolean;
  ruleCount: number;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { t, b } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const meta = FIELD_TYPE_MAP[field.type];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-start gap-2 rounded-md border bg-surface p-3 transition-colors',
        selected ? 'border-accent ring-2 ring-accent/20' : 'border-line hover:border-line-strong',
        isDragging && 'z-10 opacity-80 shadow-lift',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`${t.common.sort}: ${b(field.label)}`}
        className="mt-0.5 cursor-grab rounded p-1 text-ink-subtle hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-start">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name={meta.icon} className="size-3.5 text-ink-subtle" />
          <span className="truncate text-sm font-medium text-ink">
            {b(field.label) || meta.label.en}
          </span>
          {field.required ? (
            <Badge tone="danger" className="px-1.5 py-0 text-[10px]">
              {t.common.required}
            </Badge>
          ) : null}
          {ruleCount ? (
            <Badge tone="info" className="px-1.5 py-0 text-[10px]">
              {t.forms.conditional}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {b(meta.label)}
          {field.options.length ? ` · ${field.options.length}` : ''}
        </p>
      </button>

      {/* Always visible: hover-only actions are unreachable on touch, and this
          is a builder tool, not decoration — see spec's "no hover-only
          essential actions" rule. */}
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={t.forms.moveUp}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={t.forms.moveDown}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onSelect} aria-label={t.forms.fieldSettings}>
          <Settings2 aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label={t.forms.duplicateField}>
          <Copy aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t.forms.removeField}>
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}

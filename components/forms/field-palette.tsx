'use client';

import { useDraggable } from '@dnd-kit/core';
import { Icon } from '@/components/shell/icon';
import { useI18n } from '@/components/providers/locale-provider';
import { FIELD_GROUPS, FIELD_TYPES } from '@/lib/forms/field-types';
import type { FieldType } from '@/lib/data/types';
import { cn } from '@/lib/utils';

/**
 * The palette. Each entry is draggable onto the canvas and also activates on
 * Enter or Space, which appends it to the end — so the builder is fully
 * operable without a pointer.
 */
export function FieldPalette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  const { t, b } = useI18n();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.forms.palette}</h3>
        <p className="mt-1 text-xs text-ink-subtle">{t.forms.dragHint}</p>
      </div>

      {FIELD_GROUPS.map((group) => {
        const items = FIELD_TYPES.filter((meta) => meta.group === group.key);
        if (!items.length) return null;
        return (
          <div key={group.key}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              {b(group.label)}
            </p>
            <ul className="flex flex-col gap-1">
              {items.map((meta) => (
                <li key={meta.type}>
                  <PaletteItem
                    type={meta.type}
                    icon={meta.icon}
                    label={b(meta.label)}
                    onAdd={() => onAdd(meta.type)}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function PaletteItem({
  type,
  icon,
  label,
  onAdd,
}: {
  type: FieldType;
  icon: string;
  label: string;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: 'palette', type },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onAdd}
      {...listeners}
      {...attributes}
      className={cn(
        'flex w-full cursor-grab items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-start text-sm text-ink-muted transition-colors hover:border-line hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <Icon name={icon} className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

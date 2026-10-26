import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from '../../ui/icons';
import { quantityWithUnit } from '../../shared/units';
import { cn } from '../../ui/cn';

export interface PackMember {
  key: string;
  name: string;
  quantity: number;
  unit?: string;
}

/**
 * Что лежит в прессе или упаковке — списком по нажатию.
 *
 * Раскрывающийся список, а не окно: состав короткий (размерный ряд, десяток
 * строк), и читать его удобнее рядом со строкой, которую он объясняет.
 */
export function PackContents({ label, members, className }: { label: string; members: PackMember[]; className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (members.length === 0) return null;
  const units = new Set(members.map((member) => member.unit ?? ''));
  const total = members.reduce((sum, member) => sum + member.quantity, 0);
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex min-h-8 items-center gap-1 self-start rounded-[var(--radius-small)] text-caption font-semibold text-accent-ink',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        {label}
        <ChevronDown aria-hidden="true" className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <ul id={listId} hidden={!open} data-testid="pack-contents"
        className="m-0 flex list-none flex-col gap-0.5 rounded-[var(--radius-control)] bg-sunk p-2.5 text-caption text-ink">
        {members.map((member) => (
          <li key={member.key} className="flex justify-between gap-3">
            <span className="min-w-0">{member.name}</span>
            <span className="shrink-0 tabular-nums">
              {member.unit ? quantityWithUnit(member.quantity, member.unit) : member.quantity}
            </span>
          </li>
        ))}
        {/* Итог — только когда единица одна: «всего 5 шт» из штук и килограммов не складывается. */}
        {units.size === 1 && members.length > 1 ? (
          <li className="mt-1 flex justify-between gap-3 border-t border-hairline pt-1 font-semibold">
            <span>{t('pack.total')}</span>
            <span className="tabular-nums">
              {members[0].unit ? quantityWithUnit(total, members[0].unit) : total}
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Участник пресса с сервера — в строку списка: вариант после названия. */
export function packMembers(pack: { itemId?: string; name: string; variantLabel?: string; quantity: number; unit?: string }[]): PackMember[] {
  return pack.map((member, index) => ({
    key: member.itemId ?? `${member.name}-${index}`,
    name: member.variantLabel ? `${member.name} · ${member.variantLabel}` : member.name,
    quantity: member.quantity,
    unit: member.unit,
  }));
}

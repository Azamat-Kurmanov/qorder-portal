import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';
import type { CartLineDtoMode } from '../../api/generated';

export type SaleMode = CartLineDtoMode;

const MODES: SaleMode[] = ['RETAIL', 'WHOLESALE'];

/**
 * «В розницу / Оптом» — у позиции, которая продаётся и так, и так (backend.md §18.32).
 * Две кнопки с `aria-pressed`, как отбор «канала» в каталоге: вариантов два, меню ради них — лишнее нажатие.
 * `notes` — вторая строка под словом (цена в карточке); в корзине её нет.
 */
export function ModeSwitch({ value, onChange, disabled, notes, className }: {
  value: SaleMode;
  onChange: (mode: SaleMode) => void;
  disabled?: boolean;
  notes?: Record<SaleMode, ReactNode>;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('cart.mode.label')}
      className={cn('grid grid-cols-2 rounded-[var(--radius-control)] border-[1.5px] border-line bg-surface p-0.5', className)}>
      {MODES.map((mode) => (
        <button key={mode} type="button" aria-pressed={value === mode} disabled={disabled}
          onClick={() => { if (value !== mode) onChange(mode); }}
          className={cn(
            'flex min-h-10 flex-col items-center justify-center rounded-[calc(var(--radius-control)-2px)] px-2 py-1 text-sm font-semibold',
            'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60',
            value === mode ? 'bg-accent text-on-accent' : 'text-ink-muted hover:text-ink',
          )}>
          {t(`cart.mode.${mode}`)}
          {notes ? <span className="text-caption font-normal tabular-nums">{notes[mode]}</span> : null}
        </button>
      ))}
    </div>
  );
}

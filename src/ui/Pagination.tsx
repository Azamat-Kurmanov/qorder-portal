import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';
import { pageItems } from './pageItems';

/**
 * Нижняя строка длинного списка — по макету «Постраничная навигация».
 *
 * Слева — что показано и сколько на странице, по центру — номера
 * (не больше семи кнопок), справа — «Перейти к», когда страниц больше
 * десяти: листать до тринадцатой по одной никто не станет. На телефоне
 * номера сжимаются в «13 / 25» — ряд кнопок там не помещается.
 *
 * Страница в пропсах и в `onPage` — с нуля, как в запросах к серверу;
 * человеку она показывается с единицы.
 */
export function Pagination({
  page,
  size,
  total,
  sizes,
  onPage,
  onSize,
  label,
}: {
  page: number;
  size: number;
  total: number;
  /** Варианты «На странице»; без них выбора нет. */
  sizes?: number[];
  onPage: (page: number) => void;
  onSize?: (size: number) => void;
  /** Имя навигации для диктора: на экране бывает не один список. */
  label: string;
}) {
  const { t } = useTranslation();
  const count = Math.ceil(total / size);
  const picker = sizes && onSize ? <SizePicker size={size} sizes={sizes} onSize={onSize} /> : null;
  if (count <= 1) {
    // Страница одна, но выбор размера остаётся, если список длиннее самого
    // малого размера: выбравший «50» иначе не вернулся бы к «10».
    if (!picker || total <= Math.min(...sizes!)) return null;
    return <div className="flex justify-end px-1 text-caption text-ink-subtle">{picker}</div>;
  }

  const current = Math.min(page, count - 1) + 1;
  const from = (current - 1) * size + 1;
  const to = Math.min(total, current * size);
  const go = (next: number) => onPage(Math.min(Math.max(next, 1), count) - 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-caption text-ink-subtle">
      <div className="flex flex-wrap items-center gap-3">
        <span>{t('pager.shown', { from, to, total })}</span>
        {picker}
      </div>

      <nav aria-label={label} className="flex items-center gap-1">
        <PageButton label={t('pager.prev')} disabled={current === 1} onClick={() => go(current - 1)}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">{t('pager.prev')}</span>
        </PageButton>

        {/* Телефон: ряд из семи кнопок там переносится — хватает «13 / 25». */}
        <span className="px-2 font-bold text-ink tabular-nums sm:hidden">
          {t('pager.compact', { page: current, count })}
        </span>

        {pageItems(current, count).map((item, index) => (item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden="true" className="hidden min-w-6 text-center sm:inline">…</span>
        ) : (
          <PageButton
            key={item}
            label={t('pager.page', { page: item })}
            current={item === current}
            className="hidden sm:inline-flex"
            onClick={() => go(item)}
          >
            {item}
          </PageButton>
        )))}

        <PageButton label={t('pager.next')} disabled={current === count} onClick={() => go(current + 1)}>
          <span className="hidden sm:inline">{t('pager.next')}</span>
          <ChevronRight aria-hidden="true" className="size-4" />
        </PageButton>
      </nav>

      {count > 10 ? <GoTo count={count} current={current} onGo={go} /> : <span className="hidden sm:block" />}
    </div>
  );
}

function SizePicker({ size, sizes, onSize }: { size: number; sizes: number[]; onSize: (size: number) => void }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <span className="flex items-center gap-2">
      <label htmlFor={id}>{t('pager.perPage')}</label>
      <select
        id={id}
        value={size}
        onChange={(event) => onSize(Number(event.currentTarget.value))}
        className="h-9 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 text-caption text-ink focus:border-accent focus:outline-none"
      >
        {sizes.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </span>
  );
}

function GoTo({ count, current, onGo }: { count: number; current: number; onGo: (page: number) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [value, setValue] = useState('');
  return (
    <span className="flex items-center gap-2">
      <label htmlFor={id}>{t('pager.goTo')}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={count}
        value={value}
        placeholder={String(current)}
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || !value) return;
          onGo(Number(value));
          setValue('');
        }}
        className="h-9 w-16 rounded-[var(--radius-control)] border border-line bg-surface px-2 text-caption text-ink tabular-nums focus:border-accent focus:outline-none"
      />
      <span className="hidden lg:inline">{t('pager.ofPages', { page: current, count })}</span>
    </span>
  );
}

function PageButton({ label, current, disabled, className, onClick, children }: {
  label: string;
  current?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1 rounded-[var(--radius-control)] px-2 text-caption font-medium tabular-nums',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:cursor-default disabled:opacity-35',
        current ? 'bg-accent-soft font-bold text-accent-ink' : 'text-ink-muted hover:bg-sunk hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

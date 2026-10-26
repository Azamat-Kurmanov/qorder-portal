import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, Search } from '../../ui/icons';
import { cn } from '../../ui/cn';
import { hoursNow } from './shopHours';
import { ShopTile, useShops } from './Shops';

/**
 * «Поставщики» на мониторе — по макету ПК-К2.6: все магазины клиента карточками
 * в две колонки, поиск, отбор «Открыты сейчас» и приглашение своего поставщика.
 *
 * Окно «Мои магазины» остаётся: сменить магазин из шапки — дело полсекунды.
 * Страница — для обзора: где что открыто, где лежит корзина, где новости.
 * Отборов «С акциями» и «Ждут ответа» нет — список магазинов о них не знает.
 */
export function SuppliersPage({ onSwitch, onInvite }: {
  onSwitch: (supplierId: string) => void;
  /** Нет — нет и кнопки: сотрудник на своей витрине никого не приглашает. */
  onInvite?: () => void;
}) {
  const { t } = useTranslation();
  const { list, supplierId, unreadOf } = useShops();
  const [query, setQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(false);

  const rows = list.map((supplier) => ({ supplier, now: hoursNow(supplier.hours, t) }));
  const openCount = rows.filter((row) => row.now?.open).length;
  const needle = query.trim().toLowerCase();
  const shown = rows.filter(({ supplier, now }) => (!openOnly || now?.open)
    && (!needle || [supplier.name, supplier.tagline, supplier.address].some((text) => text?.toLowerCase().includes(needle))));

  const chip = (on: boolean, label: string, count: number, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] px-3.5 text-sm font-semibold',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        on ? 'bg-ink text-on-ink' : 'bg-surface text-ink hover:shadow-[0_0_0_1px_var(--color-line)]',
      )}
    >
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[1.875rem] font-extrabold tracking-[-0.02em] text-ink">{t('shops.page.title')}</h1>
          <p className="text-[0.9375rem] text-ink-muted">{t('shops.page.note', { count: list.length })}</p>
        </div>
        <label className="ml-auto flex h-12 w-[21.25rem] cursor-text items-center gap-2.5 rounded-[0.875rem] bg-surface px-3.5 focus-within:ring-2 focus-within:ring-accent">
          <Search aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
          <span className="sr-only">{t('shops.search')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t('shops.page.search')}
            className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink-subtle"
          />
        </label>
        {onInvite && (
          <button
            type="button"
            onClick={onInvite}
            className="flex h-13 items-center gap-2 rounded-2xl bg-accent px-5 text-base font-extrabold text-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <Plus aria-hidden="true" className="size-5" />
            {t('referral.invite')}
          </button>
        )}
      </div>

      <div role="group" aria-label={t('shops.page.filters')} className="flex gap-2">
        {chip(!openOnly, t('shops.allKind'), list.length, () => setOpenOnly(false))}
        {chip(openOnly, t('shops.page.openNow'), openCount, () => setOpenOnly(true))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[1.25rem] bg-surface px-4 py-7 text-center text-body leading-normal text-ink-muted">
          {needle ? t('shops.nothing') : t('shops.page.noneOpen')}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-5">
          {shown.map(({ supplier, now }) => {
            const current = supplier.supplierId === supplierId;
            const unread = unreadOf(supplier.supplierId);
            const lines = supplier.cartLines ?? 0;
            return (
              <li key={supplier.supplierId}>
                <button
                  type="button"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => onSwitch(supplier.supplierId)}
                  className={cn(
                    'flex size-full flex-col gap-3 rounded-[1.25rem] bg-surface p-4 text-left',
                    'transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    current ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]' : 'hover:shadow-[inset_0_0_0_1.5px_var(--color-line)]',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <ShopTile supplier={supplier} initials className="size-13 rounded-2xl text-[1.0625rem]" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-base font-bold text-ink">{supplier.name}</span>
                      <span className="truncate text-[0.8125rem] text-ink-muted">
                        {supplier.tagline}
                        {supplier.tagline && now ? ' · ' : null}
                        {now && <span className={cn('font-semibold', now.open && 'text-accent-ink')}>{now.short}</span>}
                      </span>
                    </span>
                    {current && (
                      <span className="flex h-6 shrink-0 items-center rounded-[var(--radius-pill)] bg-sunk px-2.5 text-xs font-bold text-ink">
                        {t('shops.here')}
                      </span>
                    )}
                  </span>
                  {supplier.address && (
                    <span className="flex items-center gap-2 text-[0.8125rem] text-ink-muted">
                      <MapPin aria-hidden="true" className="size-4 shrink-0" />
                      <span className="truncate">{supplier.address}</span>
                    </span>
                  )}
                  {(unread > 0 || lines > 0) && (
                    <span className="flex flex-wrap gap-1.5">
                      {lines > 0 && (
                        <span className="flex h-6 items-center rounded-[var(--radius-pill)] bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                          {t('shops.inCart', { count: lines })}
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="flex h-6 items-center rounded-[var(--radius-pill)] bg-sunk px-2.5 text-xs font-bold text-ink">
                          {t('shops.news', { count: unread })}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

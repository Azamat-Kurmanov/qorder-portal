import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from '../../ui/icons';
import { BackTitle } from '../../ui/BackTitle';
import { InvitesSection } from './Invitations';
import { cn } from '../../ui/cn';
import { hoursNow } from './shopHours';
import { ShopTile, useShops } from './Shops';
import { ShopActions } from './ShopActions';
import { useShopMemory } from '../../supplier/shopMemory';

/**
 * «Поставщики» на мониторе — по макету ПК-К2.6: все магазины клиента карточками
 * в две колонки, поиск, отбор «Открыты сейчас» и приглашение своего поставщика.
 *
 * Окно «Мои магазины» остаётся: сменить магазин из шапки — дело полсекунды.
 * Страница — для обзора: где что открыто, где лежит корзина, где новости.
 * Отборов «С акциями» и «Ждут ответа» нет — список магазинов о них не знает.
 */
export function SuppliersPage({ onSwitch, onInvite, back = true }: {
  onSwitch: (supplierId: string) => void;
  /** Нет — нет и кнопки: сотрудник на своей витрине никого не приглашает. */
  onInvite?: () => void;
  /** Без «Назад» — во «Всех магазинах», где внизу своё меню раздела. */
  back?: boolean;
}) {
  const { t } = useTranslation();
  const { list, supplierId, unreadOf } = useShops();
  const [query, setQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(false);

  const rows = list.map((supplier) => ({ supplier, now: hoursNow(supplier.hours, t) }));
  const openCount = rows.filter((row) => row.now?.open).length;
  const needle = query.trim().toLowerCase();
  const matches = rows.filter(({ supplier, now }) => (!openOnly || now?.open)
    && (!needle || [supplier.name, supplier.tagline, supplier.address].some((text) => text?.toLowerCase().includes(needle))));
  // Скрытые — свёрнутой группой внизу (решение владельца 2026-10-30); поиск находит и их.
  const shown = needle ? matches : matches.filter(({ supplier }) => !supplier.hidden);
  const hiddenRows = needle ? [] : matches.filter(({ supplier }) => supplier.hidden);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const { pinned } = useShopMemory();

  const chip = (on: boolean, label: string, count: number, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl border-[3px] border-solid px-3.5 text-body font-extrabold',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        on ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink hover:border-ink',
      )}
    >
      {label}
      <span className="tabular-nums">· {count}</span>
    </button>
  );

  const card = ({ supplier, now }: (typeof rows)[number]) => {
    const current = supplier.supplierId === supplierId;
    const unread = unreadOf(supplier.supplierId);
    const lines = supplier.cartLines ?? 0;
    const isPinned = pinned.includes(supplier.supplierId);
    return (
      <li key={supplier.supplierId}
        className={cn('flex items-start gap-3 rounded-[var(--radius-card)] border-2 border-solid bg-surface p-3',
          current ? 'border-shop' : 'border-hairline')}>
        <button
          type="button"
          aria-current={current ? 'true' : undefined}
          onClick={() => onSwitch(supplier.supplierId)}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ShopTile supplier={supplier} initials className="size-14 shrink-0 rounded-2xl text-title" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="text-lead font-extrabold leading-tight text-ink">
              {supplier.name}
            </b>
            {supplier.tagline ? <span className="truncate text-caption text-ink-muted">{supplier.tagline}</span> : null}
            {now ? <span className={cn('text-caption font-bold', now.open ? 'text-ok-ink' : 'text-hit-ink')}>{now.short}</span> : null}
            {(current || unread > 0 || lines > 0) && (
              <span className="mt-0.5 flex flex-wrap gap-1">
                {current ? <span className={PILL + ' bg-ok-soft text-ok-ink'}>{t('shops.here')}</span> : null}
                {unread > 0 ? <span className={PILL + ' bg-sale text-on-sale'}>{t('shops.news', { count: unread })}</span> : null}
                {lines > 0 ? <span className={PILL + ' bg-hit-soft text-hit-ink'}>{t('shops.inCart', { count: lines })}</span> : null}
              </span>
            )}
          </span>
        </button>
        <span className="shrink-0 rounded-[0.875rem] border-2 border-solid border-line">
          <ShopActions supplier={supplier} pinned={isPinned}
            others={list.filter((one) => one.supplierId !== supplier.supplierId && !one.hidden)} />
        </span>
      </li>
    );
  };

  const visible = [...shown, ...(hiddenOpen ? hiddenRows : [])];
  // Закреплённые — своей группой сверху, как в макете; при поиске — одним списком.
  const top = needle ? [] : visible.filter(({ supplier }) => pinned.includes(supplier.supplierId));
  const rest = visible.filter((row) => !top.includes(row));
  const group = (title: string | null, list: typeof rows) => list.length === 0 ? null : (
    <section aria-label={title ?? undefined} className="flex flex-col gap-2.5">
      {title ? <h2 className="m-0 mt-1 text-lead font-extrabold text-ink-muted">{title}</h2> : null}
      <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-2.5 p-0 lg:grid-cols-2 lg:gap-4">{list.map(card)}</ul>
    </section>
  );

  return (
    <div className="flex flex-col gap-3 pb-4">
      <BackTitle title={t('shops.title')} subtitle={t('shops.page.note', { count: list.length })} back={back} />

      <InvitesSection onAccepted={onSwitch} />

      <label className="flex h-14 items-center gap-3 rounded-[var(--radius-control)] border-2 border-solid border-line bg-surface px-4 focus-within:border-shop lg:max-w-xl">
        <Search aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
        <span className="sr-only">{t('shops.search')}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t('shops.searchPlaceholder')}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-subtle"
        />
      </label>

      {list.length > 1 && (
        <div role="group" aria-label={t('shops.page.filters')} className="flex gap-2">
          {chip(!openOnly, t('shops.allKind'), list.length, () => setOpenOnly(false))}
          {chip(openOnly, t('shops.page.openNow'), openCount, () => setOpenOnly(true))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border-2 border-dashed border-line px-4 py-7 text-center text-body leading-normal text-ink-muted">
          {needle ? t('shops.nothing') : t('shops.page.noneOpen')}
        </p>
      ) : (
        <>
          {group(top.length > 0 ? t('shops.pinned') : null, top)}
          {group(top.length > 0 ? t('shops.rest') : null, rest)}
        </>
      )}
      {hiddenRows.length > 0 && (
        <button
          type="button"
          aria-expanded={hiddenOpen}
          onClick={() => setHiddenOpen((was) => !was)}
          className="self-start cursor-pointer bg-transparent py-2 text-base font-bold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t('shops.hidden', { count: hiddenRows.length })}
        </button>
      )}
      {onInvite && (
        <button
          type="button"
          onClick={onInvite}
          className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border-2 border-solid border-shop bg-surface text-lead font-extrabold text-shop-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:self-start lg:px-6"
        >
          <Plus aria-hidden="true" className="size-5" />
          {t('more.inviteSupplier')}
        </button>
      )}
    </div>
  );
}

const PILL = 'inline-flex h-6 items-center rounded-full px-2.5 text-caption font-extrabold';

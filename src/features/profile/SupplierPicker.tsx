import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useGetPortalSuppliers, useGetPortalUnreadSummary, type PortalSupplierDto } from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { useLogoutConfirm } from '../shell/LogoutConfirm';
import { entryChooseUrl } from '../../auth/oidcConfig';
import { ShopTile } from '../shell/Shops';
import { InvitesSection, usePendingInvitations } from '../shell/Invitations';
import { SectionHead } from '../shell/SectionHead';
import { hoursNow } from '../shell/shopHours';
import { cn } from '../../ui/cn';
import { MapPin, Search } from '../../ui/icons';

/**
 * Выбор поставщика — то, что показывает RequireSupplier, пока поставщик не выбран
 * (или выбор отозван): поиск, отборы и карточки с часами, адресом и тем, что ждёт клиента.
 * Профиль («Вариант Б») списка больше не держит — он на «Мои магазины».
 */
export function SupplierPicker() {
  const { t } = useTranslation();
  const suppliers = useGetPortalSuppliers();
  const { supplierId, select } = useSupplier();
  const logoutAsk = useLogoutConfirm();
  const chooseHref = entryChooseUrl();

  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];
  const hasInvites = usePendingInvitations().length > 0;

  const summary = useGetPortalUnreadSummary();
  const unreadOf = (id: string) => (summary.data?.status === 200 ? summary.data.data : [])
    .find((row) => row.supplierId === id)?.unread ?? 0;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SupplierFilter>('all');
  const needle = query.trim().toLocaleLowerCase();
  const passes = (supplier: PortalSupplierDto, key: SupplierFilter) => {
    if (key === 'open') return hoursNow(supplier.hours, t)?.open === true;
    if (key === 'news') return unreadOf(supplier.supplierId) > 0;
    if (key === 'cart') return (supplier.cartLines ?? 0) > 0;
    return true;
  };
  const shown = list.filter((supplier) => passes(supplier, filter)
    && (!needle || supplier.name.toLocaleLowerCase().includes(needle) || (supplier.tagline ?? '').toLocaleLowerCase().includes(needle)));

  return (
    <div className="flex flex-col gap-4">
      <SectionHead title={t('profile.title')} subtitle={list.length > 0 ? t('profile.count', { count: list.length }) : undefined} />

      {/* Приглашения — над поиском и отборами: это единственное здесь, что ждёт ответа. Принятый магазин сразу выбран. */}
      <InvitesSection onAccepted={select} />

      {list.length === 0 && !hasInvites && (
        <p className="text-ink-subtle">{t('profile.empty')}</p>
      )}

      {list.length > 3 && (
        <label className="relative flex items-center">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 size-5 text-ink-faint" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder={t('shops.searchPlaceholder')} aria-label={t('shops.search')}
            className="h-14 w-full rounded-[var(--radius-control)] border-2 border-field-line bg-surface pl-11 pr-3 text-base text-ink placeholder:text-ink-subtle focus:border-shop focus:ring-1 focus:ring-shop focus:outline-none" />
        </label>
      )}

      {list.length > 1 && (
        <div role="group" aria-label={t('profile.filters.label')} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
          {SUPPLIER_FILTERS.map((key) => {
            const count = list.filter((supplier) => passes(supplier, key)).length;
            if (key !== 'all' && count === 0) return null;
            const active = filter === key;
            return (
              <button key={key} type="button" aria-pressed={active} onClick={() => setFilter(key)}
                className={cn(
                  'inline-flex min-h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl border-[3px] border-solid px-3.5 text-body font-extrabold',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  active ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink',
                )}>
                {t(`profile.filters.${key}`)}
                <span className="tabular-nums">· {count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:gap-5">
        {shown.map((supplier) => (
          <SupplierCard key={supplier.supplierId} supplier={supplier} current={supplier.supplierId === supplierId}
            unread={unreadOf(supplier.supplierId)} onSelect={() => select(supplier.supplierId)} />
        ))}
      </div>

      {chooseHref ? (
        <a href={chooseHref} className="self-start min-h-11 py-3 text-sm font-semibold text-accent-ink underline-offset-4 hover:underline">
          {t('profile.switchCabinet')}
        </a>
      ) : null}
      <Button variant="outline" onClick={logoutAsk.ask}>{t('profile.logout')}</Button>
      {logoutAsk.sheet}
    </div>
  );
}

const SUPPLIER_FILTERS = ['all', 'open', 'news', 'cart'] as const;
type SupplierFilter = (typeof SUPPLIER_FILTERS)[number];

/** Карточка поставщика: кто, чем торгует, открыт ли, где — и что ждёт клиента у него. */
function SupplierCard({ supplier, current, unread, onSelect }: {
  supplier: PortalSupplierDto;
  current: boolean;
  unread: number;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const live = hoursNow(supplier.hours, t);
  const cart = supplier.cartLines ?? 0;
  return (
    <Card data-testid="supplier-row" className={cn('flex flex-col gap-3 p-4', current && 'border-shop')}>
      <div className="flex items-center gap-3">
        <ShopTile supplier={supplier} className="size-[3.25rem] rounded-2xl text-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-bold text-ink">{supplier.name}</span>
          <span className="truncate text-caption text-ink-muted">
            {[supplier.tagline, live?.short].filter(Boolean).join(' · ')}
          </span>
        </div>
        {current ? (
          <span className="inline-flex h-6 shrink-0 items-center rounded-[var(--radius-pill)] bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
            {t('profile.selected')}
          </span>
        ) : (
          <Button className="shrink-0 px-4" onClick={onSelect}>{t('profile.switch')}</Button>
        )}
      </div>
      {supplier.address && (
        <span className="flex items-center gap-2 text-caption text-ink-muted">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{supplier.address}</span>
        </span>
      )}
      {(unread > 0 || cart > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {/* Ноль не рисуется — пустая пилюля читается как неполадка. */}
          {unread > 0 && (
            <span role="img" aria-label={t('profile.unread', { count: unread })}
              className="inline-flex h-6 items-center rounded-[var(--radius-pill)] bg-sale-soft px-2.5 text-xs font-bold text-sale-ink">
              {t('shops.news', { count: unread })}
            </span>
          )}
          {cart > 0 && (
            <span className="inline-flex h-6 items-center rounded-[var(--radius-pill)] bg-sage-soft px-2.5 text-xs font-bold text-accent-ink">
              {t('shops.inCart', { count: cart })}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

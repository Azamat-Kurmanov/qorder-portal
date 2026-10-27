import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useGetPortalSuppliers, useGetPortalUnreadSummary, type PortalSupplierDto } from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { useAuth } from '../../auth/useAuth';
import { entryChooseUrl } from '../../auth/oidcConfig';
import { CompanyBlock } from './CompanyBlock';
import { PromoSubscription } from './PromoSubscription';
import { PushBlock } from './PushBlock';
import { ConsentsBlock } from './ConsentsBlock';
import { ShopTile } from '../shell/Shops';
import { SectionHead } from '../shell/SectionHead';
import { hoursNow } from '../shell/shopHours';
import { cn } from '../../ui/cn';
import { MapPin, Search } from '../../ui/icons';
import { InviteSupplierBlock } from '../referral/InviteSupplierBlock';

/**
 * Профиль: с кем клиент работает и как переключиться.
 *
 * Переключатель здесь, а не в шапке каждого экрана: поставщиков у большинства
 * один, и постоянный выбор на виду создавал бы вопрос там, где его нет.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const suppliers = useGetPortalSuppliers();
  const { supplierId, select } = useSupplier();
  const { logout } = useAuth();
  const chooseHref = entryChooseUrl();

  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];

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
      {/* Список поставщиков — по макетам К2.19 и ПК-К2.6: поиск, отборы и карточки
          с часами, адресом и тем, что ждёт клиента у каждого. */}
      <SectionHead title={t('profile.title')} subtitle={list.length > 0 ? t('profile.count', { count: list.length }) : undefined} />

      {list.length === 0 && (
        <p className="text-ink-subtle">{t('profile.empty')}</p>
      )}

      {list.length > 3 && (
        <label className="relative flex items-center">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 size-5 text-ink-faint" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder={t('shops.searchPlaceholder')} aria-label={t('shops.search')}
            className="h-12 w-full rounded-[0.875rem] border-0 bg-surface pl-11 pr-3 text-[0.9375rem] text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent" />
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
                  'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] px-3.5 text-sm font-semibold',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  active ? 'bg-ink text-on-ink' : 'bg-surface text-ink',
                )}>
                {t(`profile.filters.${key}`)}
                <span className="opacity-60">{count}</span>
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

      <PromoSubscription />

      <PushBlock />

      <InviteSupplierBlock />

      {/*
        Согласия здесь, а не отдельным разделом в рельсе: это справка о себе,
        за которой приходят раз в год, и место в постоянной навигации она
        занимала бы у экранов, которыми пользуются каждый день.
      */}
      <CompanyBlock />

      <ConsentsBlock />

      {/* На экран выбора «Кто вы?» единого входа; сессия здесь не закрывается. */}
      {chooseHref ? (
        <a href={chooseHref} className="self-start min-h-11 py-3 text-sm font-semibold text-accent-ink underline-offset-4 hover:underline">
          {t('profile.switchCabinet')}
        </a>
      ) : null}
      <Button variant="ghost" onClick={logout}>{t('profile.logout')}</Button>
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
    <Card
      data-testid="supplier-row"
      className={cn('flex flex-col gap-3 p-4', current && 'shadow-[inset_0_0_0_2px_var(--color-accent)]')}
    >
      <div className="flex items-center gap-3">
        <ShopTile supplier={supplier} className="size-[3.25rem] rounded-2xl text-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-bold text-ink">{supplier.name}</span>
          <span className="truncate text-[0.8125rem] text-ink-muted">
            {[supplier.tagline, live?.short].filter(Boolean).join(' · ')}
          </span>
        </div>
        {current ? (
          <span className="inline-flex h-6 shrink-0 items-center rounded-[var(--radius-pill)] bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
            {t('profile.selected')}
          </span>
        ) : (
          <Button variant="soft" className="h-10 shrink-0 px-4" onClick={onSelect}>{t('profile.switch')}</Button>
        )}
      </div>
      {supplier.address && (
        <span className="flex items-center gap-2 text-[0.8125rem] text-ink-muted">
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

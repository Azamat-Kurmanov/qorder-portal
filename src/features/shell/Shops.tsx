import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ChevronLeft, ChevronRight, Clock, Search, Star, X, Plus } from '../../ui/icons';
import { useWideScreen } from '../../ui/useWideScreen';
import {
  useGetPortalSuppliers,
  useGetPortalUnreadSummary,
  type PortalSupplierDto,
} from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { togglePin, useShopMemory } from '../../supplier/shopMemory';
import { cn } from '../../ui/cn';
import { ShopTile } from './ShopTile';
import { InvitesSection } from './Invitations';

export { ShopTile } from './ShopTile';


/**
 * Магазины клиента и то, что о каждом известно кабинету.
 *
 * Список тот же, что у темы и шапки, и кеш у них общий: спрашивать его
 * ради колонки второй раз незачем.
 */
export function useShops() {
  const { supplierId } = useSupplier();
  const suppliers = useGetPortalSuppliers();
  const summary = useGetPortalUnreadSummary();
  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];
  const rows = summary.data?.status === 200 ? summary.data.data : [];
  const current = list.find((supplier) => supplier.supplierId === supplierId);
  const unreadOf = (id: string) => rows.find((row) => row.supplierId === id)?.unread ?? 0;
  return { list, current, supplierId, unreadOf };
}

/**
 * Текущий магазин — для экранов внутри кабинета, а не для оболочки.
 *
 * Список поставщиков уже спрашивает оболочка, и экран берёт его из кеша,
 * не перезапрашивая при появлении. Иначе при сбое списка экран за
 * `RequireSupplier` уходил бы в круг: его появление перезапрашивает список,
 * `RequireSupplier` на время запроса прячет экран, запрос падает, экран
 * появляется снова — и так без конца.
 */
export function useCurrentShop(): PortalSupplierDto | undefined {
  const { supplierId } = useSupplier();
  const suppliers = useGetPortalSuppliers({ query: { refetchOnMount: false, retryOnMount: false } });
  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];
  return list.find((supplier) => supplier.supplierId === supplierId);
}

/**
 * Порядок в колонке: текущий, закреплённые, недавние.
 *
 * Остальными не добирается: подпись блока — «избранные и недавние», и
 * случайный магазин в нём читался бы как недавний. Не больше пяти строк:
 * колонка — это быстрый переход к своим, а весь список живёт в окне
 * «Мои магазины».
 */
function sideOrder(list: PortalSupplierDto[], currentId: string | null, pinned: string[], recent: string[]) {
  const ids: string[] = [];
  [currentId, ...pinned, ...recent].forEach((id) => {
    if (id && !ids.includes(id) && list.some((supplier) => supplier.supplierId === id)) ids.push(id);
  });
  return ids.slice(0, 5).map((id) => list.find((supplier) => supplier.supplierId === id)!);
}

/**
 * «Мои магазины» — в колонке под карточкой «Вы сейчас в».
 *
 * Магазинов у клиента бывает несколько, и у каждого свой каталог, цены
 * и корзина. Переключаться между ними приходится чаще, чем раз в месяц,
 * поэтому переход стоит на виду, а не в профиле. «Все мои магазины»
 * и приглашения здесь не повторяются: они в карточке прямо над блоком.
 */
export function MyShopsBlock({ onSwitch }: { onSwitch: (supplierId: string) => void }) {
  const { t } = useTranslation();
  const { list, supplierId, unreadOf } = useShops();
  const { pinned, recent } = useShopMemory();

  if (list.length === 0) return null;

  const rows = sideOrder(list, supplierId, pinned, recent);

  return (
    <section
      aria-labelledby="my-shops-title"
      className="flex flex-col gap-1 rounded-[calc(var(--radius-tile)*1.25)] bg-surface p-3 shadow-[0_0_0_1px_var(--color-hairline)]"
    >
      <div className="flex items-baseline justify-between gap-2 px-1 pb-1">
        <h2 id="my-shops-title" className="text-body font-extrabold text-ink">{t('shops.title')}</h2>
        <span className="text-xs text-ink-subtle">{t('shops.hint')}</span>
      </div>

      {rows.map((supplier) => {
        const current = supplier.supplierId === supplierId;
        return (
          <button
            key={supplier.supplierId}
            type="button"
            title={supplier.name}
            aria-current={current ? 'true' : undefined}
            onClick={() => onSwitch(supplier.supplierId)}
            className={cn(
              'flex min-h-13 w-full items-center gap-2.5 rounded-[var(--radius-control)] border-[1.5px] px-2 py-1.5 text-left',
              'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              current ? 'border-accent bg-bar' : 'border-transparent hover:bg-canvas',
            )}
          >
            <ShopTile supplier={supplier} className="size-[2.125rem] text-body" />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="truncate text-sm font-bold text-ink">{supplier.name}</span>
              <span className="truncate text-xs text-ink-muted">
                {current ? t('shops.youAreHere') : shopNote(supplier, unreadOf(supplier.supplierId), t)}
              </span>
            </span>
            {current && <Check aria-hidden="true" className="size-[18px] shrink-0 text-accent" />}
          </button>
        );
      })}
    </section>
  );
}

/**
 * Подпись строки магазина в колонке: «тип · в корзине N», как в макете.
 *
 * Новости важнее вида товаров — они ждут ответа; подпись продавца называет,
 * чем он торгует, — это полезнее приглашения открыть каталог, который и так
 * открывает клик. Начатая корзина дописывается к любой из них: ради неё
 * в чужой магазин и возвращаются.
 */
function shopNote(supplier: PortalSupplierDto, unread: number, t: TFunction): string {
  const lead = unread > 0 ? t('shops.news', { count: unread }) : supplier.tagline;
  const cart = supplier.cartLines && supplier.cartLines > 0
    ? t('shops.inCart', { count: supplier.cartLines })
    : undefined;
  const parts = [lead, cart].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(' · ') : t('shops.open');
}

/** Сравнение имён без «ИП» и «ТОО»: иначе все ИП собрались бы под буквой «И». */
function sortKey(name: string): string {
  return name.replace(/^(ИП|ТОО|АО|ЖШС|IP|LLP)\s*/iu, '').replace(/^[«"„]/u, '');
}

/**
 * Окно «Мои магазины»: поиск, закреплённые, недавние и все по алфавиту.
 *
 * Окно, а не отдельный экран: переход в другой магазин — действие на полсекунды,
 * и уходить ради него со страницы, на которой человек стоял, незачем.
 */
export function ShopsDialog({
  open,
  onOpenChange,
  onSwitch,
  onInvite,
  onShowAll,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitch: (supplierId: string) => void;
  /** «Пригласить своего поставщика» — последним пунктом; нет — пункта нет. */
  onInvite?: () => void;
  /** «Все поставщики страницей» — под заголовком; нет — ссылки нет. */
  onShowAll?: () => void;
}) {
  const { t } = useTranslation();
  const { list, supplierId, unreadOf } = useShops();
  const { pinned, recent } = useShopMemory();
  const [query, setQuery] = useState('');
  // «Все» — по умолчанию: фильтр по виду товаров не выбран, пока клиент
  // не нажал чип сам.
  const [kind, setKind] = useState<string>('all');
  // Телефон — экраном по макету «Мои магазины»: во весь экран, «Назад» слева; монитор — окном.
  const wide = useWideScreen();

  const needle = query.trim().toLowerCase();
  const searching = needle !== '';

  /**
   * Чипы вида товаров — по подписям продавцов.
   *
   * Чипов нет при одной подписи или без нёе вовсе: выбор из одного варианта
   * ничего не фильтрует, а лишняя строка над списком только мешает искать.
   */
  const kinds = useMemo(() => {
    const counts = new Map<string, number>();
    list.forEach((supplier) => {
      if (supplier.tagline) counts.set(supplier.tagline, (counts.get(supplier.tagline) ?? 0) + 1);
    });
    return [...counts.entries()];
  }, [list]);
  const showKinds = kinds.length >= 2;
  // Выбранный чип мог исчезнуть из списка — магазины того вида отфильтровались
  // поиском поставщиков или их подписи сменились у самих продавцов. Молчаливая
  // пустота хуже, чем откат к «Все»: под выбором должны остаться хоть какие-то
  // магазины.
  const active = kinds.some(([k]) => k === kind) ? kind : 'all';
  const filtered = showKinds && active !== 'all' ? list.filter((supplier) => supplier.tagline === active) : list;

  const byId = (id: string) => filtered.find((supplier) => supplier.supplierId === id);

  const groups = useMemo(() => {
    const matched = filtered
      .filter((supplier) => !needle || supplier.name.toLowerCase().includes(needle))
      .sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name), 'ru'));
    const result: { letter: string; items: PortalSupplierDto[] }[] = [];
    matched.forEach((supplier) => {
      const letter = sortKey(supplier.name).charAt(0).toUpperCase();
      const last = result[result.length - 1];
      if (last && last.letter === letter) last.items.push(supplier);
      else result.push({ letter, items: [supplier] });
    });
    return result;
  }, [filtered, needle]);

  const pinnedRows = pinned.map(byId).filter((supplier): supplier is PortalSupplierDto => !!supplier);
  const recentRows = recent
    .filter((id) => !pinned.includes(id))
    .map(byId)
    .filter((supplier): supplier is PortalSupplierDto => !!supplier)
    .slice(0, 4);

  const row = (supplier: PortalSupplierDto) => {
    const current = supplier.supplierId === supplierId;
    const pin = pinned.includes(supplier.supplierId);
    const unread = unreadOf(supplier.supplierId);
    const pinLabel = t(pin ? 'shops.unpin' : 'shops.pin', { name: supplier.name });
    return (
      <div
        key={supplier.supplierId}
        data-testid="shop-row"
        className={cn(
          'flex items-center gap-1.5 rounded-[calc(var(--radius-tile)*1.125)] border-[1.5px] bg-surface p-1',
          current ? 'border-accent bg-bar' : 'border-hairline hover:border-ink',
        )}
      >
        <button
          type="button"
          aria-current={current ? 'true' : undefined}
          onClick={() => onSwitch(supplier.supplierId)}
          className={cn(
            'flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-control)] px-2 py-1 text-left',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          <ShopTile supplier={supplier} className="size-11 text-lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-base font-bold text-ink">{supplier.name}</span>
            {/* Подпись продавца — та же, что в колонке: чем магазин торгует. */}
            {(unread > 0 || supplier.tagline) && (
              <span className="truncate text-[0.8438rem] text-ink-muted">
                {unread > 0 ? t('shops.news', { count: unread }) : supplier.tagline}
              </span>
            )}
          </span>
          {current ? (
            <span className="flex h-7 shrink-0 items-center rounded-[var(--radius-pill)] bg-accent-soft px-2.5 text-[0.7812rem] font-bold text-accent-ink">
              {t('shops.here')}
            </span>
          ) : (
            <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-ink-subtle" />
          )}
        </button>
        <button
          type="button"
          aria-pressed={pin}
          aria-label={pinLabel}
          title={pinLabel}
          onClick={() => togglePin(supplier.supplierId)}
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] hover:bg-canvas',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          <Star
            aria-hidden="true"
            className={cn('size-5', pin ? 'fill-[#D97706] text-[#D97706]' : 'text-ink-subtle')}
          />
        </button>
      </div>
    );
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery('');
          setKind('all');
        }
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/45 dark:bg-black/60" />
        <Dialog.Content
          aria-describedby="shops-dialog-note"
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden',
            wide
              ? cn(
                'qo-dialog left-1/2 top-1/2 max-h-[min(49rem,calc(100dvh-2rem))] w-[min(45rem,calc(100vw-2rem))]',
                '-translate-x-1/2 -translate-y-1/2 rounded-[calc(var(--radius-gallery)*7/6)] bg-surface shadow-float',
              )
              : 'inset-0 bg-canvas',
          )}
        >
          <div
            className={cn(
              'flex flex-col gap-3.5 px-5 pb-4 lg:px-6 lg:pt-6',
              wide ? 'border-b border-hairline pt-5' : 'bg-surface px-4 pt-[calc(0.875rem+env(safe-area-inset-top))] shadow-[0_4px_16px_rgba(58,48,30,.06)]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              {!wide && (
                <Dialog.Close
                  aria-label={t('catalog.back')}
                  className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-canvas text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <ChevronLeft aria-hidden="true" className="size-[1.375rem]" />
                </Dialog.Close>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Dialog.Title className={wide ? 'text-[1.625rem] font-extrabold tracking-[-0.02em] text-ink' : 'text-[1.375rem] font-black tracking-[-0.02em] text-ink'}>
                  {t('shops.title')}
                </Dialog.Title>
                <p id="shops-dialog-note" className={wide ? 'text-body text-ink-muted' : 'text-[0.8125rem] text-ink-muted'}>
                  {t('shops.note', { count: list.length })}
                </p>
                {onShowAll && (
                  <button
                    type="button"
                    onClick={onShowAll}
                    className="self-start text-sm font-bold text-accent-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {t('shops.page.showAll')}
                  </button>
                )}
              </div>
              {wide && <Dialog.Close
                aria-label={t('shops.close')}
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-full bg-canvas text-ink',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <X aria-hidden="true" className="size-5" />
              </Dialog.Close>}
            </div>

            <label
              className={cn(
                'flex h-14 cursor-text items-center gap-3 rounded-[calc(var(--radius-tile)*1.125)] border-2 border-line bg-sunk pl-4 pr-2',
                'focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--color-accent-soft)]',
              )}
            >
              <Search aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
              <span className="sr-only">{t('shops.search')}</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder={t('shops.searchPlaceholder')}
                className="h-full min-w-0 flex-1 bg-transparent text-lead text-ink outline-none placeholder:text-ink-subtle"
              />
              {searching && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="h-10 shrink-0 rounded-[calc(var(--radius-control)*6/7)] bg-canvas px-3.5 text-sm font-semibold text-ink"
                >
                  {t('shops.clear')}
                </button>
              )}
            </label>

            {showKinds && (
              <div role="group" aria-label={t('shops.kinds')} className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={active === 'all'}
                  onClick={() => setKind('all')}
                  className={cn(
                    'flex h-11 items-center gap-2 rounded-[var(--radius-pill)] border-[1.5px] px-4.5 text-body font-semibold',
                    'transition-colors duration-200',
                    active === 'all'
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-line bg-surface text-ink hover:border-ink',
                  )}
                >
                  {t('shops.allKind')}
                  <span className="font-medium opacity-60">{list.length}</span>
                </button>
                {kinds.map(([tagline, count]) => (
                  <button
                    key={tagline}
                    type="button"
                    aria-pressed={active === tagline}
                    onClick={() => setKind(tagline)}
                    className={cn(
                      'flex h-11 items-center gap-2 rounded-[var(--radius-pill)] border-[1.5px] px-4.5 text-body font-semibold',
                      'transition-colors duration-200',
                      active === tagline
                        ? 'border-accent bg-accent text-on-accent'
                        : 'border-line bg-surface text-ink hover:border-ink',
                    )}
                  >
                    {tagline}
                    <span className="font-medium opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto px-5 pb-6 pt-4 lg:px-6">
            {/*
              Приглашения — первыми: это единственное в окне, что ждёт ответа.
              Принятый магазин сразу открывается — ради него окно и открывали.
            */}
            {!searching && <InvitesSection onAccepted={onSwitch} />}

            {!searching && pinnedRows.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h3 className="flex items-center gap-2 px-1 text-sm font-extrabold text-ink">
                  <Star aria-hidden="true" className="size-4 fill-[#D97706] text-[#D97706]" />
                  {t('shops.pinned')}
                </h3>
                {pinnedRows.map(row)}
              </section>
            )}

            {!searching && recentRows.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h3 className="flex items-center gap-2 px-1 text-sm font-extrabold text-ink">
                  <Clock aria-hidden="true" className="size-4 text-ink-muted" />
                  {t('shops.recent')}
                </h3>
                {recentRows.map(row)}
              </section>
            )}

            <section className="flex flex-col gap-1.5">
              <h3 className="px-1 text-sm font-extrabold text-ink">
                {searching ? t('shops.found') : t('shops.everything')}
              </h3>
              {groups.length === 0 && (
                <p className="rounded-[calc(var(--radius-tile)*1.125)] bg-sunk px-4 py-7 text-center text-body leading-normal text-ink-muted">
                  {t('shops.nothing')}
                </p>
              )}
              {groups.map((group) => (
                <div key={group.letter} className="flex flex-col gap-1.5">
                  <div aria-hidden="true" className="px-3 pt-1.5 text-caption font-extrabold tracking-[0.04em] text-ink-faint">
                    {group.letter}
                  </div>
                  {group.items.map(row)}
                </div>
              ))}
            </section>

            {!searching && <p className="px-1 text-caption text-ink-subtle">{t('shops.pinHint')}</p>}

            {onInvite && (wide ? (
              <button
                type="button"
                onClick={onInvite}
                className={cn(
                  'flex min-h-12 items-center gap-2 rounded-[calc(var(--radius-tile)*1.125)] border-[1.5px] border-dashed border-line px-4',
                  'text-body font-semibold text-ink hover:border-ink',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <Plus aria-hidden="true" className="size-5" />
                {t('referral.shopsItem')}
              </button>
            ) : (
              // Как в макете: приглашение — мягкой зелёной карточкой с объяснением, зачем.
              <button
                type="button"
                onClick={onInvite}
                className="flex items-center gap-3 rounded-[1.375rem] bg-accent-soft p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-accent text-on-accent">
                  <Plus className="size-[1.375rem]" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.9375rem] font-bold text-accent-ink">{t('referral.shopsItem')}</span>
                  <span className="text-[0.8125rem] text-ink-muted">{t('referral.shopsItemNote')}</span>
                </span>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

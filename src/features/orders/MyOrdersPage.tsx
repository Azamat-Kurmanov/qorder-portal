import { LoadFailed } from '../../ui/LoadFailed';
import { useEffect, useMemo, useState } from 'react';
import { Search } from '../../ui/icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalNotificationsQueryKey,
  useGetMyPortalOrders,
  useGetPortalNotifications,
  useReadPortalNotification,
  type PortalOrderDto,
} from '../../api/generated';
import { cn } from '../../ui/cn';
import { Pagination } from '../../ui/Pagination';
import { OrderLink, OrderPane, OrderPick, OrderRow } from './OrderRow';
import { useWideScreen } from '../../ui/useWideScreen';
import { useCabinetDesign } from '../../supplier/cabinetDesign';
import { StatusHelp } from './StatusHelp';
import {
  FILTERS, ORDER_SIZES, SORTS, kindOf, matchesFilter, matchesSearch, openByDefault, sorted, unreadByOrder,
  type OrderFilter, type OrderSort,
} from './myOrdersModel';

/** Точка у чипа фильтра — цвет вида заявки. */
const FILTER_DOT: Record<OrderFilter, string | null> = {
  all: null,
  answer: 'bg-accent',
  ready: 'bg-in-stock',
  seller: 'bg-brand',
  done: 'bg-ink-faint',
  cancelled: 'bg-gone/60',
};

/**
 * Мои заявки — макет «Клиент · Мои заявки v2», вариант «по делам».
 *
 * Одна лента вместо вкладок: чипы делят её по тому, что с заявкой, а новое
 * поднимается наверх — клиент приходит сюда узнать, что изменилось. Заявки,
 * где ход за ним (ответить, забрать) и есть новое, открыты сразу.
 *
 * Новое берётся из уведомлений кабинета: те же плашки, что у колокольчика.
 * Раскрыв заявку, клиент их прочитал — и колокольчик гаснет вместе с меткой.
 */
export function MyOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const response = useGetMyPortalOrders();
  const notifications = useGetPortalNotifications();
  const read = useReadPortalNotification({
    mutation: {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() }),
    },
  });
  const orders: PortalOrderDto[] = useMemo(
    () => (response.data?.status === 200 ? response.data.data : []),
    [response.data],
  );
  const unread = useMemo(
    () => unreadByOrder(notifications.data?.status === 200 ? notifications.data.data : []),
    [notifications.data],
  );

  const [filter, setFilter] = useState<OrderFilter>('all');
  const [query, setQuery] = useState('');
  const [onlyNew, setOnlyNew] = useState(false);
  const [sort, setSort] = useState<OrderSort>('recent');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(ORDER_SIZES[0]);
  // Что клиент раскрыл или свернул сам; остальное — по умолчанию.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  // Монитор без шаблона — по макету ПК-К5: список слева, выбранная заявка справа.
  const wide = useWideScreen();
  const plain = useCabinetDesign().template === null;
  const split = wide && plain;
  const [picked, setPicked] = useState<string>();
  // Открытая сама заявка закрепляется открытой: после «Согласен» или
  // «Отменить» она перестаёт ждать ответа и по умолчанию была бы свёрнута —
  // строка схлопнулась бы прямо под рукой, не показав, чем всё кончилось.
  useEffect(() => {
    const opened = orders.filter((order) => toggled[order.id] === undefined && openByDefault(order, unread.get(order.id)));
    if (opened.length > 0) {
      setToggled((state) => ({ ...state, ...Object.fromEntries(opened.map((order) => [order.id, true])) }));
    }
    // toggled читается ради «ещё не решено»; перезапуск по нему не нужен.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, unread]);

  if (response.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((row) => (
          <div key={row} data-testid="order-skeleton"
            className="h-28 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk" />
        ))}
      </div>
    );
  }

  if (response.isError) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="qo-page-title">{t('orders.title')}</h1>
        <LoadFailed onRetry={() => void response.refetch()} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="qo-page-title">{t('orders.title')}</h1>
        <p className="text-base text-ink-muted">{t('orders.empty')}</p>
      </div>
    );
  }

  const newCount = orders.reduce((sum, order) => sum + (unread.get(order.id)?.count ?? 0), 0);
  const visible = sorted(
    orders.filter((order) => matchesFilter(order, filter)
      && matchesSearch(order, query)
      && (!onlyNew || unread.has(order.id))),
    sort,
    unread,
  );
  const pages = Math.max(1, Math.ceil(visible.length / size));
  const current = Math.min(page, pages - 1);
  const shown = visible.slice(current * size, (current + 1) * size);
  const range = { from: current * size + 1, to: current * size + shown.length, total: visible.length };
  const isOpen = (order: PortalOrderDto) => toggled[order.id] ?? openByDefault(order, unread.get(order.id));
  const markRead = (order: PortalOrderDto) => unread.get(order.id)?.ids.forEach((id) => read.mutate({ id }));

  const toggle = (order: PortalOrderDto) => {
    const opening = !isOpen(order);
    setToggled((state) => ({ ...state, [order.id]: opening }));
    if (opening) markRead(order);
  };
  const setAll = (open: boolean) => {
    setToggled((state) => ({ ...state, ...Object.fromEntries(shown.map((order) => [order.id, open])) }));
    if (open) shown.forEach(markRead);
  };
  // Любая смена отбора возвращает на первую страницу: иначе клиент остался бы
  // на третьей странице списка, в котором теперь одна.
  const reset = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(0);
  };
  const resetAll = () => {
    setFilter('all');
    setQuery('');
    setOnlyNew(false);
    setPage(0);
  };

  const chips = (
    <div role="group" aria-label={t('orders.v2.filtersLabel')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
      {FILTERS.map((key) => {
        const count = orders.filter((order) => matchesFilter(order, key)).length;
        const active = filter === key;
        return (
          <button key={key} type="button" aria-pressed={active} onClick={() => reset(setFilter)(key)}
            className={cn(
              'inline-flex h-[2.375rem] shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] border-[1.5px] border-solid px-3.5 text-sm font-semibold lg:h-9 lg:text-caption',
              'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              active ? 'border-ink bg-ink text-on-ink' : 'border-line bg-surface text-ink-muted hover:border-ink hover:text-ink',
            )}>
            {FILTER_DOT[key] ? <span aria-hidden="true" className={cn('size-2 rounded-full', FILTER_DOT[key])} /> : null}
            {t(`orders.v2.filters.${key}`)}
            <span className={cn('rounded-[var(--radius-pill)] px-1.5 text-[0.7188rem] tabular-nums', active ? 'bg-white/20' : 'bg-sunk')}>{count}</span>
          </button>
        );
      })}
    </div>
  );

  if (split) {
    // Без выбора — первая в списке: справа не бывает пусто, пока слева есть заявки.
    const selected = shown.find((order) => order.id === picked) ?? shown[0];
    return (
      <div data-testid="orders-split" className="grid grid-cols-[23.75rem_minmax(0,1fr)] items-start gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="text-[1.75rem] font-black tracking-[-0.02em] text-ink">{t('orders.title')}</h1>
          {chips}
          <label className="relative flex items-center">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-ink-faint" />
            <input type="search" value={query} placeholder={t('orders.v2.search')} aria-label={t('orders.v2.search')}
              onChange={(event) => reset(setQuery)(event.target.value)}
              className="h-10 w-full rounded-xl border-0 bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent" />
          </label>
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border-[1.5px] border-dashed border-line px-5 py-10 text-center">
              <b className="text-base font-extrabold text-ink">{t('orders.v2.nothingTitle')}</b>
              <button type="button" onClick={resetAll} className="cursor-pointer bg-transparent text-sm font-semibold text-accent-ink hover:underline">
                {t('orders.v2.resetFilters')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {shown.map((order) => (
                <OrderPick key={order.id} order={order} unread={unread.get(order.id)} selected={order.id === selected?.id}
                  onPick={() => { setPicked(order.id); markRead(order); }} />
              ))}
            </div>
          )}
          <Pagination
            page={current}
            size={size}
            total={visible.length}
            sizes={ORDER_SIZES}
            onPage={setPage}
            onSize={(next) => { setSize(next); setPage(0); }}
            label={t('pager.nav')}
          />
          <p className="m-0 px-1 text-caption text-ink-subtle">{t('orders.v2.payNote')}</p>
        </div>
        {selected ? <OrderPane key={selected.id} order={selected} /> : null}
      </div>
    );
  }

  if (!wide) {
    // Телефон (макеты «Кабинет клиента 2.0»): отборы и короткие строки, разложенные
    // на «Ждут вас» и остальные. Всё о заявке — на её экране.
    const waits = (order: PortalOrderDto) => ['answer', 'ready'].includes(kindOf(order));
    const groups = filter === 'all'
      ? [
        { key: 'waiting', title: t('orders.v2.groups.waiting'), list: shown.filter(waits) },
        { key: 'rest', title: t('orders.v2.groups.rest'), list: shown.filter((order) => !waits(order)) },
      ].filter((group) => group.list.length > 0)
      : [{ key: 'all', title: '', list: shown }];
    return (
      <div className="flex flex-col gap-4">
        <h1 className="qo-page-title">{t('orders.title')}</h1>
        {chips}
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[1.25rem] bg-surface px-5 py-10 text-center">
            <b className="text-base font-extrabold text-ink">{t('orders.v2.nothingTitle')}</b>
            <button type="button" onClick={resetAll} className="cursor-pointer bg-transparent text-sm font-semibold text-accent-ink">
              {t('orders.v2.resetFilters')}
            </button>
          </div>
        ) : groups.map((group) => (
          <section key={group.key} aria-label={group.title || undefined} className="flex flex-col gap-2">
            {group.title ? <h2 className="px-1 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">{group.title}</h2> : null}
            <div className="flex flex-col divide-y divide-hairline overflow-hidden rounded-[1.25rem] bg-surface">
              {group.list.map((order) => <OrderLink key={order.id} order={order} unread={unread.get(order.id)} />)}
            </div>
          </section>
        ))}
        <Pagination
          page={current}
          size={size}
          total={visible.length}
          sizes={ORDER_SIZES}
          onPage={setPage}
          onSize={(next) => { setSize(next); setPage(0); }}
          label={t('pager.nav')}
        />
        <p className="m-0 px-1 text-center text-caption text-ink-subtle">{t('orders.v2.payNote')}</p>
      </div>
    );
  }

  return (
    // Справа — «Что значит статус», как в макете; на узком экране — под списком.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18.75rem] lg:items-start">
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="qo-page-title">{t('orders.title')}</h1>
          <p className="m-0 text-sm text-ink-muted max-lg:hidden">{t('orders.v2.subtitle')}</p>
        </div>
        {newCount > 0 ? (
          <span className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-pill)] bg-accent-soft px-3 text-caption font-bold text-accent-ink">
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
            {t('orders.v2.newMessages', { count: newCount })}
          </span>
        ) : null}
      </div>

      {/* На телефоне, как в макете, — только отборы чипами: поиск и порядок нужны там, где экран широкий. */}
      <div className="flex flex-col gap-3 lg:rounded-[var(--radius-card)] lg:bg-surface lg:p-3 lg:shadow-[0_0_0_1px_var(--color-hairline)]">
        {chips}
        <div className="flex flex-wrap items-center gap-2 max-lg:hidden">
          <label className="relative flex min-w-[14rem] flex-1 items-center">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-ink-faint" />
            <input type="search" value={query} placeholder={t('orders.v2.search')} aria-label={t('orders.v2.search')}
              onChange={(event) => reset(setQuery)(event.target.value)}
              className="h-10 w-full rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none" />
          </label>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border-[1.5px] border-solid border-line px-3 text-caption font-semibold text-ink">
            <input type="checkbox" checked={onlyNew} onChange={(event) => reset(setOnlyNew)(event.target.checked)}
              className="size-4 accent-[var(--color-accent)]" />
            {t('orders.v2.onlyNew')}
          </label>
          <label className="inline-flex items-center gap-2 text-caption text-ink-muted">
            {t('orders.v2.sortLabel')}
            <select value={sort} onChange={(event) => reset(setSort)(event.target.value as OrderSort)}
              className="h-10 rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface px-3 text-caption font-semibold text-ink focus:border-accent focus:outline-none">
              {SORTS.map((key) => <option key={key} value={key}>{t(`orders.v2.sort.${key}`)}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-caption max-lg:hidden">
        <span className="text-ink-subtle">{visible.length > 0 ? t('pager.shown', range) : null}</span>
        {shown.length > 0 ? (
          <span className="flex gap-4">
            <button type="button" onClick={() => setAll(true)} className="cursor-pointer bg-transparent font-semibold text-accent-ink hover:underline">
              {t('orders.v2.expandAll')}
            </button>
            <button type="button" onClick={() => setAll(false)} className="cursor-pointer bg-transparent font-semibold text-accent-ink hover:underline">
              {t('orders.v2.collapseAll')}
            </button>
          </span>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border-[1.5px] border-dashed border-line px-5 py-12 text-center">
          <b className="text-lg font-extrabold text-ink">{t('orders.v2.nothingTitle')}</b>
          <span className="text-sm text-ink-muted">{t('orders.v2.nothing')}</span>
          <button type="button" onClick={resetAll}
            className="mt-1.5 inline-flex h-11 cursor-pointer items-center rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            {t('orders.v2.resetFilters')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((order) => (
            <OrderRow key={order.id} order={order} unread={unread.get(order.id)} open={isOpen(order)} onToggle={() => toggle(order)} />
          ))}
        </div>
      )}

      <Pagination
        page={current}
        size={size}
        total={visible.length}
        sizes={ORDER_SIZES}
        onPage={setPage}
        onSize={(next) => { setSize(next); setPage(0); }}
        label={t('pager.nav')}
      />

      <p className="m-0 px-1 text-caption text-ink-subtle">{t('orders.v2.payNote')}</p>
    </div>
    <StatusHelp />
    </div>
  );
}

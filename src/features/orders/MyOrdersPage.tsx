import { LoadFailed } from '../../ui/LoadFailed';
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
import { OrderRow } from './OrderRow';
import { StatusHelp } from './StatusHelp';
import {
  FILTERS, ORDER_SIZES, SORTS, matchesFilter, matchesSearch, openByDefault, sorted, unreadByOrder,
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

  return (
    // Справа — «Что значит статус», как в макете; на узком экране — под списком.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18.75rem] lg:items-start">
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="qo-page-title">{t('orders.title')}</h1>
          <p className="m-0 text-sm text-ink-muted">{t('orders.v2.subtitle')}</p>
        </div>
        {newCount > 0 ? (
          <span className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-pill)] bg-accent-soft px-3 text-caption font-bold text-accent-ink">
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
            {t('orders.v2.newMessages', { count: newCount })}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-3 shadow-[0_0_0_1px_var(--color-hairline)]">
        <div role="group" aria-label={t('orders.v2.filtersLabel')} className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {FILTERS.map((key) => {
            const count = orders.filter((order) => matchesFilter(order, key)).length;
            const active = filter === key;
            return (
              <button key={key} type="button" aria-pressed={active} onClick={() => reset(setFilter)(key)}
                className={cn(
                  'inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] border-[1.5px] border-solid px-3.5 text-caption font-semibold',
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
        <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-caption">
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

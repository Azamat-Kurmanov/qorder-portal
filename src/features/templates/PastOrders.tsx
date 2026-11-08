import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useFillPortalCartFromOrder,
  useGetMyPortalOrders,
  type PortalOrderDto,
} from '../../api/generated';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { ShoppingCart } from '../../ui/icons';
import { money } from '../../shared/format';
import { useOrderMode } from '../cart/orderMode';
import { kindOf, matchesSearch } from '../orders/myOrdersModel';
import { NothingAdded, useStayIfEmpty } from '../orders/stayIfEmpty';
import { orderDay } from '../orders/orderText';

/** Сколько заявок видно сразу: дальше — «Показать ещё» или поиск. */
const FIRST = 5;

/**
 * «Из прошлых заявок» — любая своя заявка в корзину, отменённая тоже.
 * <p>
 * Клиент отменил заявку, а через время хочет её же: искать её в «Моих заявках»
 * он не догадается — за повтором он идёт в шаблоны. Корзина, а не отправка:
 * цены и наличие с тех пор могли измениться.
 */
export function PastOrders() {
  const { t } = useTranslation();
  const [orderMode] = useOrderMode();
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const response = useGetMyPortalOrders();
  const orders: PortalOrderDto[] = response.data?.status === 200 ? response.data.data : [];
  const { done, nothing, start } = useStayIfEmpty();
  // Какая заявка повторялась — причину «не добавлено» показываем у неё.
  const [repeated, setRepeated] = useState<string | null>(null);
  const fill = useFillPortalCartFromOrder({ mutation: { onSuccess: done } });

  if (orders.length === 0) return null;
  const found = [...orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((order) => order.submitted.length > 0 && matchesSearch(order, query));
  const shown = all || query.trim() ? found : found.slice(0, FIRST);

  return (
    <section aria-labelledby="past-orders" className="flex flex-col gap-2.5 pt-2">
      <div className="flex flex-col gap-0.5 px-1">
        <h2 id="past-orders" className="m-0 text-lead font-extrabold text-ink">{t('templates.past.title')}</h2>
        <p className="m-0 text-body text-ink-muted">{t('templates.past.hint')}</p>
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder={t('templates.past.search')}
        aria-label={t('templates.past.search')}
        className={cn(
          'h-12 w-full rounded-[var(--radius-control)] border-0 bg-surface px-4',
          'text-body text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent',
        )}
      />
      {shown.length === 0 ? <p className="px-1 text-sm text-ink-subtle">{t('templates.past.nothing')}</p> : null}
      {shown.map((order) => {
        const kind = kindOf(order);
        const names = order.submitted.map((line) => line.name).join(', ');
        return (
          <Card key={order.id} data-testid="past-order" className="flex flex-col gap-2.5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-extrabold text-ink">
                  {t('orders.v2.title', { number: order.orderNumber })} · {orderDay(order.createdAt)}
                </span>
                <span className={cn('text-caption font-semibold', kind === 'cancelled' ? 'text-gone' : 'text-ink-muted')}>
                  {t(`orders.v2.kind.${kind}`)}
                </span>
                <span className="line-clamp-2 text-caption text-ink-subtle">{names}</span>
              </div>
              <b className="whitespace-nowrap tabular-nums text-ink">{money(order.total, order.currency)}</b>
            </div>
            <Button
              variant="outline"
              className="h-12 gap-2 font-extrabold"
              disabled={fill.isPending}
              onClick={() => { start(); setRepeated(order.id); fill.mutate({ orderId: order.id, params: { mode: orderMode } }); }}
            >
              <ShoppingCart aria-hidden="true" className="size-[18px]" />
              {fill.isPending ? t('templates.adding') : t('templates.toCart')}
            </Button>
            {repeated === order.id ? <NothingAdded skipped={nothing} /> : null}
          </Card>
        );
      })}
      {!all && !query.trim() && found.length > FIRST ? (
        <Button variant="outline" onClick={() => setAll(true)}>{t('templates.past.more', { count: found.length - FIRST })}</Button>
      ) : null}
    </section>
  );
}

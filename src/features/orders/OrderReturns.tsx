import { useTranslation } from 'react-i18next';
import { useGetMyOrderReturns } from '../../api/generated';
import { Card } from '../../ui/Card';
import type { Currency } from '../../shared/currency';
import { money } from '../../shared/format';
import { quantityWithUnit } from '../../shared/units';
import { orderDay } from './orderText';

/**
 * Возвраты заказа глазами клиента: что вернул, сколько ему вернут и вернули ли деньги.
 * Брак, ячейки склада и причина продавца — его внутреннее дело и сюда не попадают.
 */
export function OrderReturns({ orderId, currency }: { orderId: string; currency?: Currency }) {
  const { t } = useTranslation();
  const response = useGetMyOrderReturns(orderId);
  const returns = response.data?.status === 200 && Array.isArray(response.data.data) ? response.data.data : [];
  if (returns.length === 0) return null;
  return (
    <>
      {returns.map((item) => {
        const title = t('orders.returns.title', { no: item.returnNo });
        return (
          <Card key={item.returnNo} className="p-4">
            <section aria-label={title} className="flex flex-col gap-1 text-body text-ink">
              <h2 className="text-label font-semibold">{title}</h2>
              {item.createdAt ? <p className="text-ink-subtle">{t('orders.returns.date', { date: orderDay(item.createdAt) })}</p> : null}
              <ul className="flex flex-col gap-0.5">
                {(item.lines ?? []).map((line, index) => (
                  <li key={index}>{t('orders.returns.line', {
                    qty: quantityWithUnit(line.quantity ?? 0, line.unit ?? ''), name: line.name ?? '',
                  })}</li>
                ))}
              </ul>
              <p className="font-semibold">{t('orders.returns.amount', { amount: money(item.refundAmount ?? 0, currency) })}</p>
              <p className={item.refunded ? 'text-ok-ink' : 'text-ink-subtle'}>
                {item.refunded && item.refundedAt
                  ? t('orders.returns.refunded', { date: orderDay(item.refundedAt) })
                  : t('orders.returns.pending')}
              </p>
            </section>
          </Card>
        );
      })}
    </>
  );
}

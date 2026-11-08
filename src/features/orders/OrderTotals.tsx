import { useTranslation } from 'react-i18next';
import type { PortalOrderDto } from '../../api/generated';
import type { Currency } from '../../shared/currency';
import { money } from '../../shared/format';
import { cn } from '../../ui/cn';
import { paymentPlan } from '../cart/paymentPlan';

/** Из чего сложился итог отправленной редакции: её снимок, подтверждённый клиентом. */
export type OrderBreakdown = Pick<
  PortalOrderDto, 'goodsTotal' | 'discount' | 'deliveryPrice' | 'loadersPrice' | 'loadersPayee' | 'vatAmount' | 'goodsVatMode'
  | 'delivery'
>;

/**
 * Итог заявки — строками, как в сводке оформления: «Товары», скидка
 * на заявку цветом скидки, «Доставка» и «Итого». Клиент сверяет заявку
 * с тем, что видел, нажимая «Отправить», — и слова те же (`checkout.*`).
 *
 * Разбивка есть только у отправленной редакции: у состава, который предлагает
 * продавец, сервер её не хранит, и там остаётся одна строка «Итого».
 * Доставка с нулём — «0 тенге», как в оформлении; не названа — строки нет.
 * Грузчики продавцу — строкой под доставкой. Что платится напрямую (перевозчику,
 * грузчикам), — под итогом блоком «Отдельно» и «Всего за заказ», как на оформлении.
 * НДС — последней строкой перед «Итого»: «в т.ч. НДС», когда налог в цене товаров
 * (`goodsVatMode` INCLUDED), иначе «НДС» — прибавлен к итогу сверху.
 */
export function OrderTotals({ total, breakdown, currency, className }: {
  total: number;
  breakdown?: OrderBreakdown;
  /** Валюта заявки: одна на все строки, включая «Итого» без разбивки. */
  currency: Currency | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  const discount = breakdown?.discount && breakdown.discount.amount > 0 ? breakdown.discount : undefined;
  const directDelivery = breakdown?.delivery?.transportPayee === 'DIRECT';
  // Заказ уже посчитан продавцом: «назовёт при проверке» здесь не бывает — только кому и сколько.
  const plan = paymentPlan({
    total,
    shipping: breakdown?.deliveryPrice ?? undefined,
    direct: directDelivery,
    loaders: breakdown?.loadersPrice != null ? { amount: breakdown.loadersPrice, direct: breakdown.loadersPayee === 'DIRECT' } : undefined,
  }, breakdown?.delivery?.carrierName);
  return (
    <div data-testid="order-totals" className={cn('flex flex-col gap-1.5 text-sm', className)}>
      {breakdown?.goodsTotal != null ? (
        <div data-testid="order-goods" className="flex justify-between gap-2 text-ink-muted">
          <span>{t('checkout.summary.goods')}</span>
          <span className="tabular-nums text-ink">{money(breakdown.goodsTotal, currency)}</span>
        </div>
      ) : null}
      {discount ? (
        <div data-testid="order-discount" className="flex justify-between gap-2 font-semibold text-sale-ink">
          <span>{t(`cart.discount.${discount.kind}`, { percent: discount.percent })}</span>
          <span className="tabular-nums">−{money(discount.amount, currency)}</span>
        </div>
      ) : null}
      {breakdown?.deliveryPrice != null && !directDelivery ? (
        <div data-testid="order-delivery" className="flex justify-between gap-2 text-ink-muted">
          <span>{t('checkout.summary.delivery')}</span>
          <span className="tabular-nums text-ink">{money(breakdown.deliveryPrice, currency)}</span>
        </div>
      ) : null}
      {breakdown?.loadersPrice != null && breakdown.loadersPayee !== 'DIRECT' ? (
        <div data-testid="order-loaders" className="flex justify-between gap-2 text-ink-muted">
          <span>{t('checkout.summary.loaders')}</span>
          <span className="tabular-nums text-ink">{money(breakdown.loadersPrice, currency)}</span>
        </div>
      ) : null}
      {breakdown?.vatAmount != null ? (
        <div data-testid="order-vat" className="flex justify-between gap-2 text-ink-muted">
          <span>{t(breakdown.goodsVatMode === 'INCLUDED' ? 'checkout.summary.vatIncluded' : 'checkout.summary.vat')}</span>
          <span className="tabular-nums text-ink">{money(breakdown.vatAmount, currency)}</span>
        </div>
      ) : null}
      <div data-testid="order-total" className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-ink">{plan.separate.length > 0 ? t('checkout.pay.toSeller') : t('checkout.summary.toPay')}</span>
        <span className="whitespace-nowrap text-lg font-extrabold tracking-[-0.01em] tabular-nums text-ink">{money(total, currency)}</span>
      </div>
      {plan.separate.length > 0 ? (
        <div data-testid="order-pay-separately" className="mt-1 flex flex-col gap-1.5 border-t border-hairline pt-2">
          <span className="text-xs font-semibold text-ink">{t('checkout.pay.separately')}</span>
          {plan.separate.map((payment) => (
            <div key={payment.kind} data-testid={payment.kind === 'carrier' ? 'order-delivery-direct' : 'order-loaders-direct'}
              className="flex justify-between gap-2 text-ink-muted">
              <span>{payment.kind === 'carrier'
                ? (payment.name ? t('checkout.pay.carrierNamed', { name: payment.name }) : t('checkout.pay.carrier'))
                : t('checkout.pay.loaders')}</span>
              <span className="tabular-nums text-ink">
                {payment.amount !== undefined ? money(payment.amount, currency)
                  : payment.kind === 'carrier' ? t('checkout.pay.byCarrierTariff') : t('checkout.summary.loadersLater')}
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-2 border-t border-hairline pt-2">
            <span className="font-semibold text-ink">{t('checkout.pay.grand')}</span>
            <span data-testid="order-grand-total" className="whitespace-nowrap font-bold tabular-nums text-ink">
              {plan.approximate ? t('checkout.pay.from', { amount: money(plan.grand, currency) }) : money(plan.grand, currency)}
            </span>
          </div>
          {plan.approximate ? <p className="text-xs text-ink-muted">{t('checkout.pay.grandHint')}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

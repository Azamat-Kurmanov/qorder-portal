import { useTranslation } from 'react-i18next';
import type { PortalOrderDto } from '../../api/generated';
import type { Currency } from '../../shared/currency';
import { money } from '../../shared/format';
import { cn } from '../../ui/cn';

/** Из чего сложился итог отправленной редакции: её снимок, подтверждённый клиентом. */
export type OrderBreakdown = Pick<
  PortalOrderDto, 'goodsTotal' | 'discount' | 'deliveryPrice' | 'loadersPrice' | 'loadersPayee'
>;

/**
 * Итог заявки — строками, как в сводке оформления: «Товары», скидка
 * на заявку цветом скидки, «Доставка» и «Итого». Клиент сверяет заявку
 * с тем, что видел, нажимая «Отправить», — и слова те же (`checkout.*`).
 *
 * Разбивка есть только у отправленной редакции: у состава, который предлагает
 * продавец, сервер её не хранит, и там остаётся одна строка «Итого».
 * Доставка с нулём — «0 тенге», как в оформлении; не названа — строки нет.
 * Грузчики продавцу — строкой под доставкой; «напрямую» — под итогом: в сумму не входят.
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
      {breakdown?.deliveryPrice != null ? (
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
      <div data-testid="order-total" className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-ink">{t('checkout.summary.toPay')}</span>
        <span className="text-lg font-extrabold tracking-[-0.01em] tabular-nums text-ink">{money(total, currency)}</span>
      </div>
      {breakdown?.loadersPrice != null && breakdown.loadersPayee === 'DIRECT' ? (
        <p data-testid="order-loaders-direct" className="text-xs text-ink-muted">
          {t('checkout.summary.loadersDirect', { amount: money(breakdown.loadersPrice, currency) })}
        </p>
      ) : null}
    </div>
  );
}

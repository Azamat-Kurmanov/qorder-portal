import { useTranslation } from 'react-i18next';
import type { CartDto } from '../../api/generated';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';

/**
 * Выгода в корзине: подсказка до следующего порога «оптом дешевле»,
 * скидка на заявку и сколько человек экономит всего.
 *
 * Подсказка стоит и тогда, когда скидки ещё нет: «ещё 50 000 — и 3%»
 * работает только до того, как человек нажал «Отправить».
 */
export function CartSavings({ cart, withTier = true, tierOnly = false }: {
  cart: CartDto | undefined;
  withTier?: boolean;
  /**
   * Только подсказка до порога — одной строкой с тонкой полосой, без строк
   * скидки и выгоды: так она стоит над итогом панели и не съедает место списка.
   */
  tierOnly?: boolean;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  if (!cart || cart.lines.length === 0) return null;

  const discount = cart.discount;
  // Порог, что даёт не больше уже действующей скидки (скажем, первая заявка
  // 5% против «и 3%»), человеку ничего не прибавит — такой не подсказываем.
  // Сервер уже не присылает его, проверка страхует от старого ответа.
  const next = cart.nextTier && (!discount || cart.nextTier.percent > discount.percent) ? cart.nextTier : undefined;
  const saved = (cart.saleSavings ?? 0) + (discount?.amount ?? 0);
  const reached = next ? Math.min(100, Math.round(((next.from - next.missing) / next.from) * 100)) : 100;

  if (tierOnly) {
    if (!next) return null;
    return (
      <div className="flex flex-col gap-1.5" data-testid="cart-tier">
        <p className="text-caption leading-[1.35] text-sale-text">
          <b className="text-sale-ink">{t('cart.tier.more', { amount: money(next.missing, currency) })}</b>{' '}
          {discount?.kind === 'VOLUME'
            ? t('cart.tier.andMore', { percent: next.percent })
            : t('cart.tier.andFirst', { percent: next.percent })}
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-sale-line" aria-hidden="true">
          <div className="h-1 rounded-full bg-sale" style={{ width: `${reached}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {withTier && next ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-tile)] bg-sale-soft p-3.5" data-testid="cart-tier">
          <p className="text-sm leading-[1.4] text-sale-text">
            <b className="text-sale-ink">{t('cart.tier.more', { amount: money(next.missing, currency) })}</b>{' '}
            {discount?.kind === 'VOLUME'
              ? t('cart.tier.andMore', { percent: next.percent })
              : t('cart.tier.andFirst', { percent: next.percent })}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-sale-line" aria-hidden="true">
            <div className="h-2 rounded-full bg-sale" style={{ width: `${reached}%` }} />
          </div>
        </div>
      ) : null}
      {discount && !tierOnly ? (
        <div className="flex justify-between gap-2 text-body font-semibold text-sale-ink" data-testid="cart-discount">
          <span>
            {t(`cart.discount.${discount.kind}`, { percent: discount.percent })}
            {/* Оптовая цена уже скидка: скидка на заявку считается только от штучных строк. */}
            {cart.lines.some((line) => line.split) ? ` · ${t('cart.discount.retailOnly')}` : ''}
          </span>
          <span className="tabular-nums">−{money(discount.amount, currency)}</span>
        </div>
      ) : null}
      {saved > 0 && !tierOnly ? (
        <div className="flex justify-between gap-2 text-body font-bold text-in-stock" data-testid="cart-saved">
          <span>{t('cart.saved')}</span>
          <span className="tabular-nums">{money(saved, currency)}</span>
        </div>
      ) : null}
    </div>
  );
}

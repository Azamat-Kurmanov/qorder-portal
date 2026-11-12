import { useTranslation } from 'react-i18next';
import type { CartDto } from '../../api/generated';
import { Info } from '../../ui/icons';
import { useCurrentShop } from '../shell/Shops';

/**
 * Заявка выйдет за кредитный лимит у продавца — сказать заранее, а не узнать
 * после отправки, когда отгрузка встанет. Без сумм: долг и лимит — расчёты
 * продавца, и корзина их не называет. Отправить заявку можно.
 */
export function CreditNotice({ cart }: { cart: CartDto | undefined }) {
  const { t } = useTranslation();
  // Магазин не даёт в долг — о лимите долга молчим.
  const credit = useCurrentShop()?.credit;
  if (!credit || !cart?.creditLimitExceeded) return null;
  return (
    <p role="note" data-testid="credit-notice" className="m-0 flex gap-2.5 rounded-[var(--radius-control)] bg-sunk px-3 py-2 text-caption leading-[1.45] text-ink">
      <Info aria-hidden="true" className="mt-px size-4 shrink-0 text-accent-ink" />
      {t('cart.creditLimit')}
    </p>
  );
}

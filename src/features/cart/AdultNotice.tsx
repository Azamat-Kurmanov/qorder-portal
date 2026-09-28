import { useTranslation } from 'react-i18next';
import type { CartDto } from '../../api/generated';

/**
 * «В заявке есть товары 21+» — рядом с кнопкой оформления.
 *
 * Возраст уже подтверждён при добавлении, а здесь — о другом: при получении
 * продавец попросит удостоверение, и узнать об этом у прилавка поздно.
 */
export function AdultNotice({ cart }: { cart: CartDto | undefined }) {
  const { t } = useTranslation();
  if (!cart?.lines.some((line) => line.terms?.ageRestricted)) return null;
  return (
    <p
      role="note"
      className="flex gap-2.5 rounded-[var(--radius-tile)] border border-adult/25 bg-adult/5 p-3 text-caption font-semibold leading-[1.45] text-adult"
    >
      <span aria-hidden="true" className="shrink-0 font-extrabold">21+</span>
      {t('cart.adult')}
    </p>
  );
}

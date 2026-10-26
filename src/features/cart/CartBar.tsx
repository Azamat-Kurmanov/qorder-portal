import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cartOf, useCart } from './useCart';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { Bump } from '../../ui/Bump';
import { cn } from '../../ui/cn';
import { ChevronRight } from '../../ui/icons';

/**
 * Полоса корзины над нижним меню телефона (макеты «Кабинет клиента 2.0»):
 * «В корзине N позиций · сумма» и «Корзина ›» — одной строкой, вся полоса
 * ведёт в корзину. Видна, пока в корзине что-то есть: на длинном списке
 * клиент иначе теряет из виду, что уже набрал.
 *
 * Кончается она на `lg`: там итог стоит в шапке и колонкой справа.
 */
export function CartBar() {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const cart = cartOf(useCart().data);
  const positions = cart?.lines.length ?? 0;
  if (positions === 0) return null;

  return (
    <Link
      to="/checkout"
      data-testid="cart-bar"
      data-cart-bar=""
      className={cn(
        'fixed inset-x-3 z-30 flex h-14 items-center gap-3 rounded-[1.125rem] bg-accent pl-[1.125rem] pr-2 text-on-accent',
        'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]',
        'shadow-[0_10px_24px_rgb(1_86_64/0.28)] lg:hidden',
        'transition-[opacity,translate] duration-300 ease-out starting:translate-y-4 starting:opacity-0 active:scale-[.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold">
        {t('cart.positions', { count: positions })} ·{' '}
        <Bump value={cart?.total ?? 0} className="tabular-nums">{money(cart?.total ?? 0, currency)}</Bump>
      </span>
      <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3.5 font-extrabold">
        {t('shell.tabs.checkout')}
        <ChevronRight aria-hidden="true" className="size-[18px]" />
      </span>
    </Link>
  );
}

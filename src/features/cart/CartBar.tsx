import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cartOf, useCart } from './useCart';
import { openCart } from './cartDrawer';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { Bump } from '../../ui/Bump';
import { cn } from '../../ui/cn';
import { ArrowRight } from 'lucide-react';

/**
 * Липкая панель итога.
 *
 * Видна всегда, пока в корзине что-то есть: на длинном списке клиент иначе
 * теряет из виду, что уже набрал, и добирает то же самое второй раз.
 *
 * Кончается она на `lg`: там тот же итог стоит колонкой справа (`CartPanel`),
 * и полоса поверх страницы закрывала бы последнюю строку витрины ради суммы,
 * которая и так на виду.
 *
 * Раскрытие — та же полноценная корзина (`CartPanel`, нижний лист), что
 * открывается из шапки и нижнего меню: у полосы нет своего урезанного листа,
 * иначе в одном месте были бы экономия, НДС и «Очистить», а в другом — нет.
 */
export function CartBar() {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const navigate = useNavigate();
  const cart = cartOf(useCart().data);
  const lines = cart?.lines ?? [];

  if (lines.length === 0) return null;

  const positions = lines.length;

  return (
    <div
      data-testid="cart-bar"
      className={cn(
        // Плашка висит над нижним меню, а не вместо него: разделы нужны
        // и тогда, когда корзина не пуста.
        'fixed inset-x-3 z-30 flex h-16 items-center gap-3 rounded-[calc(var(--radius-tile)*1.25)] bg-accent pl-2 pr-2 text-on-accent',
        'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]',
        // Тень вниз и в стороны: плашка лежит ПОВЕРХ витрины.
        'shadow-[0_12px_28px_-10px_rgb(0_0_0/0.45)]',
        // На мониторе корзина стоит колонкой справа: два итога сразу — это
        // вопрос «какой из них настоящий», а не подстраховка.
        'lg:hidden',
        // Первое добавление — плашка выезжает снизу, а не выскакивает.
        'transition-[opacity,translate] duration-300 ease-out starting:translate-y-4 starting:opacity-0',
      )}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={openCart}
        className={cn(
          'flex min-w-0 flex-col items-start rounded-[var(--radius-control)] px-2.5 py-1 text-left leading-tight',
          'transition-colors duration-200 hover:bg-black/10 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        )}
      >
        <span className="text-sm font-medium opacity-90">
          {t('cart.inCartShort', { count: positions })}
        </span>
        {/* Итог отвечает толчком на каждое добавление: полоса стоит
            внизу экрана, а кладут позицию в середине списка. */}
        <Bump value={cart?.total ?? 0} className="text-[1.1875rem] font-extrabold tabular-nums">
          {money(cart?.total ?? 0, currency)}
        </Bump>
      </button>

      <button
        type="button"
        onClick={() => navigate('/checkout')}
        className={cn(
          'ml-auto flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-black/15 px-4 text-base font-bold',
          'transition-colors duration-200 hover:bg-black/25 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        )}
      >
        {t('cart.checkout')}
        <ArrowRight aria-hidden="true" className="size-[18px]" />
      </button>
    </div>
  );
}


import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cartOf, useCart } from './useCart';
import { CartLines } from './CartLines';
import { tenge } from '../../shared/format';
import { Bump } from '../../ui/Bump';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';

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
 * Раскрытие — выдвижной лист, а не модальное окно браузера: в WebView
 * системные диалоги выглядят чужеродно и блокируют страницу.
 */
export function CartBar() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();
  const cart = cartOf(useCart().data);
  const lines = cart?.lines ?? [];

  if (lines.length === 0) return null;

  const positions = lines.length;

  return (
    <>
      <div
        data-testid="cart-bar"
        className={[
          'fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/95 backdrop-blur',
          // Тень вверх: полоса лежит ПОВЕРХ витрины, и без тени её верхняя
          // граница читается как конец списка, под которым ничего нет.
          'shadow-[0_-8px_24px_-12px_rgb(74_58_36/0.35)]',
          // На мониторе заявка стоит колонкой справа: два итога сразу — это
          // вопрос «какой из них настоящий», а не подстраховка.
          'lg:hidden',
          // Полоса жестов на телефоне съедает низ экрана: без учёта безопасной
          // области кнопка «Оформить» оказывается под ней.
          'px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpened(true)}
            className={[
              'flex min-w-0 flex-col items-start rounded-[var(--radius-control)] px-2 py-1 text-left',
              'transition-all duration-300 hover:bg-canvas active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            ].join(' ')}
          >
            <span className="text-xs text-ink-subtle">
              {positions} {t('common.positions', { count: positions })}
            </span>
            {/* Итог отвечает толчком на каждое добавление: полоса стоит
                внизу экрана, а кладут позицию в середине списка, и молча
                меняющаяся сумма проходит мимо взгляда. */}
            <Bump value={cart?.total ?? 0} className="text-[1.0625rem] font-semibold tabular-nums text-ink">
              {tenge(cart?.total ?? 0)}
            </Bump>
          </button>

          {/* Терракота: это то действие, ради которого заявку собирали,
              и единственное на полосе. «В корзину» у позиций витрины —
              мягкие, и за первый взгляд с этой не спорят. */}
          <Button variant="accent" size="lg" onClick={() => navigate('/checkout')}>
            {t('cart.checkout')}
          </Button>
        </div>
      </div>

      <Sheet open={opened} onOpenChange={setOpened} title={t('cart.sheetTitle')}>
        <div className="flex flex-col gap-3">
          <CartLines />
          <p className="text-right text-base font-semibold tabular-nums text-ink">
            Итого: {tenge(cart?.total ?? 0)}
          </p>
          <Button
            variant="accent"
            size="xl"
            className="w-full"
            onClick={() => {
              setOpened(false);
              navigate('/checkout');
            }}
          >
            {t('cart.checkout')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}


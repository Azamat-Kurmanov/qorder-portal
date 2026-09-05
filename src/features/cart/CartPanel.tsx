import { useNavigate } from 'react-router-dom';
import { cartOf, useCart } from './useCart';
import { CartLines } from './CartLines';
import { positionWord } from './CartBar';
import { tenge } from '../../shared/format';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

/**
 * Заявка колонкой справа — то же, что нижняя полоса на телефоне.
 *
 * На широком экране полоса поверх страницы закрывала бы последнюю строку
 * витрины ради суммы, для которой справа и так есть место. Поэтому пара
 * жёсткая: колонка живёт только на `lg`, полоса — только до него, и вместе
 * они не показываются никогда, иначе итог оказался бы на экране дважды.
 *
 * Состав берётся тем же `CartLines`, что и в листе на телефоне: разойдись
 * они — расхождение цены («было — стало») показывалось бы в одном месте
 * и молчало в другом.
 *
 * Колонка стоит и пустой: появись она только с первой позицией, витрина
 * прыгала бы на 340 точек в момент нажатия «в заявку».
 */
export function CartPanel() {
  const navigate = useNavigate();
  const cart = cartOf(useCart().data);
  const lines = cart?.lines ?? [];

  return (
    <aside
      data-testid="cart-panel"
      aria-label="Заявка"
      className={cn(
        'hidden flex-col gap-4 border-l border-hairline bg-surface px-5 py-6 lg:flex',
        // Липкая и со своей прокруткой: итог нужен виден в тот момент, когда
        // человек добирает позиции внизу длинной витрины.
        'lg:sticky lg:top-[68px] lg:h-[calc(100dvh-68px)]',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Заявка</h2>
        {lines.length > 0 && (
          <span className="text-xs text-ink-subtle">
            {lines.length} {positionWord(lines.length)}
          </span>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          Пока пусто. Добавьте позиции с витрины — итог посчитается здесь.
        </p>
      ) : (
        <>
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            <CartLines />
          </div>

          <div className="mt-auto flex flex-col gap-3 border-t border-hairline pt-4">
            <div className="flex items-baseline justify-between gap-2 text-xl font-bold tracking-[-0.01em] text-ink">
              <span>Итого</span>
              <span className="tabular-nums">{tenge(cart?.total ?? 0)}</span>
            </div>
            <Button size="lg" className="w-full" onClick={() => navigate('/checkout')}>
              Оформить заявку
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}

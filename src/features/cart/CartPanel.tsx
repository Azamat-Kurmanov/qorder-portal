import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cartOf, useCart } from './useCart';
import { CartLines } from './CartLines';
import { tenge } from '../../shared/format';
import { Bump } from '../../ui/Bump';
import { Button } from '../../ui/Button';
import { CART_TARGET } from '../../ui/flyToCart';
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
 * прыгала бы на 340 точек в момент нажатия «в заявку». По той же причине она
 * стоит и до ответа сервера о поставщиках — но состав в это время не
 * запрашивает: `active` включается, когда известно, что поставщик есть.
 * У клиента, которому кабинет не открыли, запрос за составом вернул бы отказ.
 */
export function CartPanel({ active = true }: { active?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cart = cartOf(useCart(active).data);
  const lines = cart?.lines ?? [];

  return (
    <aside
      data-testid="cart-panel"
      aria-label={t('cart.panelTitle')}
      className={cn(
        'hidden flex-col gap-4 border-l border-hairline bg-surface px-5 py-6 lg:flex',
        // Липкая и со своей прокруткой: итог нужен виден в тот момент, когда
        // человек добирает позиции внизу длинной витрины.
        'lg:sticky lg:top-[var(--header-h)] lg:h-[calc(100dvh-var(--header-h))]',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        {/*
          Заголовок колонки — то место, куда на мониторе улетает положенная
          позиция. Именно заголовок, а не список: список бывает пуст, и
          лететь тогда было бы некуда, а заголовок стоит всегда.
        */}
        <h2 {...{ [CART_TARGET]: '' }} className="text-base font-semibold text-ink">
          {t('cart.panelTitle')}
        </h2>
        {lines.length > 0 && (
          // Число позиций отвечает толчком на добавление: колонка стоит
          // справа, а кладут позицию слева, и без толчка прибавление
          // проходит незамеченным — ровно тот случай, когда закупщик кладёт
          // то же самое второй раз.
          <Bump value={lines.length} className="text-xs text-ink-subtle">
            {t('common.positions', { count: lines.length })}
          </Bump>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-ink-subtle">{t('cart.panelEmpty')}</p>
      ) : (
        <>
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            <CartLines />
          </div>

          <div className="mt-auto flex flex-col gap-3 border-t border-hairline pt-4">
            <div className="flex items-baseline justify-between gap-2 text-xl font-bold tracking-[-0.01em] text-ink">
              <span>{t('cart.total')}</span>
              {/* Итог тоже отвечает толчком: сумма меняется от каждого
                  «плюса» внизу витрины, и молча меняющиеся деньги — это
                  повод пересчитывать заявку вручную. */}
              <Bump value={cart?.total ?? 0} className="tabular-nums">
                {tenge(cart?.total ?? 0)}
              </Bump>
            </div>
            {/*
              Терракота и крупный размер: это единственное действие колонки
              и то, ради чего заявку собирали. Остальные кнопки экрана —
              «В корзину» у позиций — мягкие, и спорить с этой за первый
              взгляд не должны.
            */}
            <Button variant="accent" size="xl" className="w-full" onClick={() => navigate('/checkout')}>
              {t('cart.checkoutFull')}
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}

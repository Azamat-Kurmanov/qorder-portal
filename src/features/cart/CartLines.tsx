import { cartOf, useCart } from './useCart';
import { LineThumb } from './LineThumb';
import { QuantityField } from './QuantityField';
import { money, tenge } from '../../shared/format';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import type { CartLineDto, SkippedLineDto } from '../../api/generated';

interface CartLinesProps {
  /**
   * Можно ли править количество прямо в строке.
   *
   * Там, где заявка уже собрана и её сверяют, количество — часть подписи
   * «20 мешков × 2 500 ₸»: так строка читается целиком. Там, где корзину
   * набирают, оно живёт в поле со ступеньками — иначе менять его пришлось
   * бы уходом на другой экран.
   */
  editable?: boolean;
  className?: string;
}

/**
 * Состав корзины: то, что набрано, и то, что положить не удалось.
 *
 * Один список в одной карточке с волосяными разделителями, а не карточка
 * на строку: заявка — это одна вещь, а десять отдельных карточек читаются
 * как десять несвязанных.
 *
 * Расхождение цены показывается парой «было — стало», а не одной суммой:
 * клиент собирал заявку на другую сумму, и подменить её молча значит продать
 * по цене, которой он не видел.
 */
export function CartLines({ editable = true, className }: CartLinesProps) {
  const cart = cartOf(useCart().data);
  const lines = cart?.lines ?? [];
  const skipped = cart?.skipped ?? [];

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <SkippedNotice skipped={skipped} />

      {lines.length === 0 && (
        <p className="text-ink-subtle">Корзина пуста. Выберите позиции в каталоге.</p>
      )}

      {lines.length > 0 && (
        <Card className="overflow-hidden">
          {lines.map((line, index) => (
            <div
              key={line.itemId}
              data-testid="cart-line"
              className={cn(
                '@container flex flex-wrap items-center gap-x-3 gap-y-2.5 px-3.5 py-3',
                // Разделитель между строками, а не рамка вокруг каждой:
                // рамка разбивает список на отдельные предметы.
                index > 0 && 'border-t border-hairline',
              )}
            >
              <LineThumb seed={line.itemId} />

              <div className="min-w-0 flex-1 break-words">
                <p className="truncate text-sm font-medium text-ink">{line.name}</p>
                {line.priceChanged ? (
                  // Цена, изменившаяся с момента добавления, — не мелочь оформления:
                  // клиент собирал заявку на другую сумму, и увидеть он должен обе.
                  <p className="mt-0.5 text-xs text-unclear">
                    Цена изменилась: было {tenge(line.priceAtAdding)}, стало {tenge(line.price)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-ink-subtle">{amountLine(line, editable)}</p>
                )}
              </div>

              {editable && (
                <QuantityField
                  itemId={line.itemId}
                  unit={line.unit}
                  // Ниже 420 точек ряд «миниатюра — название — ступеньки — сумма»
                  // не складывается: несжимаемого в нём около 250 точек, и
                  // названию остаётся ноль — оно исчезает, а подпись под ним
                  // выезжает поверх ступенек. Поэтому в узкой колонке заявки
                  // и в листе на телефоне поле уходит на свою строку, к правому
                  // краю — под сумму, которую оно и меняет.
                  className="@max-[420px]:order-last @max-[420px]:basis-full @max-[420px]:justify-end"
                />
              )}

              <p
                data-testid="line-total"
                className="shrink-0 text-[15px] font-semibold tabular-nums text-ink"
              >
                {tenge(line.total)}
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/**
 * Подпись под названием.
 *
 * Количество названо только там, где его не видно в поле ввода: продублируй
 * его рядом со ступеньками — и при расхождении (поле ещё не отправило новое
 * значение) строка сообщила бы два разных количества сразу.
 */
function amountLine(line: CartLineDto, editable: boolean): string {
  return editable
    ? `${tenge(line.price)} за ${line.unit}`
    : `${money(line.quantity)} ${line.unit} × ${tenge(line.price)}`;
}

/**
 * «Не добавлено» — отдельным блоком и всегда наверху.
 *
 * Молча пропущенная позиция обнаруживается уже при отгрузке: клиент считает,
 * что заказал набор, а приедет неполный.
 */
export function SkippedNotice({ skipped }: { skipped: SkippedLineDto[] }) {
  if (skipped.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-unclear/30 bg-unclear/8 p-4"
    >
      <p className="font-medium text-ink">Не добавлено</p>
      {skipped.map((line) => (
        <p key={line.itemId} className="text-sm text-ink">
          {line.name} — {line.reason}
        </p>
      ))}
      <p className="text-sm text-ink-subtle">Выберите замену в каталоге.</p>
    </div>
  );
}

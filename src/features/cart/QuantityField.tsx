import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemSaleTerms } from '../../api/generated';
import { cartOf, useCart, useSetCartLine } from './useCart';
import { lineOf } from './cartPart';
import type { SaleMode } from './ModeSwitch';
import { fitQuantity, lessQuantity, stepOf } from './saleTerms';
import { cn } from '../../ui/cn';
import { unitFor } from '../../shared/units';

interface QuantityFieldProps {
  itemId: string;
  unit: string;
  /** `card` — плашка на месте «В корзину»; `line` — компактный, для строки корзины. */
  variant?: 'card' | 'line';
  /** Минимум и кратность продавца: по ним шагают «+» и «−» и выравнивается набранное. */
  terms?: ItemSaleTerms;
  /**
   * Штук в упаковке у товара «только опт»: поле витрины считает упаковки,
   * а корзина — штуки. Пусто — поле в тех же единицах, что и корзина.
   */
  perPack?: number;
  /** Заявка строки у товара «оптом и в розницу»: розничное поле не правит оптовую строку. */
  mode?: SaleMode;
  /** Приписка после единицы — «в корзине» на витрине, как в макете. */
  suffix?: string;
  className?: string;
}

/**
 * Количество прямо в строке каталога.
 *
 * Отправка отложена: набирая «125», человек проходит через 1 и 12, и запрос
 * на каждую цифру означал бы три обращения к серверу вместо одного — и три
 * пересчёта корзины, из которых верен только последний.
 *
 * Поле не ждёт ответа сервера, чтобы показать введённое: клиент печатает
 * быстрее, чем ходит сеть, и «прыгающее» значение выглядит поломкой.
 *
 * Шаг кнопками, а не только вводом: на складе набирают одной рукой, и попасть
 * в «плюс» проще, чем в цифру. Обе кнопки 44px — иначе палец промахивается.
 */
export function QuantityField({ itemId, unit, variant = 'card', terms, perPack = 1, mode, suffix, className }: QuantityFieldProps) {
  const { t } = useTranslation();
  const cart = cartOf(useCart().data);
  const setLine = useSetCartLine();
  const line = lineOf(cart, itemId, mode);
  const pieces = line?.quantity;
  // Режим строки, а без строки — заявки, в которой клиент сейчас.
  const lineMode = line?.mode ?? mode;
  const stored = pieces === undefined ? undefined : pieces / perPack;

  const [value, setValue] = useState<number | string>(stored ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const edited = useRef(false);

  // Пока человек не трогал поле, оно следует за корзиной: её мог наполнить
  // повтор прошлого заказа или шаблон, и поле обязано это показать.
  useEffect(() => {
    if (!edited.current) setValue(stored ?? '');
  }, [stored]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const schedule = (next: number | string) => {
    edited.current = true;
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const typed = typeof next === 'number' ? next : Number(next);
      // Набранное руками выравнивается под минимум и кратность продавца:
      // «7» при продаже по шесть уходит двенадцатью, и поле это показывает,
      // а не ждёт отказа сервера.
      const quantity = fitQuantity(Number.isFinite(typed) ? typed : 0, terms);
      if (quantity !== typed) setValue(quantity);
      setLine.mutate({ itemId, data: { quantity: quantity * perPack, mode: lineMode } });
    }, 400);
  };

  const current = typeof value === 'number' ? value : Number(value || 0);
  const more = () => schedule(fitQuantity(current + stepOf(terms), terms));
  const less = () => schedule(lessQuantity(current, terms));

  const card = variant === 'card';

  return (
    /*
      Два вида одного поля. На витрине и в карточке товара — широкая мягкая
      плашка цвета магазина с белыми кнопками: она встаёт на место «В корзину»
      и обязана читаться тем же предметом, только уже взятым. В строке корзины
      — компактный, с обводкой: там рядом стоит сумма, и плашка спорила бы с ней.
    */
    <div
      className={cn(
        'flex shrink-0 items-center',
        card
          ? 'h-13 w-full justify-between gap-1 rounded-[var(--radius-tile)] bg-accent-soft p-1'
          : 'h-9 gap-1.5',
        className,
      )}
    >
      <button
        type="button"
        aria-label={t('cart.less')}
        onClick={less}
        disabled={current <= 0}
        className={card ? STEPPER_CARD : STEPPER_MINI}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
          <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* На карточке единица — мелко под числом: в строку с ним на узкой карточке «4 мешка» обрезалось до «4 м…». */}
      <label className={cn('flex min-w-0 justify-center', card ? 'flex-1 flex-col items-center leading-none' : 'min-w-[4.75rem] shrink-0 items-baseline gap-1')}>
        <input
          type="number"
          inputMode="numeric"
          aria-label={`Количество, ${unit}`}
          placeholder="0"
          min={0}
          step={stepOf(terms)}
          value={value}
          onChange={(event) => schedule(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value))}
          // Ширина — по числу цифр: на узкой карточке каталога фиксированные 64 точки
          // съедали место у единицы, и «шт.» обрезалось до «ш…».
          style={card ? { width: `${Math.max(1, String(value).length) + 0.6}ch` } : undefined}
          className={cn(
            // Числа до пяти цифр — «1 250» мешков, — и набранное количество
            // перечитывают перед оформлением чаще, чем что-либо на витрине.
            'min-w-0 bg-transparent text-right font-extrabold tabular-nums',
            'rounded-md focus:outline-none focus:ring-2 focus:ring-accent/40',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
            card ? 'text-center text-lead leading-none text-accent-ink' : 'w-10 text-body text-ink',
          )}
        />
        {/* Единица рядом с числом: «2 мешка» читается, голое «2» — нет. */}
        <span
          aria-hidden="true"
          className={cn('whitespace-nowrap font-semibold', card ? 'max-w-full overflow-hidden text-2xs text-accent-ink' : 'text-caption text-ink-muted')}
        >
          {unitFor(current, unit)}
          {suffix ? ` ${suffix}` : ''}
        </span>
      </label>

      <button
        type="button"
        aria-label={t('cart.more')}
        onClick={more}
        className={card ? STEPPER_CARD : STEPPER_MINI}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
          <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

const STEPPER_BASE = cn(
  'flex shrink-0 items-center justify-center transition-all duration-200 active:scale-95',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  'disabled:opacity-40 disabled:pointer-events-none',
);

/** Белая кнопка на мягкой плашке: 44 точки — палец не промахивается. */
const STEPPER_CARD = cn(
  STEPPER_BASE,
  'size-10 rounded-[calc(var(--radius-control)*13/14)] bg-surface text-accent-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)] hover:bg-sunk',
);

/** Компактная кнопка строки корзины — с обводкой, как у полей. */
const STEPPER_MINI = cn(
  STEPPER_BASE,
  'size-9 rounded-[calc(var(--radius-control)*5/7)] border-[1.5px] border-line bg-surface text-ink hover:border-ink',
);

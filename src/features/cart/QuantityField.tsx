import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cartOf, useCart, useSetCartLine } from './useCart';
import { cn } from '../../ui/cn';

interface QuantityFieldProps {
  itemId: string;
  unit: string;
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
export function QuantityField({ itemId, unit, className }: QuantityFieldProps) {
  const { t } = useTranslation();
  const cart = cartOf(useCart().data);
  const setLine = useSetCartLine();
  const stored = cart?.lines.find((line) => line.itemId === itemId)?.quantity;

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
      const quantity = typeof next === 'number' ? next : Number(next);
      setLine.mutate({ itemId, data: { quantity: Number.isFinite(quantity) ? quantity : 0 } });
    }, 400);
  };

  const current = typeof value === 'number' ? value : Number(value || 0);
  const step = (delta: number) => schedule(Math.max(0, current + delta));

  return (
    <div className={cn('flex h-11 shrink-0 items-stretch', className)}>
      <button
        type="button"
        aria-label={t('cart.less')}
        onClick={() => step(-1)}
        disabled={current <= 0}
        className={cn(STEPPER, 'rounded-l-[var(--radius-control)] border-r-0')}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
          <path d="M4 8h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <input
        type="number"
        inputMode="numeric"
        aria-label={`Количество, ${unit}`}
        placeholder="0"
        min={0}
        step={1}
        value={value}
        onChange={(event) => schedule(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value))}
        className={cn(
          // Шире и крупнее прежнего: в поле стоят числа до пяти цифр —
          // «1 250» мешков, — и набранное количество человек перечитывает
          // перед оформлением чаще, чем что-либо ещё на витрине. Размеры
          // в `rem`: при крупном шрифте поле растёт вместе с цифрами.
          'w-16 border-y border-hairline bg-surface text-center',
          'text-base font-semibold tabular-nums text-ink',
          'transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand/40',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
        )}
      />

      <button
        type="button"
        aria-label={t('cart.more')}
        onClick={() => step(1)}
        className={cn(STEPPER, 'rounded-r-[var(--radius-control)] border-l-0')}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
          <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

const STEPPER = cn(
  'flex w-11 items-center justify-center border border-hairline bg-sunk text-ink',
  'transition-all duration-300 hover:bg-canvas active:scale-95',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
  'disabled:opacity-40 disabled:pointer-events-none',
);

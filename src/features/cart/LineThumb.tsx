import { cn } from '../../ui/cn';

/**
 * Пары для заполнителя — прямо из дизайн-канвы.
 *
 * Единственное место, где в кабинете стоят сырые значения, а не токены:
 * это не цвета интерфейса, а замена ненайденному снимку. Токен обязан
 * что-то значить («поверхность», «волосяная линия»), а тут значения нет —
 * есть шесть тёплых пятен, чтобы список не выглядел таблицей. Появятся
 * снимки — заполнитель уйдёт целиком, вместе с этим списком.
 */
const PLACEHOLDERS = [
  ['#D9D2C6', '#B9AE9C'],
  ['#DCD3C2', '#A8997F'],
  ['#E7DFCF', '#CBBFA6'],
  ['#DED6C8', '#B3A793'],
  ['#E2DACB', '#BDB09A'],
  ['#D6CEC0', '#A79B87'],
] as const;

/**
 * Миниатюра позиции.
 *
 * Место под снимок занято всегда, даже когда снимка нет: корзина его
 * не отдаёт (в `CartLineDto` такого поля нет), а строки с картинкой и без
 * неё расходятся по высоте — список начинает прыгать на каждой позиции.
 *
 * Заливка выбирается по самой позиции, а не наугад: случайная менялась бы
 * на каждой перерисовке, и один и тот же цемент выглядел бы каждый раз
 * другим товаром.
 */
export function LineThumb({ seed, className }: { seed: string; className?: string }) {
  const [from, to] = PLACEHOLDERS[fingerprint(seed) % PLACEHOLDERS.length];

  return (
    <div
      aria-hidden="true"
      data-testid="line-thumb"
      className={cn('size-11 shrink-0 rounded-[var(--radius-control)]', className)}
      style={{ backgroundImage: `linear-gradient(150deg, ${from}, ${to})` }}
    />
  );
}

/** Число из строки: одно и то же для одной и той же позиции. */
function fingerprint(seed: string): number {
  let sum = 0;
  for (let index = 0; index < seed.length; index += 1) sum = (sum * 31 + seed.charCodeAt(index)) % 9973;
  return sum;
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * Появление при скролле.
 *
 * Один эффект на весь кабинет: карточка приходит снизу, проявляясь и
 * дорастая до своего размера, один раз за просмотр. Разные эффекты на разных
 * экранах читаются как разные продукты.
 *
 * Масштаб взят почти незаметный (98 процентов) и работает не сам по себе:
 * вместе со сдвигом он превращает «текст проступил» в «предмет положили
 * на стол». Больше брать нельзя — карточка начнёт выглядеть надвигающейся
 * на читателя.
 *
 * Настройка «меньше движения» — не украшение: требования велят уважать
 * настройку системы, и у человека, которого движение укачивает, карточки
 * обязаны просто появиться. Это делает правило `.qo-reveal` в index.css.
 */
export function Reveal({
  children,
  delay = 0,
  index,
  className,
}: {
  children: ReactNode;
  /** Класс обёртки — место в сетке (`col-span-2`), которое иначе некому нести. */
  className?: string;
  delay?: number;
  /**
   * Место в списке — вместо задержки, посчитанной на каждом экране заново.
   *
   * Каскад идёт по первым шести элементам и дальше не растёт: на витрине
   * в пятьдесят позиций честная задержка по номеру означала бы, что
   * последняя строка появится через две секунды после первой, — то есть
   * список, который дорисовывается на глазах, вместо списка.
   *
   * Шаг в сорок миллисекунд — тот же, что стоял на витрине числом. Здесь
   * он один на кабинет: каскад, набранный по месту, у соседнего списка
   * оказывается другим, и два списка на одном экране идут вразнобой.
   */
  index?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '-40px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const start = index === undefined ? delay : Math.min(index, 5) * 0.04;

  return (
    <div
      ref={ref}
      className={cn('qo-reveal', className)}
      data-shown={shown || undefined}
      style={start ? { transitionDelay: `${start}s` } : undefined}
    >
      {children}
    </div>
  );
}

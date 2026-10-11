import { useEffect, useRef, useState } from 'react';
import { useMotion } from './motionLevel';

/**
 * Число, которое досчитывается до нового значения, — сумма не перескакивает,
 * и видно, что она изменилась. «Спокойно» — новое значение сразу.
 */
export function useCountUp(value: number, duration = 400): number {
  const level = useMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (level === 'calm' || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      // По дороге — целые: дробная часть мелькала бы; в конце — точное значение.
      const next = t === 1 ? value : Math.round(origin + (value - origin) * eased);
      from.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration, level]);

  return shown;
}

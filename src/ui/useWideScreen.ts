import { useEffect, useState } from 'react';

/** Порог широкой раскладки — тот же, что у Tailwind `lg`. */
const WIDE = '(min-width: 1024px)';

/**
 * Широкий ли экран — вопросом к браузеру, а не классами.
 *
 * Там, где раскладки различаются только оформлением, хватает `lg:` — CSS
 * дешевле и не ждёт JavaScript. Но там, где на разных ширинах должно быть
 * РАЗНОЕ ДЕРЕВО, класс не годится: спрятанная `display: none` половина всё
 * равно стоит в разметке, и экранный диктор читает оба варианта, а переход
 * по табу проходит через невидимое.
 *
 * Один хук на приложение, а не копия в каждой фиче: порог обязан совпадать
 * с `lg` Tailwind, и разъехавшись однажды, эти два числа дают раскладку,
 * которая на 1023 точках уже не телефон, но ещё не монитор.
 */
export function useWideScreen(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);

  useEffect(() => {
    const media = window.matchMedia(WIDE);
    const listen = () => setWide(media.matches);
    listen();
    media.addEventListener('change', listen);
    return () => media.removeEventListener('change', listen);
  }, []);

  return wide;
}

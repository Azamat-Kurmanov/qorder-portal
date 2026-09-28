import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Склейка классов с разрешением споров Tailwind.
 *
 * Без `twMerge` переданный снаружи `px-6` не побеждает собственный `px-4`
 * компонента — в CSS выигрывает не последний класс в строке, а тот, что стоит
 * позже в таблице стилей. Компонент, который нельзя переопределить снаружи,
 * приходится форкать, и вместо одной кнопки в проекте заводится четыре.
 */
// Ступени шкалы текста из index.css: без них `text-caption` для twMerge —
// цвет, и рядом с `text-ink` один из двух классов молча пропадал бы.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['2xs', 'caption', 'body', 'lead', 'title'] } },
});

export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}

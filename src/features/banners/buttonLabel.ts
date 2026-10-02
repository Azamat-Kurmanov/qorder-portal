/**
 * Подпись кнопки и плашки баннера на телефоне.
 *
 * Кнопка там узкая, и длинная подпись («Смотреть товары со скидкой») либо
 * обрезалась многоточием, либо раздувала кнопку в три строки. Укорачиваем
 * по словам, а не по буквам: «Смотреть товары» понятно, «Смотреть тов…» —
 * нет. Короткий предлог в начале не отрывается от следующего слова:
 * «В каталог» не превращается в «В».
 *
 * Один и тот же файл лежит в редакторе продавца (`front`) и в кабинете
 * клиента (`portal`): продавец видит под полем ровно ту подпись, которую
 * покупатель увидит на телефоне.
 */
export const PHONE_BUTTON_MAX = 16;

/** Плашка над заголовком: на телефоне колонка текста узкая, и длинная обрезалась многоточием. */
export const PHONE_BADGE_MAX = 18;

/** Слово короче этого — предлог или союз: одно на кнопке ничего не значит. */
const SHORT_WORD = 4;

/** Плашка над заголовком на телефоне — так же, по словам. */
export function phoneBadgeText(text: string): string {
  return phoneButtonText(text, PHONE_BADGE_MAX);
}

export function phoneButtonText(text: string, max = PHONE_BUTTON_MAX): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  let out = '';
  for (const word of clean.split(' ')) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > max && out.length >= SHORT_WORD) break;
    out = next;
  }
  // Знак препинания в конце обрубка («Скидки, …») — хвост разорванной фразы.
  return out.replace(/[\s,.:;!?—–-]+$/u, '');
}

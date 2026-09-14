/**
 * Ступени размера интерфейса.
 *
 * Именно интерфейса, а не одного текста. Ступень меняет размер шрифта КОРНЯ
 * страницы, а высоты кнопок, поля и промежутки заданы в `rem` — вместе
 * с буквами растут и цели под палец. Увеличить одни буквы значило бы набить
 * крупный текст в прежние тесные кнопки: читать стало бы легче, а попадать
 * труднее, чем было.
 *
 * Ступеней три, а не ползунок: человек, которому мелко, выбирает «крупнее»
 * и возвращается к делу, а не подбирает проценты. Названы они словами,
 * а не числами, по той же причине.
 */
export const FONT_SCALES = ['normal', 'large', 'huge'] as const;

export type FontScale = (typeof FONT_SCALES)[number];

const KEY = 'q-order.portal.font-scale';

/**
 * Хранилище может не работать — и это не повод не открыть кабинет.
 *
 * В приватном окне и при запрещённых данных сайта обращение к `localStorage`
 * бросает исключение на самом доступе к свойству. Тогда размер возвращается
 * к обычному при каждом заходе: помнить выбор негде. Это хуже, чем помнить,
 * но лучше, чем белый экран вместо витрины. Тот же приём, что у ответа
 * о языке, — и по той же причине.
 */
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Выбранная ступень — или обычная, если не выбирали или выбрали неизвестное. */
export function currentFontScale(): FontScale {
  try {
    const stored = storage()?.getItem(KEY);
    return (FONT_SCALES as readonly string[]).includes(stored ?? '')
      ? (stored as FontScale)
      : 'normal';
  } catch {
    return 'normal';
  }
}

/** Запомнить ступень. */
export function rememberFontScale(scale: FontScale): void {
  try {
    storage()?.setItem(KEY, scale);
  } catch {
    // Записать некуда — откроется обычным. См. `storage`.
  }
}

/**
 * Объявить ступень странице.
 *
 * Признаком на корне, а не размером инлайном: правило размера тогда живёт
 * в таблице стилей рядом с остальными, его видно при чтении `index.css`,
 * и подобрать значения можно там же, не перебирая код.
 *
 * Обычная ступень признака не оставляет: она и есть умолчание таблицы,
 * и `data-font-scale="normal"` означал бы, что умолчание задано дважды —
 * в CSS и здесь, — а расходиться такие пары начинают через месяц.
 */
export function applyFontScale(scale: FontScale): void {
  const root = document.documentElement;
  if (scale === 'normal') delete root.dataset.fontScale;
  else root.dataset.fontScale = scale;
}

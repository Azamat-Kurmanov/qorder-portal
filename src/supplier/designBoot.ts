/**
 * Оформление магазина — до первого кадра.
 *
 * Дизайн продавца приходит со списком магазинов, то есть после входа и
 * запроса: секунду-две кабинет стоял в оформлении по умолчанию, а потом
 * перекрашивался целиком. Готовая таблица стилей последнего открытого
 * магазина лежит в хранилище браузера, и скрипт в `index.html` ставит её
 * до того, как что-либо нарисовано. Ключ и id элемента продублированы там —
 * разойтись им не даёт `designBoot.test.ts`.
 *
 * Хранится только CSS — цвета, фон, шрифты. Сам список магазинов (имена,
 * счётчики) в хранилище не кладётся: на общем компьютере его увидел бы
 * следующий, кто откроет кабинет.
 */
export const DESIGN_CSS_KEY = 'q-order.portal.design-css';
export const BOOT_STYLE_ID = 'qo-design-boot';

export function rememberDesignCss(css: string | null): void {
  try {
    if (css) window.localStorage.setItem(DESIGN_CSS_KEY, css);
    else window.localStorage.removeItem(DESIGN_CSS_KEY);
  } catch {
    // Хранилище запрещено — в следующий раз кабинет откроется как раньше.
  }
}

/** Настоящее оформление уже на странице — стартовая копия больше не нужна. */
export function dropBootDesign(): void {
  document.getElementById(BOOT_STYLE_ID)?.remove();
}

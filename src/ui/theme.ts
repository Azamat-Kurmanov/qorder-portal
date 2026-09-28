import { useSyncExternalStore } from 'react';

/**
 * Светлая и тёмная тема кабинета.
 *
 * Решают двое, и порядок важен. Продавец задаёт тему, в которой покупатель
 * впервые видит кабинет («Ночь» — тёмная, «Классика» — светлая). Покупатель
 * может переключить её у себя — и тогда его выбор главнее: человек, которому
 * вечером больно смотреть на белое, не должен зависеть от вкуса магазина.
 *
 * Обе записи лежат в хранилище браузера. Выбор покупателя — понятно почему.
 * Тема продавца — потому что её узнают из ответа сервера, то есть уже после
 * первого кадра, а скрипт в `index.html` должен знать её ДО него: иначе
 * покупатель «Ночи» при каждом заходе видел бы вспышку белого кабинета.
 * Запоминается последняя увиденная — у покупателя одного магазина она и есть
 * нужная, а у нескольких ошибка стоит одного мигания при смене магазина.
 *
 * Ключи продублированы в скрипте `index.html`; разойтись им не даст
 * проверка `theme.test.ts`.
 */
const THEMES = ['light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_KEY = 'q-order.portal.theme';
export const THEME_DEFAULT_KEY = 'q-order.portal.theme-default';

/** Хранилище может быть запрещено — тогда тема просто не запоминается. См. `fontScale.ts`. */
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Запасная память на случай запрещённого хранилища — до перезагрузки страницы. */
const memory = new Map<string, Theme>();

function read(key: string): Theme | null {
  let stored: string | null | undefined;
  try {
    const store = storage();
    stored = store ? store.getItem(key) : memory.get(key);
  } catch {
    stored = memory.get(key);
  }
  return (THEMES as readonly string[]).includes(stored ?? '') ? (stored as Theme) : null;
}

function write(key: string, theme: Theme): void {
  memory.set(key, theme);
  try {
    storage()?.setItem(key, theme);
  } catch {
    // Записать некуда — тема продержится в памяти до перезагрузки.
  }
}

/** Выбор покупателя; `null` — не выбирал, действует тема продавца. */
function chosenTheme(): Theme | null {
  return read(THEME_KEY);
}

/** Тема, которая сейчас на экране. */
export function currentTheme(): Theme {
  return chosenTheme() ?? read(THEME_DEFAULT_KEY) ?? 'light';
}

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/**
 * Объявить тему странице признаком корня.
 *
 * Признаком, а не классом на обёртке: тёмные значения токенов живут
 * в `index.css` под `html[data-theme='dark']` и должны действовать и на
 * выдвижные листы, которые рисуются вне оболочки. `color-scheme` — чтобы
 * полосы прокрутки и выпадающие списки браузера тоже стали тёмными.
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

/** Покупатель выбрал тему сам. */
export function chooseTheme(theme: Theme): void {
  write(THEME_KEY, theme);
  applyTheme(theme);
  emit();
}

/**
 * Тема продавца по умолчанию.
 *
 * Запоминается всегда — её прочтёт скрипт до первого кадра следующего
 * захода, — а на экран попадает, только если покупатель не выбирал сам.
 */
export function setSupplierTheme(theme: Theme): void {
  if (read(THEME_DEFAULT_KEY) !== theme) write(THEME_DEFAULT_KEY, theme);
  applyTheme(currentTheme());
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Текущая тема — с перерисовкой, когда её сменили в другом месте кабинета. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'light');
}

import { vi } from 'vitest';

/**
 * Монитор: широкий порог (`useWideScreen`, 1024) совпал, остальные запросы — нет.
 *
 * По умолчанию тесты идут на «телефоне» (`setup.ts`), а там тема продавца
 * не действует. Снимать заглушку — `vi.unstubAllGlobals()`.
 */
export function stubWideScreen() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('1024'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

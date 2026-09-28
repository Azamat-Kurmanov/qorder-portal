import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_DEFAULT_KEY, THEME_KEY, chooseTheme, currentTheme, setSupplierTheme } from './theme';

describe('тема кабинета', () => {
  it('по умолчанию светлая', () => {
    expect(currentTheme()).toBe('light');
  });

  /** Продавец задаёт тему первого входа — пока покупатель не выбрал сам. */
  it('без выбора покупателя — тема продавца', () => {
    setSupplierTheme('dark');

    expect(currentTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    // Запомнена для скрипта до первого кадра следующего захода.
    expect(window.localStorage.getItem(THEME_DEFAULT_KEY)).toBe('dark');
  });

  it('выбор покупателя главнее темы продавца', () => {
    chooseTheme('light');
    setSupplierTheme('dark');

    expect(currentTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('не верит незнакомому значению в хранилище', () => {
    window.localStorage.setItem(THEME_KEY, 'sepia');

    expect(currentTheme()).toBe('light');
  });

  /**
   * Скрипт в index.html ставит тему до первого кадра и знает ключи наизусть:
   * разойдись они с кодом — тёмный кабинет мигал бы белым при каждом заходе.
   */
  it('скрипт до первого кадра читает те же ключи', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain(`'${THEME_KEY}'`);
    expect(html).toContain(`'${THEME_DEFAULT_KEY}'`);
  });
});

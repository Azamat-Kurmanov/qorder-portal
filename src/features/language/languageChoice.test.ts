import { beforeEach, describe, expect, it } from 'vitest';
import { acceptLanguageFromUrl, languageChosen } from './languageChoice';

/**
 * Экран выбора кабинета (frontend/entry) уже спросил язык и передал его
 * в адресе `?lng=` — второй раз кабинет спрашивать не должен.
 */
describe('язык из адреса экрана выбора', () => {
  beforeEach(() => window.localStorage.clear());

  it('поддерживаемый язык в адресе считается ответом', () => {
    acceptLanguageFromUrl('?lng=kk');
    expect(languageChosen()).toBe(true);
    expect(window.localStorage.getItem('q-order.portal.language-chosen')).toBe('kk');
  });

  it('незнакомый язык или его отсутствие ответом не считаются', () => {
    acceptLanguageFromUrl('?lng=de');
    acceptLanguageFromUrl('');
    expect(languageChosen()).toBe(false);
  });
});

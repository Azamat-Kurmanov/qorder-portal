import { afterEach, describe, expect, it } from 'vitest';
import { entryChooseUrl, postLogoutUrl } from './oidcConfig';

/**
 * Единый вход (frontend/entry): выход и «Сменить кабинет» ведут на экран
 * выбора, если его адрес задан. В мобильном приложении — нет: у него свой
 * экран выбора, а WebView не должен уходить на чужой сайт.
 */
describe('экран выбора кабинета', () => {
  afterEach(() => {
    delete window.__APP_CONFIG__;
    delete (window as { QOrderBridge?: unknown }).QOrderBridge;
  });

  it('адрес задан — выход ведёт на выбор с ?choose', () => {
    window.__APP_CONFIG__ = { ENTRY_URL: 'https://q-order.kz/' };
    expect(entryChooseUrl()).toBe('https://q-order.kz/?choose');
    expect(postLogoutUrl()).toBe('https://q-order.kz/?choose');
  });

  it('адрес не задан — всё как раньше: корень своего приложения', () => {
    window.__APP_CONFIG__ = { ENTRY_URL: '' };
    expect(entryChooseUrl()).toBeNull();
    expect(postLogoutUrl()).toBe(`${window.location.origin}/`);
  });

  it('в мобильном приложении выбор не предлагается', () => {
    window.__APP_CONFIG__ = { ENTRY_URL: 'https://q-order.kz' };
    (window as { QOrderBridge?: unknown }).QOrderBridge = {};
    expect(entryChooseUrl()).toBeNull();
    expect(postLogoutUrl()).toBe(`${window.location.origin}/`);
  });
});

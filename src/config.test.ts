import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Скрипт старта пода переносит в config.js любой ключ APP_* из ConfigMap.
 * Опечатка в имени ключа не роняет ничего: приложение молча берёт значение
 * сборки, а лишний ключ лежит рядом никем не прочитанный. Назвать его может
 * только приложение — только оно знает, какие ключи читает.
 */
describe('настройки стенда', () => {
  afterEach(() => {
    delete window.__APP_CONFIG__;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function freshConfig() {
    return (await import('./config')).getConfig;
  }

  it('называет ключ, которого приложение не читает', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.__APP_CONFIG__ = { KEYCLOAK_URL: 'https://sso', KEYCLOK_REALM: 'typo' } as never;
    const getConfig = await freshConfig();

    getConfig();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].join(' ')).toContain('KEYCLOK_REALM');
  });

  /** Настройки читает каждый запрос — предупреждение одно на загрузку страницы. */
  it('предупреждает один раз, а не на каждое чтение', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.__APP_CONFIG__ = { WEBURL: '/' } as never;
    const getConfig = await freshConfig();

    getConfig();
    getConfig();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('о знакомых ключах молчит', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.__APP_CONFIG__ = { API_URL: '', KEYCLOAK_URL: 'https://sso', WEB_URL: '/' };
    const getConfig = await freshConfig();

    getConfig();

    expect(warn).not.toHaveBeenCalled();
  });
});

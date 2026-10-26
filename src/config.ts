/** Public browser configuration. No credentials belong in this object. */
export interface AppConfig {
  API_URL: string;
  KEYCLOAK_URL: string;
  KEYCLOAK_REALM: string;
  KEYCLOAK_CLIENT_ID: string;
  KEYCLOAK_STAFF_REALM: string;
  KEYCLOAK_STAFF_CLIENT_ID: string;
  WEB_URL: string;
  /**
   * Экран выбора кабинета (frontend/entry), единый вход для менеджера
   * и клиента. Пусто — выход ведёт в корень этого приложения, как раньше.
   */
  ENTRY_URL: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>;
  }
}

let unknownKeysReported = false;

export function getConfig(): AppConfig {
  const runtime = typeof window === 'undefined' ? {} : (window.__APP_CONFIG__ ?? {});
  const build = import.meta.env;
  const pick = (key: keyof AppConfig, fallback: string | undefined) =>
    Object.prototype.hasOwnProperty.call(runtime, key) ? (runtime[key] ?? '') : (fallback ?? '');
  const config: AppConfig = {
    API_URL: pick('API_URL', build.VITE_API_URL),
    KEYCLOAK_URL: pick('KEYCLOAK_URL', build.VITE_KEYCLOAK_URL),
    KEYCLOAK_REALM: pick('KEYCLOAK_REALM', build.VITE_KEYCLOAK_REALM),
    KEYCLOAK_CLIENT_ID: pick('KEYCLOAK_CLIENT_ID', build.VITE_KEYCLOAK_CLIENT_ID),
    KEYCLOAK_STAFF_REALM: pick('KEYCLOAK_STAFF_REALM', build.VITE_KEYCLOAK_STAFF_REALM),
    KEYCLOAK_STAFF_CLIENT_ID: pick('KEYCLOAK_STAFF_CLIENT_ID', build.VITE_KEYCLOAK_STAFF_CLIENT_ID),
    WEB_URL: pick('WEB_URL', build.VITE_WEB_URL),
    ENTRY_URL: pick('ENTRY_URL', build.VITE_ENTRY_URL),
  };

  // Скрипт старта пода переносит сюда любой ключ APP_* из ConfigMap, и опечатка
  // в имени не роняет ничего: нужный ключ молча берётся из сборки. Список
  // знакомых ключей — сам объект выше, второго списка нет. Настройки читает
  // каждый запрос, поэтому предупреждение одно на загрузку страницы.
  if (!unknownKeysReported) {
    unknownKeysReported = true;
    const unknown = Object.keys(runtime).filter((key) => !(key in config));
    if (unknown.length > 0) {
      console.warn(`config.js: unknown keys ${unknown.join(', ')} are ignored — typo in ConfigMap?`);
    }
  }

  return config;
}

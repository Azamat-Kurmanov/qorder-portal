import { UserManager, WebStorageStateStore, type StateStore } from 'oidc-client-ts';

/** Куда вести клиента, если адрес начала входа неизвестен. */
export const DEFAULT_RETURN_TO = '/catalog';

/** Путь возврата с Keycloak: он же redirect_uri клиента и маршрут экрана возврата. */
export const CALLBACK_PATH = '/callback';

/** Куда Keycloak возвращает браузер после выхода. */
export const POST_LOGOUT_PATH = '/';

/**
 * Хранилище пользователя в памяти вкладки.
 *
 * Токены не кладутся ни в localStorage, ни в sessionStorage: refresh-токен там
 * — лишний путь к XSS. Данные не переживают перезагрузку, и это правильно:
 * после неё нужен новый вход, а не токен, поднятый с диска.
 */
class InMemoryStateStore implements StateStore {
  private readonly data = new Map<string, string>();

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async remove(key: string): Promise<string | null> {
    const value = this.data.get(key) ?? null;
    this.data.delete(key);
    return value;
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.data.keys());
  }
}

let manager: UserManager | null = null;

/**
 * Клиент Keycloak кабинета: Authorization Code + PKCE, публичный клиент
 * в realm клиентов — не в realm сотрудников.
 *
 * Realm разные намеренно: у токенов разные издатели, и клиент не получит
 * рабочее место менеджера ни при какой ошибке маппинга ролей.
 *
 * Состояние запроса входа (verifier PKCE и nonce) живёт в sessionStorage,
 * в отличие от самого пользователя: оно создаётся до ухода на Keycloak,
 * а читается после возврата — то есть после перезагрузки страницы.
 */
export function getUserManager(): UserManager {
  if (manager) return manager;

  const authority = `${import.meta.env.VITE_KEYCLOAK_URL}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}`;

  manager = new UserManager({
    authority,
    client_id: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
    redirect_uri: `${window.location.origin}${CALLBACK_PATH}`,
    post_logout_redirect_uri: `${window.location.origin}${POST_LOGOUT_PATH}`,
    response_type: 'code',
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    userStore: new InMemoryStateStore(),
  });

  return manager;
}

/**
 * Адрес, с которого начинался вход, — или каталог, если его нет.
 *
 * Значение приходит с той стороны редиректа и разбирается как чужое: наружу
 * выпускается только внутренний путь. Сравнения строк мало — `//evil.example`
 * браузер считает абсолютным адресом, а обратный слэш для http(s) равен
 * прямому, поэтому строка разбирается тем же парсером, что и в браузере.
 */
export function returnToOf(state: unknown): string {
  const returnTo = (state as { returnTo?: unknown } | null | undefined)?.returnTo;
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/')) return DEFAULT_RETURN_TO;

  let parsed: URL;
  try {
    parsed = new URL(returnTo, window.location.origin);
  } catch {
    return DEFAULT_RETURN_TO;
  }

  if (parsed.origin !== window.location.origin) return DEFAULT_RETURN_TO;
  if (parsed.pathname === CALLBACK_PATH) return DEFAULT_RETURN_TO;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Обменивает код авторизации на токен и отдаёт адрес возврата. */
export async function completeSigninRedirect(): Promise<string> {
  const user = await getUserManager().signinRedirectCallback();
  return returnToOf(user.state);
}

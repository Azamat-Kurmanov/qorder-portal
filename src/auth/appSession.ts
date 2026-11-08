import { User, type UserManager } from 'oidc-client-ts';
import { isAvailable, readSecret, storeSecret } from '../shared/webview/bridge';

/**
 * Сессия в мобильном приложении (back/qorder/docs/mobile.md §5).
 *
 * В браузере токены живут только в памяти вкладки, и перезагрузка — это
 * новый вход. В приложении человек не должен входить паролем каждое утро:
 * сессия целиком (с offline-токеном) лежит в Keychain/Keystore через мост,
 * а приложение открывает её PIN-кодом или биометрией. В браузере моста нет,
 * и обе функции ничего не делают.
 */
export const SESSION_KEY = 'qo.session';

/**
 * Сессия стёрта в этой странице. Выход стирает её до `revokeTokens`, а тот,
 * отозвав refresh-токен, сохраняет пользователя заново и шлёт `userLoaded`:
 * без запрета сессия вернулась бы в приложение, и оно просило бы новый PIN
 * вместо входа. Новый вход идёт через Keycloak — это новая страница.
 */
let cleared = false;

/**
 * Номер последнего входа. Переживает выход: следующая форма входа приходит
 * с ним (`login_hint`), и остаётся ввести пароль. Стирается вместе со всем
 * хранилищем, когда человек забыл PIN. Ключ свой, не как у рабочего места
 * менеджера: иначе в форму клиента подставлялся номер менеджера.
 */
export const LAST_LOGIN_KEY = 'qo.lastLogin.client';

/** Положить сессию в хранилище приложения; `null` — стереть (выход). */
export function persistSession(user: User | null): void {
  if (!isAvailable()) return;
  if (user && cleared) return;
  cleared = !user;
  storeSecret(SESSION_KEY, user ? user.toStorageString() : '');
  const login = user?.profile.preferred_username;
  if (login) storeSecret(LAST_LOGIN_KEY, login);
}

/** Чем заполнить логин на форме входа; в браузере — ничем. */
export async function lastLogin(): Promise<string | undefined> {
  return (await readSecret(LAST_LOGIN_KEY)) || undefined;
}

/**
 * Поднять сохранённую сессию и обменять её refresh-токен на свежий доступ.
 *
 * Не вышло (токен отозван или истёк, запись испорчена) — запись стирается,
 * и дальше обычный вход: оставленная мёртвая сессия возвращала бы сюда же
 * на каждом запуске.
 */
export async function restoreSession(manager: UserManager): Promise<boolean> {
  const stored = await readSecret(SESSION_KEY);
  if (!stored) return false;
  try {
    await manager.storeUser(User.fromStorageString(stored));
    return (await manager.signinSilent()) !== null;
  } catch {
    persistSession(null);
    await manager.removeUser().catch(() => undefined);
    return false;
  }
}

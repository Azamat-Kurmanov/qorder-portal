/**
 * Мост между состоянием AuthProvider и мутатором запросов.
 *
 * apiRequest (src/api/client.ts) — обычная функция вне дерева React: контекста
 * у неё нет. Провайдер синхронизирует сюда токен и способ начать вход заново,
 * а мутатор читает их напрямую.
 */
let currentToken: string | null = null;
let reauthenticate: () => void = () => {};

/**
 * Сколько времени после завершённого входа отказ сервера считается отказом
 * самому входу, а не истёкшей сессии. Тридцать секунд — запас на медленный
 * старт, а не измерение.
 */
const SIGNIN_GRACE_MS = 30_000;

const COMPLETED_AT_KEY = 'qo.portal.signinCompletedAt';
const REJECTED_KEY = 'qo.portal.sessionRejected';

const rejectionListeners = new Set<() => void>();

/**
 * Метки живут в sessionStorage, а не в памяти: между завершением входа
 * и первым ответом сервера стоит уход на Keycloak и возврат, то есть полная
 * перезагрузка страницы. Хранилище может быть недоступно — тогда предохранителя
 * просто нет, и поведение возвращается к прежнему.
 */
function readMark(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeMark(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Хранилище недоступно — работаем без предохранителя.
  }
}

export function setSession(token: string | null, onReauthenticate: () => void): void {
  currentToken = token;
  reauthenticate = onReauthenticate;
}

export function getSessionToken(): string | null {
  return currentToken;
}

/** Вызывается экраном возврата после удачного обмена кода на токен. */
export function markSigninCompleted(): void {
  writeMark(COMPLETED_AT_KEY, String(Date.now()));
  writeMark(REJECTED_KEY, null);
}

export function isSessionRejected(): boolean {
  return readMark(REJECTED_KEY) !== null;
}

export function subscribeSessionRejected(listener: () => void): () => void {
  rejectionListeners.add(listener);
  return () => {
    rejectionListeners.delete(listener);
  };
}

function signedInJustNow(): boolean {
  const completedAt = readMark(COMPLETED_AT_KEY);
  if (completedAt === null) return false;
  return Date.now() - Number(completedAt) < SIGNIN_GRACE_MS;
}

/**
 * Сервер ответил 401. Обычно это истёкшая сессия, и лечится она новым входом.
 *
 * Но если вход завершился только что, новый ничего не изменит: браузер уйдёт
 * на Keycloak, живая сессия немедленно вернёт код, экран снова получит 401 —
 * и страница будет перезагружаться сама без конца. Такой отказ признаётся
 * отказом сессии и показывается словами, а повторную попытку делает человек.
 *
 * Возвращает, начат ли новый вход: мутатору запросов от этого зависит,
 * отдавать ли экрану ошибку или ждать ухода со страницы.
 */
export function requestReauthentication(): boolean {
  if (signedInJustNow() || isSessionRejected()) {
    writeMark(REJECTED_KEY, '1');
    rejectionListeners.forEach((listener) => listener());
    return false;
  }
  reauthenticate();
  return true;
}

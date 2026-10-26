import { useEffect, useRef } from 'react';
import { getForgetPortalPushDeviceUrl, registerPortalPushDevice } from '../../api/generated';
import { getSessionToken } from '../../auth/session';
import { getConfig } from '../../config';
import {
  isAvailable,
  PUSH_OPENED_EVENT,
  PUSH_TOKEN_EVENT,
  pushToken,
  takeNotification,
  type OpenedPush,
} from './bridge';

/**
 * Push в мобильном приложении (back/qorder/docs/mobile.md §6).
 *
 * Копия рабочего места (`front/src/shared/webview/push.ts`) с другими адресами
 * регистрации — по той же причине, что и обёртка моста.
 */

/** Токен, зарегистрированный в этой вкладке: его отвязывает выход. */
let registered: string | null = null;

/** Человек вышел: новый токен от FCM за ним больше не регистрируется. */
let signedOut = false;

/** Отвязка не ждёт сервер дольше: выход не должен висеть на ней. */
const FORGET_TIMEOUT_MS = 5_000;

/**
 * Пока человек вошёл: устройство зарегистрировано за ним, а уведомление,
 * которого коснулись, открыто. В браузере ничего не делает.
 *
 * Уведомление веб забирает сам — при запуске и по событию приложения:
 * на холодном старте касание случается раньше, чем поднимается страница.
 */
export function usePushDevice(onOpened: (push: OpenedPush) => void): void {
  const opened = useRef(onOpened);
  opened.current = onOpened;

  useEffect(() => {
    if (!isAvailable()) return;
    const register = async () => {
      if (signedOut) return;
      const device = await pushToken();
      if (!device || signedOut) return;
      try {
        await registerPortalPushDevice(device);
        registered = device.token;
      } catch {
        // Не вышло — плашки в кабинете остаются; повторим при следующем запуске.
      }
    };
    const open = async () => {
      const push = await takeNotification();
      if (push) opened.current(push);
    };
    void register();
    void open();
    window.addEventListener(PUSH_TOKEN_EVENT, register);
    window.addEventListener(PUSH_OPENED_EVENT, open);
    return () => {
      window.removeEventListener(PUSH_TOKEN_EVENT, register);
      window.removeEventListener(PUSH_OPENED_EVENT, open);
    };
  }, []);
}

/**
 * Выход: устройство больше не получает push этого человека.
 *
 * Прямой `fetch`, а не `apiRequest`: на 401 тот начинает новый вход, и выход
 * с истёкшим токеном оборачивался бы входом. `keepalive` доносит запрос,
 * когда страница уже ушла на Keycloak, поэтому выход его не ждёт. Отказ —
 * не беда: приложение само удаляет токен FCM, когда сессия стёрта, и сервер
 * вычеркнет устройство по ответу FCM.
 */
export function forgetRegisteredDevice(): void {
  signedOut = true;
  const token = registered;
  const access = getSessionToken();
  registered = null;
  if (!token || !access) return;
  void fetch(`${getConfig().API_URL}${getForgetPortalPushDeviceUrl({ token })}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${access}` },
    keepalive: true,
    signal: AbortSignal.timeout(FORGET_TIMEOUT_MS),
  }).catch(() => undefined);
}

import { countShareCart } from '../../api/generated';

const KEY = 'qo.share';

/**
 * Визит по ссылке «Поделиться» (R-07) живёт во вкладке: вход Keycloak уводит со страницы и
 * возвращает обратно, а память вкладки переживает переход, в отличие от состояния приложения.
 */
export function rememberShareVisit(code: string, kind: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ code, kind }));
  } catch {
    // Хранилище закрыто (приватный режим) — воронка недосчитает, работе это не мешает.
  }
}

/** Первое добавление в корзину после перехода — в счёт; визит забывается, второе уже не считается. */
export function reportShareCart() {
  let visit: { code?: string; kind?: string } | null;
  try {
    visit = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
  if (visit?.code && visit.kind) void countShareCart(visit.code, visit.kind).catch(() => undefined);
}

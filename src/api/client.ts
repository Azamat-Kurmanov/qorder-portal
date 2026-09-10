import { getSessionToken, requestReauthentication } from '../auth/session';
import { currentSupplierId } from '../supplier/supplier';
import { currentLanguage } from '../i18n';

const NO_BODY_STATUSES = new Set([204, 205, 304]);

/** Заголовок, которым кабинет называет поставщика, к которому обращается клиент. */
const SUPPLIER_HEADER = 'X-Supplier-Id';

/**
 * Бросается вместо обычной ошибки, когда сервер отвечает 401.
 *
 * requestReauthentication() к этому моменту уже вызван и уводит человека
 * на новый вход, но редирект не мгновенен: отклонённый промис долетает
 * до экрана раньше, чем браузер уходит со страницы. Экран обязан отличить
 * этот случай от сбоя сервера и не рисовать ошибку — по классу и статусу,
 * а не по тексту сообщения.
 */
export class ReauthenticationRequiredError extends Error {
  readonly status = 401 as const;

  constructor(url: string) {
    super(`Unauthorized request to ${url}`);
    this.name = 'ReauthenticationRequiredError';
  }
}

/**
 * Мутатор orval: единственное место, где собирается HTTP-запрос кабинета.
 *
 * Здесь же выставляется заголовок поставщика — и только здесь. Экран,
 * выставляющий его сам, получил бы отказ на первом же забытом запросе,
 * а выставленный вручную рано или поздно оказался бы чужим. На сервере
 * это правило закреплено архитектурным тестом, здесь — одним слоем.
 *
 * Успешный ответ отдаётся обёрткой `{ data, status, headers }`: такую форму
 * объявляет генерация, и экраны различают ветки по `status`.
 */
export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  // Тексты ошибок приходят с сервера уже на языке заголовка: расхождение
  // с языком интерфейса выглядело бы как чужая ошибка на чужом экране.
  headers.set('Accept-Language', currentLanguage());

  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const supplier = currentSupplierId();
  if (supplier) headers.set(SUPPLIER_HEADER, supplier);

  const response = await fetch(`${import.meta.env.VITE_API_URL}${url}`, { ...options, headers });

  if (response.status === 401) {
    requestReauthentication();
    throw new ReauthenticationRequiredError(url);
  }

  // Документ приходит документом. Разобранный как JSON, PDF падает на первом
  // же байте, и человек видит поломку кабинета там, где сервер ответил как
  // надо. Отказы при этом остаются разбираемыми: их сервер отдаёт
  // как problem+json при любом типе успешного ответа. Пустой тип содержимого
  // ведёт себя как раньше — ответ без тела не файл.
  const contentType = response.headers.get('content-type') ?? '';
  const isFile = response.ok && contentType !== '' && !contentType.includes('json');

  if (isFile && !NO_BODY_STATUSES.has(response.status)) {
    return { data: await response.blob(), status: response.status, headers: response.headers } as T;
  }

  const body = NO_BODY_STATUSES.has(response.status) ? null : await response.text();
  const data = body ? JSON.parse(body) : undefined;

  if (!response.ok) {
    const error = new Error(`Request to ${url} failed with status ${response.status}`) as Error & {
      info?: unknown;
      status?: number;
    };
    error.info = data;
    error.status = response.status;
    throw error;
  }

  return { data, status: response.status, headers: response.headers } as T;
}

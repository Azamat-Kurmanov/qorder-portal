import { getConfig } from '../config';
import { getSessionToken, requestReauthentication } from '../auth/session';
import { currentSupplierId } from '../supplier/supplier';
import { currentPickupPoint } from '../supplier/pickupPoint';
import { currentLanguage } from '../i18n';

const NO_BODY_STATUSES = new Set([204, 205, 304]);

/** Заголовок, которым кабинет называет поставщика, к которому обращается клиент. */
const SUPPLIER_HEADER = 'X-Supplier-Id';

/**
 * Бросается вместо обычной ошибки, когда сервер отказал сессии (401 на запрос
 * с токеном), а нового входа не будет: он только что завершился, и повтор
 * замкнул бы круг редиректов. Экран закрывает RequireAuth словами об отказе;
 * тело ответа лежит в `info`, как у любого отказа, — открытому без входа
 * экрану оно нужно, чтобы назвать причину.
 */
export class ReauthenticationRequiredError extends Error {
  readonly status = 401 as const;

  constructor(url: string, readonly info?: unknown) {
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
/** Доля отправленного тела запроса: от 0 до 1. */
export type UploadProgress = (fraction: number) => void;

/** Опции запроса: то, что понимает fetch, и прогресс отправки файла. */
export type ApiRequestOptions = RequestInit & {
  /**
   * Задан — файл (тело `FormData`) уходит через XMLHttpRequest: fetch не
   * сообщает, сколько уже отправлено, а снимок с телефона на мобильной связи
   * грузится долго, и человеку нужен процент.
   */
  onUploadProgress?: UploadProgress;
};

export async function apiRequest<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const { onUploadProgress, ...init } = options;
  const headers = new Headers(init.headers);

  // Тексты ошибок приходят с сервера уже на языке заголовка: расхождение
  // с языком интерфейса выглядело бы как чужая ошибка на чужом экране.
  headers.set('Accept-Language', currentLanguage());

  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const supplier = currentSupplierId();
  if (supplier) headers.set(SUPPLIER_HEADER, supplier);
  // Точка самовывоза из шапки: по её складу сервер считает наличие витрины и корзины.
  const point = currentPickupPoint();
  if (point) headers.set('X-Pickup-Point', point);

  const target = `${getConfig().API_URL}${url}`;
  const response = onUploadProgress && init.body instanceof FormData
    ? await sendWithProgress(target, init, headers, onUploadProgress)
    : await fetch(target, { ...init, headers });

  // Новый вход лечит только истёкшую сессию. Анонимный запрос (активация
  // приглашения) получает 401 как отказ по существу: его тело разбирается
  // ниже, как у любого другого отказа, и экран показывает причину словами.
  if (response.status === 401 && token) {
    // Начат новый вход — запрос не завершается вовсе. Редирект не мгновенен,
    // и отклонённый промис долетел бы до экрана раньше, чем браузер уйдёт
    // со страницы: экран нарисовал бы сбой, которого не было. Проверять это
    // в каждом экране — значит однажды забыть в новом.
    if (requestReauthentication()) return new Promise<never>(() => {});
    // Отказ сессии может прийти и не от нашего сервера (страница прокси),
    // а класс ошибки обязан уцелеть при любом теле.
    let info: unknown;
    try {
      info = JSON.parse(await response.text());
    } catch {
      info = undefined;
    }
    throw new ReauthenticationRequiredError(url, info);
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

/**
 * Тот же запрос через XMLHttpRequest — ради события отправки `upload.onprogress`.
 * Ответ собирается в обычный Response: дальше он разбирается тем же путём,
 * что и ответ fetch, и правила отказов и входа не расходятся.
 */
function sendWithProgress(target: string, init: RequestInit, headers: Headers,
                          onProgress: UploadProgress): Promise<Response> {
  return new Promise((resolve, reject) => {
    // Отменённый до отправки не уходит вовсе — как и у fetch.
    if (init.signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(init.method ?? 'POST', target);
    headers.forEach((value, name) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      const empty = NO_BODY_STATUSES.has(xhr.status) || xhr.responseText === '';
      resolve(new Response(empty ? null : xhr.responseText,
        { status: xhr.status, headers: responseHeaders(xhr.getAllResponseHeaders()) }));
    };
    // Обрыв сети — тем же TypeError, каким его отдаёт fetch.
    xhr.onerror = () => reject(new TypeError('Failed to fetch'));
    xhr.onabort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
    const abort = () => xhr.abort();
    init.signal?.addEventListener('abort', abort, { once: true });
    // Запрос завершён — слушатель отмены больше не нужен и не держит xhr в памяти.
    xhr.onloadend = () => init.signal?.removeEventListener('abort', abort);
    xhr.send(init.body as FormData);
  });
}

function responseHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const colon = line.indexOf(':');
    if (colon > 0) headers.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
  }
  return headers;
}


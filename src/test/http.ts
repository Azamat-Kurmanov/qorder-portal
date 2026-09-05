import { vi } from 'vitest';

/** Что вернуть на запрос: тело, статус и признак совпадения по адресу. */
export interface StubbedResponse {
  match: (url: string, init?: RequestInit) => boolean;
  status?: number;
  body?: unknown;
}

/**
 * Подмена fetch на набор правил.
 *
 * Подменяется именно fetch, а не сгенерированный клиент: так проверяется
 * и мутатор запросов — заголовки, разбор ответа, обработка отказов, — а не
 * только разметка экрана. Незаявленный запрос падает с внятным адресом:
 * молчаливый ответ «ничего» превратил бы такую ошибку в пустой экран.
 */
export function stubFetch(rules: StubbedResponse[]) {
  const calls: { url: string; init?: RequestInit }[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });

    const rule = rules.find((candidate) => candidate.match(url, init));
    if (!rule) throw new Error(`Незаявленный запрос: ${init?.method ?? 'GET'} ${url}`);

    const status = rule.status ?? 200;
    return new Response(rule.body === undefined ? null : JSON.stringify(rule.body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

/** Правило: любой запрос по адресу, начинающемуся так. */
export function get(path: string, body: unknown, status = 200): StubbedResponse {
  return {
    match: (url, init) => url.includes(path) && (init?.method ?? 'GET') === 'GET',
    body,
    status,
  };
}

export function method(httpMethod: string, path: string, body: unknown, status = 200): StubbedResponse {
  return {
    match: (url, init) => url.includes(path) && init?.method === httpMethod,
    body,
    status,
  };
}

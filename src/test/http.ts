import { vi } from 'vitest';

/** Что вернуть на запрос: тело, статус и признак совпадения по адресу. */
export interface StubbedResponse {
  match: (url: string, init?: RequestInit) => boolean;
  status?: number;
  body?: unknown;
  /**
   * Заголовки ответа. Нужны там, где ответ не JSON: тип содержимого решает,
   * разбирать тело или отдавать файлом, а имя файла приходит заголовком —
   * заглушка, отвечающая всегда одинаково, эту развилку не проверила бы вовсе.
   */
  headers?: Record<string, string>;
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
    const headers = new Headers({ 'content-type': 'application/json', ...rule.headers });

    // Не-JSON отдаётся как есть: обёрнутое в JSON.stringify содержимое файла
    // перестало бы быть содержимым файла, и проверка скачивания доказывала бы
    // только то, что заглушка умеет кавычки.
    const json = headers.get('content-type')?.includes('json') ?? false;
    const body = rule.body === undefined
      ? null
      : json ? JSON.stringify(rule.body) : String(rule.body);

    return new Response(body, { status, headers });
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

/** Правило: файл по адресу — с типом содержимого и именем, как отдаёт сервер. */
export function file(path: string, content: string, fileName: string): StubbedResponse {
  return {
    match: (url, init) => url.includes(path) && (init?.method ?? 'GET') === 'GET',
    body: content,
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${fileName}"`,
    },
  };
}

export function method(httpMethod: string, path: string, body: unknown, status = 200): StubbedResponse {
  return {
    match: (url, init) => url.includes(path) && init?.method === httpMethod,
    body,
    status,
  };
}

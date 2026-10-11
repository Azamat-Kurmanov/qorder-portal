/**
 * Поддельный XMLHttpRequest: отдаёт управление тесту — тот двигает прогресс
 * отправки и завершает запрос нужным ответом.
 */
export class FakeXhr {
  static last: FakeXhr;
  /** Все созданные — по порядку: экран может слать файлы друг за другом. */
  static all: FakeXhr[] = [];
  method = '';
  url = '';
  headers = new Map<string, string>();
  body: unknown;
  status = 0;
  responseText = '';
  private responseHeaders = '';
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
    FakeXhr.all.push(this);
  }
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); }
  send(body: unknown) { this.body = body; }
  abort() { this.onabort?.(); }
  getAllResponseHeaders() { return this.responseHeaders; }

  progress(loaded: number, total: number) { this.upload.onprogress?.({ lengthComputable: true, loaded, total }); }
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = body === undefined ? '' : JSON.stringify(body);
    this.responseHeaders = 'content-type: application/json\r\n';
    this.onload?.();
  }
}

/**
 * XMLHttpRequest поверх подменённого `fetch`: экраны, которые шлют файл с прогрессом,
 * проверяются теми же заглушками `fetch`, что и остальные запросы.
 */
export class FetchBackedXhr {
  method = '';
  url = '';
  private readonly headers = new Headers();
  status = 0;
  responseText = '';
  private responseHeaders = '';
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers.set(name, value); }
  abort() { this.onabort?.(); }
  getAllResponseHeaders() { return this.responseHeaders; }

  send(body: BodyInit) {
    void fetch(this.url, { method: this.method, headers: this.headers, body })
      .then(async (response) => {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 });
        this.status = response.status;
        this.responseText = await response.text();
        // Заглушки тестов бывают и не настоящим Response: заголовков у них может не быть.
        const pairs: string[] = [];
        response.headers?.forEach?.((value: string, name: string) => pairs.push(`${name}: ${value}`));
        this.responseHeaders = pairs.join('\r\n');
        this.onload?.();
      })
      .catch(() => this.onerror?.());
  }
}

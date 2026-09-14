import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileNameFrom, saveFile } from './download';

/** Заголовок ответа в том виде, в каком его отдаёт сервер. */
function disposition(value: string): Headers {
  return new Headers({ 'content-disposition': value });
}

describe('имя скачиваемого файла', () => {
  it('берётся из заголовка ответа', () => {
    expect(fileNameFrom(disposition('attachment; filename="soglasie-2026-09-08.pdf"'), 'x.pdf'))
      .toBe('soglasie-2026-09-08.pdf');
  });

  /*
   * Имя с кириллицей сервер отдаёт кодированной формой, а рядом кладёт
   * обеднённую копию в `filename`. Возьми кабинет копию — человек сохранил бы
   * файл с вопросительными знаками вместо букв.
   */
  it('кодированная форма важнее обеднённой копии', () => {
    const header = "attachment; filename=\"soglasie.pdf\"; filename*=UTF-8''%D1%81%D0%BE%D0%B3%D0%BB%D0%B0%D1%81%D0%B8%D0%B5.pdf";

    expect(fileNameFrom(disposition(header), 'x.pdf')).toBe('согласие.pdf');
  });

  // Ответ без заголовка браузер сохранил бы как «download»: опознать такой
  // файл в папке загрузок через год нечем.
  it('без заголовка остаётся запасное имя', () => {
    expect(fileNameFrom(new Headers(), 'consent-2026-09-08.pdf')).toBe('consent-2026-09-08.pdf');
  });

  it('битая кодировка не оставляет человека без файла', () => {
    expect(fileNameFrom(disposition("attachment; filename*=UTF-8''%E0%A4%A"), 'consent.pdf'))
      .toBe('consent.pdf');
  });
});

/**
 * Куда уходит файл: приложению через мост либо браузеру ссылкой.
 *
 * Внутри WebView браузерная ссылка на содержимое не скачивает ничего — файл
 * там обязан уйти в нативную часть. В браузере моста нет, и это нормальный
 * режим, а не деградация.
 */
describe('отдача файла', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'QOrderBridge');
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    vi.restoreAllMocks();
  });

  it('в браузере уходит ссылкой', async () => {
    const saved: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });

    await saveFile(new Blob(['%PDF'], { type: 'application/pdf' }), 'schet.pdf');

    expect(saved).toEqual(['schet.pdf']);
  });

  it('внутри приложения уходит мосту, а ссылка не создаётся вовсе', async () => {
    const given: { name: string; base64: string }[] = [];
    window.QOrderBridge = {
      saveFile: (name: string, base64: string) => void given.push({ name, base64 }),
    };
    URL.createObjectURL = vi.fn(() => 'blob:x');
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await saveFile(new Blob(['%PDF'], { type: 'application/pdf' }), 'schet.pdf');

    expect(given).toHaveLength(1);
    expect(given[0].name).toBe('schet.pdf');
    // Содержимое доезжает целиком: мост принимает base64, а не текст.
    expect(atob(given[0].base64)).toBe('%PDF');
    // Ссылка не создаётся: она держала бы файл в памяти вкладки ни за чем.
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(clicked).not.toHaveBeenCalled();
  });

  /*
   * Мост может быть объявлен без нужного метода — приложение старше кабинета.
   * Это не повод оставить человека без файла: развилка смотрит на метод,
   * а не на сам объект моста.
   */
  it('мост без метода сохранения не мешает браузеру отдать файл', async () => {
    window.QOrderBridge = {};
    const saved: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });

    await saveFile(new Blob(['%PDF'], { type: 'application/pdf' }), 'schet.pdf');

    expect(saved).toEqual(['schet.pdf']);
  });
});

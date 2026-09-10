import { describe, expect, it } from 'vitest';
import { fileNameFrom } from './download';

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

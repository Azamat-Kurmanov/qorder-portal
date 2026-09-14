/**
 * Отдача файла браузеру — одним местом на весь кабинет.
 *
 * Скачиваемых документов у клиента больше одного, и написанный по месту
 * второй способ разошёлся бы с первым на первой же мелочи: имя из заголовка
 * против придуманного, освобождение ссылки против его отсутствия. Расхождение
 * это заметно не на экране, а в папке загрузок через полгода.
 */

import * as bridge from './webview/bridge';

/**
 * Имя файла из `Content-Disposition`.
 *
 * Имя называет сервер, а не кабинет: документ называет редакцию, с которой
 * человек согласился, и придуманное на экране имя рано или поздно назвало бы
 * другую. Запасное имя нужно на случай ответа без заголовка — файл без имени
 * браузер сохранит как «download», и опознать его будет нечем.
 */
export function fileNameFrom(headers: Headers, fallback: string): string {
  const disposition = headers.get('content-disposition') ?? '';

  // Сначала кодированная форма: имя с кириллицей сервер отдаёт именно ею,
  // а рядом кладёт обеднённую копию в `filename` — взяв её первой, кабинет
  // сохранил бы файл с вопросительными знаками вместо букв.
  const encoded = /filename\*=\s*UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // Битая последовательность процентов — не повод остаться без файла.
    }
  }

  const quoted = /filename="([^"]*)"/i.exec(disposition);
  if (quoted?.[1]) return quoted[1];

  const bare = /filename=\s*([^;]+)/i.exec(disposition);
  return bare?.[1].trim() || fallback;
}

/**
 * Сохранить содержимое под именем.
 *
 * Путей два, и выбирает между ними не экран, а это место: внутри мобильного
 * приложения браузерная ссылка на содержимое не скачивает ничего — там файл
 * обязан уйти в нативную часть. В браузере моста нет, и это нормальный режим,
 * а не деградация.
 *
 * Развилка смотрит на метод моста, а не на сам мост: приложение бывает старше
 * кабинета, и объявленный мост без нужного метода оставил бы человека без
 * файла молча. Не принял мост — отдаём браузером.
 */
export async function saveFile(content: Blob, fileName: string): Promise<void> {
  // Мосту содержимое уходит строкой: канал в нативную часть двоичных данных
  // не несёт. Считается она до всего прочего — не приняв её, мост оставит
  // работу браузеру, и создавать временную ссылку заранее незачем.
  if (bridge.isAvailable()) {
    if (bridge.saveFile(fileName, await asBase64(content))) return;
  }

  saveThroughBrowser(content, fileName);
}

/**
 * Содержимое строкой base64 — в том виде, в каком его принимает мост.
 *
 * Собирается частями по 32 КиБ: `String.fromCharCode` принимает байты
 * аргументами, и весь файл разом упёрся бы в предел их числа. Падало бы это
 * на файле, который больше обычного, — то есть у того, у кого документ
 * длиннее остальных, и только у него.
 *
 * Через `arrayBuffer`, а не `FileReader`: содержимое приходит из ответа сети,
 * и его `Blob` не всегда тот, которого ждёт `readAsDataURL`.
 */
async function asBase64(content: Blob): Promise<string> {
  const bytes = new Uint8Array(await content.arrayBuffer());
  const CHUNK = 0x8000;

  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }

  return btoa(binary);
}

/**
 * Отдача файла браузером.
 *
 * Через временную ссылку, а не переходом по адресу документа: запрос к нему
 * несёт токен и поставщика заголовками, а переход по адресу их не несёт —
 * человек получил бы отказ вместо файла.
 *
 * Ссылка на содержимое освобождается сразу после нажатия: нажатие
 * обработано синхронно, браузер содержимое уже забрал, а оставленная ссылка
 * держит файл в памяти вкладки до её закрытия.
 */
function saveThroughBrowser(content: Blob, fileName: string): void {
  const href = URL.createObjectURL(content);
  const link = document.createElement('a');

  link.href = href;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(href);
}

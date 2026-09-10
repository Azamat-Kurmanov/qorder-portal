/**
 * Отдача файла браузеру — одним местом на весь кабинет.
 *
 * Скачиваемых документов у клиента больше одного, и написанный по месту
 * второй способ разошёлся бы с первым на первой же мелочи: имя из заголовка
 * против придуманного, освобождение ссылки против его отсутствия. Расхождение
 * это заметно не на экране, а в папке загрузок через полгода.
 */

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
 * Через временную ссылку, а не переходом по адресу документа: запрос к нему
 * несёт токен и поставщика заголовками, а переход по адресу их не несёт —
 * человек получил бы отказ вместо файла.
 *
 * Ссылка на содержимое освобождается сразу после нажатия: нажатие
 * обработано синхронно, браузер содержимое уже забрал, а оставленная ссылка
 * держит файл в памяти вкладки до её закрытия.
 */
export function saveFile(content: Blob, fileName: string): void {
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

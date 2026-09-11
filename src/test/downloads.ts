import { vi } from 'vitest';

/**
 * Скачивание в jsdom: браузерной ссылки на содержимое здесь нет, а нажатие
 * на ссылку никуда не ведёт. Подменяются ровно эти две вещи — что кабинет
 * положил в файл и под каким именем отдал, проверяется по-настоящему.
 *
 * Снимается `releaseDownloads` в `afterEach`.
 */
export function captureDownloads() {
  const saved: { name: string; blob: Blob }[] = [];
  let last: Blob | undefined;

  // Присваиванием, а не подменой глобального `URL`: в jsdom этих методов нет
  // вовсе, и подменять там нечего.
  URL.createObjectURL = vi.fn((blob: Blob) => {
    last = blob;
    return 'blob:download';
  });
  URL.revokeObjectURL = vi.fn();

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    saved.push({ name: this.download, blob: last as Blob });
  });

  return saved;
}

/** Убирает то, что поставил `captureDownloads`: соседний тест не должен его унаследовать. */
export function releaseDownloads() {
  vi.restoreAllMocks();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
}

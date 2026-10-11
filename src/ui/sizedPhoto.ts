const FILE = /^\/api\/files\/[\w-]+$/;
const LH3 = /^https:\/\/lh3\.googleusercontent\.com\/.*=w\d+$/;
const THUMBNAIL = /^https:\/\/drive\.google\.com\/thumbnail\?.*[?&]sz=w\d+/;

/** Можно ли попросить копию другой ширины: файл хранилища или копия Google Диска. */
export function resizable(url: string): boolean {
  return FILE.test(url) || LH3.test(url) || THUMBNAIL.test(url);
}

/**
 * Копия снимка нужной ширины: плитке в 300 точек незачем тянуть 1600.
 * Файл хранилища — `?w=` (сервер переадресует на копию Диска этой ширины),
 * копии Диска — своя ширина в адресе. Чужой адрес — как есть.
 */
export function sizedPhoto(url: string, width: number): string {
  if (FILE.test(url)) return `${url}?w=${width}`;
  if (LH3.test(url)) return url.replace(/=w\d+$/, `=w${width}`);
  if (THUMBNAIL.test(url)) return url.replace(/([?&]sz=w)\d+/, `$1${width}`);
  return url;
}

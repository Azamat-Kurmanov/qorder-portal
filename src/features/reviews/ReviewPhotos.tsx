import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../api/client';
import type { ItemMediaDto, ReviewPhotoDto } from '../../api/generated';
import { MediaLightbox } from '../catalog/MediaLightbox';
import { cn } from '../../ui/cn';

/** Сколько фото можно приложить к отзыву — тот же предел, что на сервере. */
export const MAX_REVIEW_PHOTOS = 3;
/** Предел одного снимка в мегабайтах — тот же, что на сервере. */
export const MAX_REVIEW_PHOTO_MB = 5;
/** Что принимается: то, что покажет любой браузер. */
export const REVIEW_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Снимки отзывов по адресам из ответа сервера — как ссылки для `<img>`.
 *
 * Снимок отдаётся только тому, кто вошёл: видимость у него та же, что
 * у самого отзыва. `<img src>` заголовка с токеном не несёт, поэтому снимок
 * забирается тем же запросом, что и всё остальное (через `apiRequest`, как
 * счёт в заявке), и показывается ссылкой на полученное содержимое.
 *
 * Ключ запроса — адрес: снимок под своим идентификатором не меняется, и
 * повторно открытая карточка берёт его из кеша, а не из сети.
 */
export function usePhotoUrls(urls: string[]): (string | undefined)[] {
  const results = useQueries({
    queries: urls.map((url) => ({
      queryKey: ['review-photo', url],
      queryFn: () => apiRequest<{ data: Blob; status: number }>(url),
      staleTime: Infinity,
    })),
  });
  const blobs = results.map((result) => (result.data?.status === 200 ? result.data.data : undefined));

  // Ссылки на содержимое живут, пока живёт экран: не отпущенная ссылка
  // держит снимок в памяти до закрытия вкладки.
  const [links, setLinks] = useState<(string | undefined)[]>([]);
  const key = blobs.map((blob) => (blob ? `${blob.size}:${blob.type}` : '')).join('|') + urls.join('|');
  useEffect(() => {
    const made = blobs.map((blob) => (blob && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(blob) : undefined));
    setLinks(made);
    return () => made.forEach((link) => { if (link && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(link); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return links;
}

/**
 * Фото в карточке отзыва — миниатюрами, с увеличением по нажатию.
 *
 * Увеличение — тем же окном, что снимки товара: второй просмотрщик в кабинете
 * вёл бы себя иначе первого, и человек учил бы оба.
 */
export function ReviewPhotoStrip({ photos, author }: { photos: ReviewPhotoDto[]; author?: string }) {
  const { t } = useTranslation();
  const links = usePhotoUrls(photos.map((photo) => photo.url));
  const [open, setOpen] = useState<number | null>(null);

  const media: ItemMediaDto[] = useMemo(() => photos
    .map((photo, index) => ({ photo, url: links[index], index }))
    .filter((entry): entry is { photo: ReviewPhotoDto; url: string; index: number } => !!entry.url)
    .map(({ photo, url, index }) => ({ id: photo.id, kind: 'PHOTO', source: 'UPLOAD', url, sortOrder: index })),
  [photos, links]);

  if (photos.length === 0) return null;

  return (
    <>
      <ul data-testid="review-photos" aria-label={t('reviews.photos.label')} className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              aria-label={t('reviews.photos.open', { index: index + 1, count: photos.length })}
              disabled={!links[index]}
              onClick={() => setOpen(media.findIndex((entry) => entry.id === photo.id))}
              className={cn(
                'block size-[76px] cursor-zoom-in overflow-hidden rounded-[var(--radius-tile)] bg-sunk shadow-[0_0_0_1px_var(--color-hairline)]',
                'disabled:cursor-default',
                'transition-transform duration-200 hover:scale-[1.03] active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              {links[index] && <img src={links[index]} alt="" className="size-full object-cover" />}
            </button>
          </li>
        ))}
      </ul>
      {open !== null && open >= 0 && (
        <MediaLightbox
          media={media}
          itemName={author ?? t('reviews.client')}
          startAt={open}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/** Почему файл не подходит к отзыву; пусто — подходит. */
export function photoProblem(file: File): 'badType' | 'tooLarge' | undefined {
  if (!REVIEW_PHOTO_TYPES.includes(file.type)) return 'badType';
  if (file.size > MAX_REVIEW_PHOTO_MB * 1024 * 1024) return 'tooLarge';
  return undefined;
}

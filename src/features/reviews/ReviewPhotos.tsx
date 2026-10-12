import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
 * Фото в карточке отзыва — миниатюрами, с увеличением по нажатию.
 *
 * Увеличение — тем же окном, что снимки товара: второй просмотрщик в кабинете
 * вёл бы себя иначе первого, и человек учил бы оба.
 */
export function ReviewPhotoStrip({ photos, author }: { photos: ReviewPhotoDto[]; author?: string }) {
  const { t } = useTranslation();
  // Фото лежит в хранилище поставщика и открывается постоянным адресом без входа.
  const links = photos.map((photo) => photo.url);
  const [open, setOpen] = useState<number | null>(null);

  const media: ItemMediaDto[] = useMemo(() => photos
    .filter((photo): photo is ReviewPhotoDto & { url: string } => !!photo.url)
    .map((photo, index) => ({ id: photo.id, kind: 'PHOTO', source: 'UPLOAD', url: photo.url, sortOrder: index, processing: false, failed: false })),
  [photos]);

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

/**
 * Ссылка на снимок в облаке клиента — адресом самого файла для превью, как её
 * приведёт сервер: Google Диск — уменьшенной копией, Dropbox и OneDrive — параметром
 * отдачи файла. Другой сайт — `null`: в отзыв сервер берёт только эти облака.
 */
export function cloudPhotoUrl(link: string): string | null {
  let url: URL;
  try { url = new URL(link.trim()); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'drive.google.com') {
    const id = url.pathname.match(/\/file\/d\/([\w-]{10,})/)?.[1] ?? url.searchParams.get('id');
    return id && /^[\w-]{10,}$/.test(id) ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : null;
  }
  if (host === 'dropbox.com') { url.searchParams.delete('dl'); url.searchParams.set('raw', '1'); return url.toString(); }
  if (host === '1drv.ms' || host === 'onedrive.live.com') { url.searchParams.set('download', '1'); return url.toString(); }
  return null;
}

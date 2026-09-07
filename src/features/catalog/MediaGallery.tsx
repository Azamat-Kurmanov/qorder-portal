import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemMediaDto } from '../../api/generated';
import { MediaLightbox } from './MediaLightbox';
import { cn } from '../../ui/cn';

/**
 * Фото и видео позиции в порядке, который расставил продавец.
 *
 * На телефоне снимок — не иллюстрация сбоку, а подложка всей карточки: он
 * занимает ширину экрана целиком, на нём стоят «назад» и «избранное», и на
 * него снизу наезжает лист содержимого. Поэтому полоса рисуется и там, где
 * снимков нет: исчезни она — кнопкам стало бы негде стоять, а лист наехал бы
 * на шапку кабинета. Пустая полоса при этом ниже: пол-экрана пустого места
 * ради двух кнопок не стоит того.
 *
 * Касание по кадру открывает его во весь экран, а не перелистывает на
 * соседний: кадр в карточке — тридцать тысяч точек, по нему видно, что товар
 * есть, но не видно самого товара, и нажимающий на снимок просит рассмотреть
 * тот, на который смотрит. Листают дальше уже там — вместе с роликами, одной
 * лентой. Точки внизу остаются указателем: сколько кадров всего и который
 * открыт. На планшете и мониторе к ним добавляются миниатюры — по ним видно
 * сразу все кадры, а не только соседний, — и они по-прежнему меняют кадр
 * в самой карточке, не открывая ничего.
 *
 * Порог тот же, что у карточки (768): галерея и лист решения — половины
 * одной раскладки, и перестраиваться на разной ширине им нельзя. Разъехавшись,
 * они дают снимок без скруглений внутри карточки со скруглениями.
 *
 * Ролик стоит меткой, а не проигрывателем: карточку открывают с телефона,
 * и видео, начавшее грузиться само, съедает трафик у того, кто пришёл
 * посмотреть цену. Нажал — открылось, и открылось здесь же, в той же ленте,
 * а не на голом файле в чужой вкладке, откуда возвращаются только кнопкой
 * браузера.
 */
export function MediaGallery({
  media,
  itemName,
  topLeft,
  topRight,
}: {
  media: ItemMediaDto[];
  itemName: string;
  /** Что стоит в левом верхнем углу снимка. Обычно — возврат в каталог. */
  topLeft?: ReactNode;
  /** Что стоит в правом верхнем углу снимка. Обычно — избранное. */
  topRight?: ReactNode;
}) {
  const { t } = useTranslation();
  const photos = media.filter((entry) => entry.kind === 'PHOTO');
  const videos = media.filter((entry) => entry.kind === 'VIDEO');
  const [shown, setShown] = useState(0);
  // Номер кадра в общей ленте, по которому открыт диалог, или null — закрыт.
  // Номер, а не признак «открыт»: рассмотреть хотят тот кадр, по которому
  // нажали, а не первый в карточке.
  const [openAt, setOpenAt] = useState<number | null>(null);

  // Кадр мог исчезнуть, пока карточка открыта: продавец правит галерею из
  // своего кабинета, и запомненный номер уводил бы в пустоту.
  const at = Math.min(shown, Math.max(photos.length - 1, 0));
  const current = photos[at];
  /*
   * Позиция, к которой приложили только ролик.
   *
   * Полоса рисуется и без снимков — на ней стоят «назад» и «избранное», — но
   * пустая заливка сообщала бы, что смотреть нечего, тогда как продавец
   * видео приложил. Кадр из ролика ни система, ни витрина не достают
   * (`thumbnailUrl` у такой позиции пуст намеренно), поэтому первый кадр
   * показывает сам ролик: заголовок файла и остановка на десятой доле
   * секунды — цена этого куда меньше, чем цена ролика целиком.
   */
  const standIn = current ? undefined : videos[0];

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={cn(
          'relative overflow-hidden bg-sunk md:rounded-[var(--radius-gallery)]',
          current || standIn ? 'h-[300px] md:h-[380px]' : 'h-[168px] md:h-[220px]',
        )}
      >
        {standIn && (
          <video
            data-testid="gallery-video-frame"
            src={`${standIn.url}#t=0.1`}
            preload="metadata"
            muted
            playsInline
            // Без `controls`: это не проигрыватель, а кадр вместо пустоты.
            // Смотрят ролик во весь экран, куда ведёт метка снизу.
            aria-hidden="true"
            className="size-full object-cover"
          />
        )}

        {current && (
          <img
            data-testid="gallery-photo"
            src={current.url}
            // Подпись продавца, если он её написал, иначе название позиции:
            // альтернативный текст читают вслух, и «изображение» в нём
            // не сообщает ничего.
            alt={current.title ?? itemName}
            loading="lazy"
            className="size-full object-cover"
          />
        )}

        {(current || standIn) && (
          // Кнопка во весь кадр, а не значок в углу: цель размером со снимок
          // не требует прицеливаться, а озвучиванию она называется словами.
          <button
            type="button"
            aria-label={current ? t('catalog.openPhoto') : t('catalog.watchVideo')}
            onClick={() => setOpenAt(media.indexOf(current ?? standIn!))}
            className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
        )}

        {/*
          Углы стоят в разметке после кнопки листания: среди позиционированных
          соседей нажатие достаётся последнему, и в обратном порядке прозрачная
          кнопка перехватывала бы «назад» и «избранное».
        */}
        {topLeft && <div className="absolute left-4 top-4">{topLeft}</div>}
        {topRight && <div className="absolute right-4 top-4">{topRight}</div>}

        {videos.length > 0 && (
          <div className="absolute bottom-1 left-2 flex items-center gap-1">
            {videos.map((video, index) => (
              <button
                key={video.id}
                type="button"
                onClick={() => setOpenAt(media.indexOf(video))}
                // Метка ростом в 30 точек, а область нажатия — в 44: мелкая
                // метка на снимке читается подписью, но промахиваться по ней
                // пальцем человек не обязан.
                className={cn(
                  'inline-flex h-11 items-center px-2',
                  'transition-all duration-300 active:scale-95',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                )}
              >
                <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-ink/70 px-2.5 text-xs font-medium text-white">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 fill-current">
                    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                  </svg>
                  {videos.length > 1
                    ? t('catalog.videoNumbered', { number: index + 1 })
                    : t('catalog.videoLabel')}
                </span>
              </button>
            ))}
          </div>
        )}

        {photos.length > 1 && (
          // Точки только говорят, где человек находится: нажимать в них нечего —
          // кадр листается касанием по снимку, а цель в семь точек была бы
          // обещанием, которого палец не выполнит.
          <div aria-hidden="true" className="absolute bottom-4 right-4 flex gap-1.5 md:hidden">
            {photos.map((photo, index) => (
              <span
                key={photo.id}
                className={cn('size-[7px] rounded-full', index === at ? 'bg-white' : 'bg-white/45')}
              />
            ))}
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <div className="hidden gap-2.5 md:flex">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              aria-label={t('catalog.photoNumbered', { number: index + 1 })}
              aria-pressed={index === at}
              onClick={() => setShown(index)}
              className={cn(
                'size-[84px] shrink-0 overflow-hidden rounded-[var(--radius-tile)] border-2',
                'transition-all duration-300 active:scale-95',
                index === at ? 'border-ink' : 'border-transparent hover:border-ink/30',
              )}
            >
              <img src={photo.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {openAt !== null && (
        <MediaLightbox
          media={media}
          itemName={itemName}
          startAt={openAt}
          onClose={() => setOpenAt(null)}
        />
      )}
    </div>
  );
}

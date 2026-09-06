import { useState, type ReactNode } from 'react';
import type { ItemMediaDto } from '../../api/generated';
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
 * Кадры листаются касанием по самому кадру, а внизу точками сказано, какой
 * из них открыт: полоса миниатюр отняла бы у телефона ещё сотню точек, и палец
 * попадает по снимку в триста точек вернее, чем по квадратику в шестьдесят
 * четыре. На планшете и мониторе места хватает, и там миниатюры остаются —
 * по ним видно сразу все кадры, а не только соседний.
 *
 * Порог тот же, что у карточки (768): галерея и лист решения — половины
 * одной раскладки, и перестраиваться на разной ширине им нельзя. Разъехавшись,
 * они дают снимок без скруглений внутри карточки со скруглениями.
 *
 * Ролик стоит ссылкой, а не проигрывателем: карточку открывают с телефона,
 * и видео, начавшее грузиться само, съедает трафик у того, кто пришёл
 * посмотреть цену. Нажал — открылось.
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
  const photos = media.filter((entry) => entry.kind === 'PHOTO');
  const videos = media.filter((entry) => entry.kind === 'VIDEO');
  const [shown, setShown] = useState(0);

  // Кадр мог исчезнуть, пока карточка открыта: продавец правит галерею из
  // своего кабинета, и запомненный номер уводил бы в пустоту.
  const at = Math.min(shown, Math.max(photos.length - 1, 0));
  const current = photos[at];

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={cn(
          'relative overflow-hidden bg-sunk md:rounded-[var(--radius-gallery)]',
          current ? 'h-[300px] md:h-[380px]' : 'h-[168px] md:h-[220px]',
        )}
      >
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

        {photos.length > 1 && (
          // Кнопка во весь кадр, а не стрелка у края: цель размером со снимок
          // не требует прицеливаться, а озвучиванию она называется словами.
          <button
            type="button"
            aria-label="Следующий снимок"
            onClick={() => setShown((at + 1) % photos.length)}
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
              <a
                key={video.id}
                href={video.url}
                target="_blank"
                rel="noreferrer"
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
                  {videos.length > 1 ? `Видео ${index + 1}` : 'Видео'}
                </span>
              </a>
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
              aria-label={`Снимок ${index + 1}`}
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
    </div>
  );
}

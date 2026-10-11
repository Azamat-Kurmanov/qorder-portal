import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemMediaDto } from '../../api/generated';
import { MediaLightbox } from './MediaLightbox';
import { cn } from '../../ui/cn';
import { prefersReducedMotion } from '../../ui/reducedMotion';

/**
 * Прокрутка полосы к нужному месту — плавно, если движение не выключено.
 *
 * Прокручивается сама полоса, а не страница: `scrollIntoView` у миниатюры
 * сдвинул бы заодно и окно, и человек, листающий снимки, терял бы цену.
 */
function scrollBox(box: HTMLElement, to: { left?: number; top?: number }) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (typeof box.scrollTo === 'function') {
    box.scrollTo({ ...to, behavior });
    return;
  }
  if (to.left !== undefined) box.scrollLeft = to.left;
  if (to.top !== undefined) box.scrollTop = to.top;
}

const PLAY_PATH = 'M8 5.5v13l11-6.5-11-6.5Z';

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
 * Все кадры — снимки и ролики одной лентой — видны сразу, на любой ширине:
 * миниатюры идут лентой под кадром на телефоне и планшете и столбцом слева
 * на мониторе. До сих пор на телефоне был виден только первый снимок, а о
 * седьмом и о ролике человек узнавал, лишь открыв полноэкранный просмотр.
 *
 * Большой кадр на телефоне листается пальцем: это полоса с привязкой
 * прокрутки (scroll-snap), а не самодельный разбор касаний. Браузер сам
 * отличает свайп от касания, сам доводит кадр до края и сам гасит нажатие
 * после свайпа, — поэтому касание без свайпа по-прежнему открывает во весь
 * экран тот кадр, на который смотрят. Стрелки и миниатюры двигают ту же
 * полосу, а прокрутка полосы выбирает миниатюру и точку.
 *
 * Порог тот же, что у карточки (768): галерея и лист решения — половины
 * одной раскладки, и перестраиваться на разной ширине им нельзя. Разъехавшись,
 * они дают снимок без скруглений внутри карточки со скруглениями.
 *
 * Ролик стоит кадром, а не проигрывателем: карточку открывают с телефона,
 * и видео, начавшее грузиться само, съедает трафик у того, кто пришёл
 * посмотреть цену. Кадр показывает сам ролик — заголовок файла и остановка
 * на десятой доле секунды (`thumbnailUrl` у медиа нет): цена этого куда
 * меньше, чем цена ролика целиком. Нажал — открылось, и открылось здесь же,
 * в той же ленте во весь экран, а не на голом файле в чужой вкладке.
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
  const track = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  // Кадр, к которому полоса едет после нажатия стрелки или миниатюры. Пока
  // едет, кадры, мимо которых она проезжает, не выбираются: иначе миниатюры
  // мигали бы по очереди, а столбец миниатюр дёргался бы за ними.
  const heading = useRef<number | null>(null);

  // Кадр мог исчезнуть, пока карточка открыта: продавец правит галерею из
  // своего кабинета, и запомненный номер уводил бы в пустоту.
  const at = Math.min(shown, Math.max(media.length - 1, 0));
  const current = media[at];
  const many = media.length > 1;

  // По кругу: на последнем кадре «следующее» ведёт к первому — как и во весь
  // экран. Кнопка, гаснущая на краю, заставляет вспоминать, где этот край.
  const step = (delta: number) => setShown((at + delta + media.length) % media.length);

  // Выбранный кадр — в окне большой полосы.
  useEffect(() => {
    const box = track.current;
    const width = box?.clientWidth;
    if (!box || !width) return;
    if (Math.round(box.scrollLeft / width) === at) return;
    heading.current = at;
    scrollBox(box, { left: at * width });
  }, [at]);

  // Выбранная миниатюра — в видимой части ленты: по середине, если есть куда.
  // Ось одна на обе раскладки: у ленты лишняя вертикаль, у столбца лишняя
  // горизонталь сводятся браузером к нулю.
  useEffect(() => {
    const box = strip.current;
    const thumb = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !thumb) return;
    scrollBox(box, {
      left: Math.max(0, thumb.offsetLeft - (box.clientWidth - thumb.offsetWidth) / 2),
      top: Math.max(0, thumb.offsetTop - (box.clientHeight - thumb.offsetHeight) / 2),
    });
  }, [at]);

  const onTrackScroll = () => {
    const box = track.current;
    const width = box?.clientWidth;
    if (!box || !width) return;
    const index = Math.min(Math.max(Math.round(box.scrollLeft / width), 0), media.length - 1);
    if (heading.current !== null) {
      if (index === heading.current) heading.current = null;
      return;
    }
    if (index !== at) setShown(index);
  };
  // Палец или колесо перехватили полосу посреди поездки — дальше ведёт человек.
  const takeOver = () => {
    heading.current = null;
  };

  const arrow = cn(
    'absolute top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full',
    'bg-surface/90 text-ink shadow-[0_2px_8px_rgb(0_0_0/0.12)] transition-colors duration-200 hover:bg-surface',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:flex',
  );

  /*
   * На мониторе — как в макете «Карточка товара v2»: миниатюры столбцом слева,
   * снимок высотой 640 точек рядом. Столбец стоит в разметке после снимка
   * (сначала кадр, потом выбор кадра), а слева его ставит `flex-row-reverse`.
   */
  return (
    <div className="flex flex-col gap-2.5 lg:flex-row-reverse lg:items-start lg:gap-4">
      <div
        className={cn(
          'relative overflow-hidden bg-sunk md:rounded-[var(--radius-gallery)] lg:min-w-0 lg:flex-1 lg:rounded-[calc(var(--radius-gallery)*7/6)]',
          current ? 'h-[300px] md:h-[380px] lg:h-[640px]' : 'h-[168px] md:h-[220px] lg:h-[420px]',
        )}
      >
        {current && (
          <div
            ref={track}
            data-testid="gallery-track"
            onScroll={onTrackScroll}
            onPointerDown={takeOver}
            onTouchStart={takeOver}
            onWheel={takeOver}
            className={cn(
              'flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            )}
          >
            {media.map((entry, index) => {
              const here = index === at;
              // Первое фото — тот же снимок, что в плитке витрины: на него перелетает её фото.
              const landing = entry.id === media.find((one) => one.kind === 'PHOTO')?.id;
              return (
                // Соседние кадры скрыты от озвучивания: на экране их нет,
                // а выбирают их миниатюрами, у которых есть имена.
                <div
                  key={entry.id}
                  aria-hidden={here ? undefined : true}
                  className="relative size-full shrink-0 snap-center snap-always"
                >
                  {entry.kind === 'PHOTO' ? (
                    <img
                      data-testid={here ? 'gallery-photo' : undefined}
                      src={entry.url}
                      // Подпись продавца, если он её написал, иначе название
                      // позиции: альтернативный текст читают вслух, и
                      // «изображение» в нём не сообщает ничего.
                      alt={entry.title ?? itemName}
                      // Первый кадр — главная картинка экрана: грузится сразу
                      // и первым, остальные — когда до них долистают.
                      loading={index === 0 ? 'eager' : 'lazy'}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      style={landing ? { viewTransitionName: 'qo-item-photo' } : undefined}
                      className="size-full object-cover"
                    />
                  ) : (
                    <>
                      <video
                        data-testid={here ? 'gallery-video-frame' : undefined}
                        src={`${entry.url}#t=0.1`}
                        preload="metadata"
                        muted
                        playsInline
                        // Без `controls`: это не проигрыватель, а кадр.
                        // Смотрят ролик во весь экран, по нажатию.
                        aria-hidden="true"
                        className="size-full object-cover"
                      />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="flex size-16 items-center justify-center rounded-full bg-black/55 text-white shadow-[0_2px_12px_rgb(0_0_0/0.25)]">
                          <svg viewBox="0 0 24 24" className="ml-1 size-7 fill-current"><path d={PLAY_PATH} /></svg>
                        </span>
                      </span>
                    </>
                  )}

                  {/*
                    Кнопка во весь кадр, а не значок в углу: цель размером со
                    снимок не требует прицеливаться, а озвучиванию она
                    называется словами. Лежит внутри полосы, а не поверх неё:
                    поверх — палец листал бы кнопку, а не полосу.
                  */}
                  <button
                    type="button"
                    tabIndex={here ? undefined : -1}
                    aria-label={entry.kind === 'PHOTO' ? t('catalog.openPhoto') : t('catalog.watchVideo')}
                    onClick={() => setOpenAt(index)}
                    className={cn(
                      'absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                      // Снимок по нажатию увеличивается — курсор-лупа говорит об этом заранее.
                      entry.kind === 'PHOTO' && 'cursor-zoom-in',
                    )}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/*
          Углы стоят в разметке после полосы кадров: среди позиционированных
          соседей нажатие достаётся последнему, и в обратном порядке кнопка
          кадра перехватывала бы «назад» и «избранное».
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
                <span className="inline-flex h-[30px] items-center gap-1.5 rounded-[var(--radius-pill)] bg-black/60 px-2.5 text-xs font-medium text-white">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 fill-current">
                    <path d={PLAY_PATH} />
                  </svg>
                  {videos.length > 1
                    ? t('catalog.videoNumbered', { number: index + 1 })
                    : t('catalog.videoLabel')}
                </span>
              </button>
            ))}
          </div>
        )}

        {many && (
          // На планшете и мониторе: пальцем там не листают, а до соседнего
          // кадра через ленту миниатюр тянуться дальше, чем до стрелки.
          <>
            <button type="button" aria-label={t('catalog.prevPhoto')} onClick={() => step(-1)} className={cn(arrow, 'left-4')}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" aria-label={t('catalog.nextPhoto')} onClick={() => step(1)} className={cn(arrow, 'right-4')}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </>
        )}

        {current?.kind === 'PHOTO' && (
          // Подсказка, что снимок открывается крупно, и который он по счёту, —
          // только на мониторе: на телефоне снимок и так во всю ширину,
          // а касание — очевидный жест. Счёт идёт по снимкам: ролик
          // в «Фото 3 из 8» читался бы снимком, которого нет.
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-4 left-1/2 hidden h-8 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] bg-black/70 px-3 text-caption font-bold tabular-nums text-white lg:flex"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M11 8v6M8 11h6" /></svg>
            {photos.length > 1
              ? t('catalog.photoOf', { number: photos.indexOf(current) + 1, count: photos.length })
              : t('catalog.zoomHint', { count: photos.length })}
          </span>
        )}

        {many && (
          // Точки только говорят, где человек находится: нажимать в них нечего —
          // кадр листается пальцем, а цель в семь точек была бы обещанием,
          // которого палец не выполнит.
          <div aria-hidden="true" className="pointer-events-none absolute bottom-4 right-4 flex max-w-[50%] flex-wrap justify-end gap-1.5 md:hidden">
            {media.map((entry, index) => (
              <span
                key={entry.id}
                className={cn('size-[7px] rounded-full transition-colors duration-200', index === at ? 'bg-white' : 'bg-white/45')}
              />
            ))}
          </div>
        )}
      </div>

      {many && (
        <div
          ref={strip}
          role="group"
          aria-label={t('catalog.allMedia')}
          className={cn(
            // `relative` — чтобы миниатюры отсчитывали положение от ленты,
            // а не от страницы: по нему лента прокручивается к выбранной.
            // Снизу на телефоне — запас под лист карточки: он поднят на 20 точек
            // (`-mt-5` в ItemCardPage), чтобы скруглением заходить на снимок,
            // и без запаса закрывал бы низ миниатюр.
            'relative flex snap-x gap-2.5 overflow-x-auto scroll-px-4 px-4 pt-1 pb-6 md:scroll-px-0 md:px-0 md:pb-1',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            'lg:max-h-[640px] lg:shrink-0 lg:snap-y lg:flex-col lg:gap-3 lg:overflow-x-hidden lg:overflow-y-auto lg:py-0.5',
          )}
        >
          {media.map((entry, index) => {
            const own = (entry.kind === 'PHOTO' ? photos : videos).indexOf(entry) + 1;
            return (
              <button
                key={entry.id}
                type="button"
                aria-label={entry.kind === 'PHOTO'
                  ? t('catalog.photoNumbered', { number: own })
                  : t('catalog.videoNumbered', { number: own })}
                aria-pressed={index === at}
                onClick={() => setShown(index)}
                className={cn(
                  'relative size-16 shrink-0 snap-start overflow-hidden rounded-[var(--radius-tile)] border-2 md:size-[84px] lg:h-[100px]',
                  'transition-all duration-300 hover:-translate-y-0.5 active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                  index === at ? 'border-accent' : 'border-transparent hover:border-ink/30',
                )}
              >
                {entry.kind === 'PHOTO' ? (
                  <img src={entry.url} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <>
                    <video
                      src={`${entry.url}#t=0.1`}
                      preload="metadata"
                      muted
                      playsInline
                      aria-hidden="true"
                      className="size-full object-cover"
                    />
                    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <span className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
                        <svg viewBox="0 0 24 24" className="ml-0.5 size-3.5 fill-current"><path d={PLAY_PATH} /></svg>
                      </span>
                    </span>
                  </>
                )}
              </button>
            );
          })}
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

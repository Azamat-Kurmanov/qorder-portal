import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import { Play, X } from 'lucide-react';
import type { ItemMediaDto } from '../../api/generated';
import { VideoPlayer } from './VideoPlayer';
import { cn } from '../../ui/cn';

/**
 * Снимки и ролики позиции во весь экран, одной лентой.
 *
 * Кадр в карточке — тридцать тысяч точек на телефоне: по нему видно, что
 * товар есть, но не видно самого товара. Рассматривают его здесь, и здесь же
 * смотрят ролик: до сих пор ролик стоял ссылкой и уводил из карточки на голый
 * файл, откуда возвращаются только кнопкой браузера.
 *
 * Лента одна на фото и видео, в порядке продавца. Две ленты — «снимки» и
 * «ролики» — заставляли бы человека помнить, в какой из них он находится, и
 * знать заранее, что ролик вообще есть: до второй ленты доходят те, кто
 * догадался её поискать.
 *
 * На Radix, как и выдвижной лист: `portal.md` §6.2 запрещает модальные окна
 * браузера, а самодельная обёртка не возвращает фокус, не запирает его внутри
 * и не закрывается по Esc.
 *
 * Рисуется только открытый кадр. Это не бережливость ради бережливости:
 * ролик, ушедший из разметки, перестаёт играть сам — и звук не идёт из кадра,
 * который человек уже пролистал. Заодно карточка с десятью снимками не тянет
 * все десять на мобильной сети.
 */
export function MediaLightbox({
  media,
  itemName,
  startAt,
  onClose,
}: {
  /** Фото и ролики в порядке продавца — тем же, что и в карточке. */
  media: ItemMediaDto[];
  itemName: string;
  /** Кадр, по которому открыли: рассмотреть хотят тот, на который смотрели. */
  startAt: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [at, setAt] = useState(startAt);
  const touchStartX = useRef<number | null>(null);

  // Кадр мог исчезнуть, пока карточка открыта: продавец правит галерею из
  // своего кабинета.
  const index = Math.min(Math.max(at, 0), Math.max(media.length - 1, 0));
  const current = media[index];

  // По кругу: на последнем кадре «следующий» возвращает к первому. Кнопка,
  // гаснущая на краю ленты, заставляет вспоминать, где этот край.
  const step = (shift: number) => setAt((media.length + index + shift) % media.length);

  if (!current) return null;

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Сцена глубже чернил кабинета: на #17181B светлый снимок теряет
            край, а кадр обязан читаться отдельно от того, на чём лежит. */}
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-50 bg-[#0E0F12]" />

        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={(event) => {
            // На кадре с роликом стрелки отданы перемотке: так они работают
            // у любого проигрывателя, и севший смотреть нажимает их за этим.
            // Лента там листается кнопками, миниатюрами и свайпом.
            if (current.kind === 'VIDEO') return;
            if (event.key === 'ArrowRight') step(1);
            if (event.key === 'ArrowLeft') step(-1);
          }}
          className="fixed inset-0 z-50 flex flex-col focus:outline-none"
        >
          {/*
            Имя окна произносится вслух при открытии и на экране не нужно:
            человек и так смотрит на товар, ради которого сюда пришёл.
          */}
          <Dialog.Title className="sr-only">
            {t('catalog.mediaTitle', { name: itemName })}
          </Dialog.Title>

          <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
            {/* Счётчик, а не точки: на десяти кадрах точки перестают считаться
                взглядом, а «7 / 12» читается с любого числа. */}
            <span
              className={cn(
                'inline-flex h-8 items-center rounded-full px-3 text-sm tabular-nums',
                'bg-white/10 text-white/85 backdrop-blur',
                media.length > 1 ? '' : 'invisible',
              )}
            >
              {`${index + 1} / ${media.length}`}
            </span>
            <Dialog.Close
              aria-label={t('catalog.close')}
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-full',
                'bg-white/10 text-white backdrop-blur',
                'transition-all duration-300 hover:bg-white/20 active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
              )}
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/*
            Свайп — на телефоне единственный способ листать: стрелки по краям
            там перекрывают сам кадр, а палец на снимке уже лежит.
          */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-3"
            onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
            onTouchEnd={(event) => {
              const from = touchStartX.current;
              touchStartX.current = null;
              if (from === null || media.length < 2) return;
              const moved = event.changedTouches[0].clientX - from;
              // Порог в 40 точек: меньшее смещение — это не листание,
              // а дрожание пальца при обычном нажатии.
              if (Math.abs(moved) >= 40) step(moved < 0 ? 1 : -1);
            }}
          >
            <Slide entry={current} itemName={itemName} />

            {media.length > 1 && (
              <>
                <Arrow side="left" label={t('catalog.prevFrame')} onClick={() => step(-1)} />
                <Arrow side="right" label={t('catalog.nextFrame')} onClick={() => step(1)} />
              </>
            )}
          </div>

          {media.length > 1 && (
            /*
              Лента миниатюр — на широком экране.

              Стрелки показывают только соседний кадр, и до седьмого снимка
              человек добирается шестью нажатиями, не зная, что впереди.
              На телефоне ленты нет: сотня точек внизу — это отнятая у кадра
              высота, а листают там свайпом, которому подсказки не нужно.
            */
            <div className="hidden shrink-0 justify-center gap-2 px-4 pb-2 md:flex">
              {media.map((entry, position) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-label={t('catalog.frameNumbered', { number: position + 1 })}
                  aria-pressed={position === index}
                  onClick={() => setAt(position)}
                  className={cn(
                    'relative size-16 shrink-0 overflow-hidden rounded-[var(--radius-tile)] border-2',
                    'transition-all duration-300 active:scale-95',
                    position === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                  )}
                >
                  {entry.kind === 'PHOTO' ? (
                    <img src={entry.url} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    // У ролика картинки в миниатюре нет: кадр из видео система
                    // не достаёт, а чужой снимок на его месте соврал бы о том,
                    // что внутри. Треугольник на подложке говорит только то,
                    // что здесь ролик, — и этого довольно.
                    <span className="flex size-full items-center justify-center bg-white/10 text-white">
                      <Play className="size-5 fill-current" aria-hidden="true" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Подпись продавца, если он её написал. Пустая строка места
              не занимает: подписывают редко. */}
          {current.title && (
            <p className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1 text-center text-sm text-white/80">
              {current.title}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Один кадр ленты: снимок целиком или ролик. */
function Slide({ entry, itemName }: { entry: ItemMediaDto; itemName: string }) {
  if (entry.kind === 'VIDEO') return <VideoSlide entry={entry} itemName={itemName} />;

  return (
    <img
      src={entry.url}
      // Подпись продавца, если она есть, иначе название позиции: вслух
      // читают именно её, и «изображение» в ней не сообщает ничего.
      alt={entry.title ?? itemName}
      // Целиком, а не по размеру окна: обрезанный снимок здесь означал бы,
      // что рассмотреть товар по-прежнему нельзя.
      className="max-h-full max-w-full object-contain"
    />
  );
}

/**
 * Ролик: своим проигрывателем, чужим или ссылкой.
 *
 * Адреса приходят вперемешку — загруженные к нам файлы и чужие ссылки, — и
 * одного способа показать их все не существует. Загруженный файл играет тег
 * браузера: пуск, перемотка, звук и полный экран у каждой платформы уже есть
 * и работают лучше нарисованных. Узнанную площадку показывает её собственный
 * проигрыватель — иначе не сработали бы ни её реклама, ни её права.
 *
 * Всё остальное сперва пробуется тем же тегом: чужие хранилища часто отдают
 * прямой файл. Не отдало — на месте ролика встаёт ссылка, а не чёрный
 * прямоугольник: пустое место читается поломкой карточки, а не отказом
 * чужого хранилища.
 *
 * Автозапуска нет ни у одного из трёх. Карточку открывают с телефона, и
 * ролик, начавший грузиться сам, съедает трафик у пришедшего за ценой.
 */
function VideoSlide({ entry, itemName }: { entry: ItemMediaDto; itemName: string }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  const embed = entry.source === 'LINK' ? embedUrl(entry.url) : undefined;
  const label = entry.title ?? itemName;

  if (embed) {
    return (
      <iframe
        data-testid="lightbox-embed"
        src={embed}
        title={entry.title ?? `Ролик: ${itemName}`}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        // Скругление и чёрная подложка — те же, что у своего проигрывателя:
        // чужой плеер обязан стоять на сцене так же, как свой.
        className="aspect-video max-h-full w-full max-w-[960px] overflow-hidden rounded-[var(--radius-gallery)] border-0 bg-black"
      />
    );
  }

  if (broken) {
    return (
      <a
        href={entry.url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'inline-flex h-11 items-center rounded-[var(--radius-control)] border border-white/40 px-5',
          'text-sm font-medium text-white transition-all duration-300',
          'hover:bg-white/10 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        )}
      >
        {t('catalog.openVideo')}
      </a>
    );
  }

  return <VideoPlayer src={entry.url} label={label} onError={() => setBroken(true)} />;
}

/**
 * Адрес проигрывателя площадки, если площадка узнана.
 *
 * Узнаём немногих и по точному имени узла: «содержит youtube» приняло бы
 * за площадку любой адрес, где это слово встретилось, и вместо ролика
 * встал бы пустой кадр без права на отказ. Неузнанное честнее отдать
 * тегу браузера — он хотя бы сообщит об ошибке.
 */
function embedUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  const host = parsed.hostname.replace(/^www\./, '');
  const path = parsed.pathname.split('/').filter(Boolean);

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = parsed.searchParams.get('v')
      ?? (path[0] === 'shorts' || path[0] === 'embed' || path[0] === 'live' ? path[1] : undefined);
    return id ? `https://www.youtube.com/embed/${id}` : undefined;
  }

  if (host === 'youtu.be') return path[0] ? `https://www.youtube.com/embed/${path[0]}` : undefined;

  if (host === 'rutube.ru') {
    const id = path[0] === 'video' ? path[1] : undefined;
    return id ? `https://rutube.ru/play/embed/${id}/` : undefined;
  }

  if (host === 'vimeo.com') return path[0] ? `https://player.vimeo.com/video/${path[0]}` : undefined;

  return undefined;
}

/** Стрелка у края кадра: цель в 44 точки, а рисунок мельче. */
function Arrow({
  side,
  label,
  onClick,
}: {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'absolute top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full',
        'bg-ink/50 text-white transition-all duration-300 hover:bg-ink/70 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        // На телефоне листают свайпом: стрелки там встали бы поверх самого
        // кадра, ради которого диалог и открыли.
        'md:flex',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
        <path
          d={side === 'left' ? 'm14.5 5-7 7 7 7' : 'm9.5 5 7 7-7 7'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

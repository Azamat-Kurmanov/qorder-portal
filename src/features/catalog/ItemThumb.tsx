import { useContext, useEffect, useRef, useState } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { UNSAFE_ViewTransitionContext } from 'react-router-dom';
import { getGetPortalCatalogItemQueryOptions } from '../../api/generated';
import { cn } from '../../ui/cn';
import { Img } from '../../ui/Img';
import { useTranslation } from 'react-i18next';
import { placeholderOf } from '../../ui/thumbPlaceholder';
import { resizable, sizedPhoto } from '../../ui/sizedPhoto';

/**
 * Слот под снимок позиции.
 *
 * Витрина снимков не отдаёт: в строке приходит всё, кроме картинки, а тянуть
 * карточку ради каждой строки — полсотни запросов на один экран. Пока поля
 * нет, слот занят градиентом; `src` — то самое место, куда подставится
 * настоящий адрес, когда сервер заведёт поле, и остальной витрине про эту
 * замену знать не придётся.
 *
 * Заполнитель не стоит мёртвым пятном: по градиенту раз в семь секунд
 * проходит медленная волна света. Полсотни одинаковых застывших прямоугольников
 * читаются как брак вёрстки, а движущийся свет — как материал: камень, мешок,
 * металл. Медленно намеренно — быстрый блик на полусотне плиток сразу
 * превратил бы витрину в мигающую вывеску. Настройку «меньше движения»
 * волну гасит правилом в index.css.
 *
 * Настоящий снимок проявляется, а не выскакивает (`Img`), и при наведении
 * на плитку чуть наезжает на зрителя. Наезд — не украшение: он подтверждает,
 * что плитка целиком нажимается, а не только имя под снимком. Привязан он
 * к плитке (`group/tile`), а не к самому снимку: цель — вся плитка, и увеличение
 * только при попадании курсором в картинку обещало бы, что нажимать надо
 * именно её.
 *
 * Снимок — копией ширины слота (`width`, вдвое — для чёткого экрана): плитке
 * в 300 точек незачем тянуть копию в 1600. Пока он идёт, под ним размытая
 * копия в 32 точки (≈1 КБ) — вместо пустого градиента. Второе фото (`second`)
 * плавно сменяет первое при наведении на плитку; грузится оно только тогда,
 * когда курсор пришёл на плитку, — на телефоне наведения нет, и лишнего
 * трафика тоже.
 *
 * Сам снимок для экранного диктора пуст: он ничего не сообщает сверх имени,
 * которое стоит рядом, а озвученное «изображение» на каждой из пятидесяти
 * строк только удлиняет путь к цене. Метка ролика — сообщает, и потому
 * остаётся словом.
 */
export function ItemThumb({
  itemId,
  src,
  video = false,
  className,
  width = 480,
  second,
  flight = false,
}: {
  itemId: string;
  src?: string;
  video?: boolean;
  className?: string;
  /** Ширина слота в точках — какую копию снимка просить. */
  width?: number;
  /** Второй снимок — сменяет первый при наведении на плитку. */
  second?: string;
  /** Плитка витрины: фото перелетает в карточку товара при переходе к ней и обратно. */
  flight?: boolean;
}) {
  const { t } = useTranslation();
  const [from, to] = placeholderOf(itemId);
  const slot = useRef<HTMLDivElement>(null);
  // Имя перехода — только на время перехода к своей карточке (или обратно): одинаковое
  // имя у двух фото на экране браузер не примет, и переход не состоится вовсе.
  const transition = useContext(UNSAFE_ViewTransitionContext);
  const card = `/catalog/${itemId}`;
  // Плитка витрины грузит карточку заранее — курсор пришёл, палец коснулся, фокус встал:
  // к нажатию данные уже есть, карточка рисуется сразу, и фото успевает долететь.
  const queryClient = useContext(QueryClientContext);
  useEffect(() => {
    const tile = slot.current?.closest('[class~="group/tile"]') ?? slot.current;
    if (!flight || !queryClient || !tile) return undefined;
    let done = false;
    const prefetch = () => {
      if (done) return;
      done = true;
      void queryClient.prefetchQuery({ ...getGetPortalCatalogItemQueryOptions(itemId), staleTime: 30_000 });
    };
    const events = ['pointerenter', 'pointerdown', 'focusin'] as const;
    events.forEach((name) => tile.addEventListener(name, prefetch));
    return () => events.forEach((name) => tile.removeEventListener(name, prefetch));
  }, [flight, queryClient, itemId]);
  const flying = flight && transition.isTransitioning
    && (transition.nextLocation.pathname === card || transition.currentLocation.pathname === card);
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    const tile = slot.current?.closest('[class~="group/tile"]') ?? slot.current;
    if (!second || !tile) return undefined;
    const warmUp = (event: Event) => { if ((event as PointerEvent).pointerType !== 'touch') setWarm(true); };
    tile.addEventListener('pointerenter', warmUp);
    return () => tile.removeEventListener('pointerenter', warmUp);
  }, [second]);

  return (
    <div
      ref={slot}
      data-testid="item-thumb"
      /*
        Градиент остаётся заливкой самого слота, а не уходит во вложенный
        слой: он и есть заполнитель, и вложенный слой ради наезда при
        наведении здесь ничего не дал бы — растянутая линейная заливка
        от увеличения на шесть процентов неотличима от себя самой.
        Наезжает поэтому только настоящий снимок.
      */
      style={src ? undefined : { backgroundImage: `linear-gradient(150deg, ${from} 0%, ${to} 100%)` }}
      className={cn('relative shrink-0 overflow-hidden bg-sunk', className)}
    >
      {src ? (
        <>
          {resizable(src) ? (
            <img data-preview src={sizedPhoto(src, 32)} alt="" aria-hidden="true" decoding="async"
              className="absolute inset-0 size-full scale-110 object-cover blur-md" />
          ) : null}
          <Img
            data-photo
            src={sizedPhoto(src, width)}
            srcSet={resizable(src) ? `${sizedPhoto(src, width)} 1x, ${sizedPhoto(src, width * 2)} 2x` : undefined}
            alt=""
            style={flying ? { viewTransitionName: 'qo-item-photo' } : undefined}
            className={cn(
              'relative size-full object-cover',
              'transition-transform duration-500 ease-out group-hover/tile:scale-105',
            )}
          />
          {second && warm ? (
            <img data-second src={sizedPhoto(second, width)} alt="" aria-hidden="true" decoding="async"
              className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 ease-out group-hover/tile:opacity-100" />
          ) : null}
        </>
      ) : (
        <>
        {/*
          Ночью бежевый заполнитель приглушён полупрозрачной бумагой: светлое
          пятно на месте каждого снимка превращало бы тёмную витрину в шахматку.
        */}
        <span aria-hidden="true" className="absolute inset-0 hidden bg-canvas/60 dark:block" />
        {/*
          Волна света поверх градиента: узкая светлая полоса, наклонённая
          и уезжающая слева направо. Отдельным слоем, а не в самом градиенте, —
          иначе её нельзя было бы двигать, не перерисовывая заполнитель.
        */}
        <span
          aria-hidden="true"
          className={cn(
            'animate-sheen pointer-events-none absolute -inset-y-1/4 left-0 w-1/2',
            'bg-[linear-gradient(100deg,transparent,rgb(255_255_255/0.7),transparent)] dark:opacity-20',
          )}
        />
        </>
      )}

      {/*
        Метка ролика: видео в карточке смотрят до заказа, и знать о нём с
        витрины — повод открыть карточку. Признак приходит отдельным полем,
        потому что строка витрины о медиа не сообщает вовсе.
      */}
      {video && (
        <span
          className={cn(
            'absolute bottom-2 left-2 inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-pill)]',
            'bg-black/60 px-2 text-[0.6875rem] text-white backdrop-blur-sm',
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-[0.6875rem]">
            <path d="M2.5 4.5h7v7h-7z" stroke="currentColor" strokeWidth="1.4" />
            <path d="m9.5 8 4-2.2v4.4L9.5 8Z" fill="currentColor" />
          </svg>
          {t('catalog.video')}
        </span>
      )}
    </div>
  );
}

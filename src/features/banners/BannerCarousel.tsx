import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useGetPortalBanners, useGetPortalPromotions, useGetPortalSuppliers, type ShowcaseBannerDto } from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { resolveDesign } from '../../supplier/cabinetDesign';
import { cn } from '../../ui/cn';
import { prefersReducedMotion } from '../../ui/reducedMotion';
import { BannerSlide } from './BannerSlide';
import { Hero } from './heroes/Hero';
import { saleHero, slideHero, useHeroSource } from './heroes/heroData';

/** Сколько слайд стоит на витрине — столько же обещает продавцу редактор. */
const SLIDE_MS = 7000;

/** Фирменный цвет платформы: им красится «цвет магазина», пока магазин своего не выбрал. */
const PLATFORM_BRAND = '#015640';

/** Уже этой ширины раскладке макета тесно — слайд собирается компактно. */
const COMPACT_BELOW = 640;

/**
 * Слайды, которые сейчас есть смысл показывать: баннер, ведущий в распродажу
 * (`target: SALE`), виден только пока распродажа идёт (`dealCount > 0`).
 * Иначе его кнопка вела бы в пустой отбор «Со скидкой». Пока число товаров
 * распродажи не известно, такой слайд тоже не показывается — лучше
 * появиться позже, чем мелькнуть и исчезнуть.
 */
export function liveBanners(slides: ShowcaseBannerDto[], dealCount: number | undefined): ShowcaseBannerDto[] {
  return (dealCount ?? 0) > 0 ? slides : slides.filter((slide) => slide.target !== 'SALE');
}

/**
 * Слайды для открытой рубрики: её баннеры и баннеры рубрик над ней
 * («Одежда» — и в «Пуховиках»). Своих у рубрики нет — все, как на витрине:
 * пустая карусель в рубрике отняла бы у магазина место для акций.
 */
export function bannersFor(
  slides: ShowcaseBannerDto[],
  category: { id: string; path?: string } | undefined,
): ShowcaseBannerDto[] {
  if (!category) return slides;
  // Без пути (старые данные) рубрика — сама себе цепочка.
  const line = (category.path ?? category.id).split('/');
  const own = slides.filter((slide) => slide.targetCategoryId && line.includes(slide.targetCategoryId));
  return own.length > 0 ? own : slides;
}

/**
 * Баннеры вверху витрины: слайды, которые магазин выложил в кабинете.
 *
 * Слайды меняются сами раз в семь секунд. Пока курсор над каруселью или
 * фокус внутри неё, смена стоит: человек читает или целится в кнопку,
 * и уехавший из-под пальца слайд — худшее, что можно ему сделать. Кнопкой
 * паузы смену можно остановить совсем; тем, кто попросил систему не
 * двигать экран, карусель стартует остановленной.
 *
 * Нет опубликованных слайдов — нет и карусели: пустая рамка отнимала бы
 * у витрины место, ничего не сообщая.
 */
export function BannerCarousel({ width, category, onAction, onSale }: {
  width: number;
  /** Открытая рубрика: в ней первыми и одни идут её баннеры. */
  category?: { id: string; path?: string };
  onAction: (slide: ShowcaseBannerDto) => void;
  /** Кнопка баннера распродажи, который шаблон рисует, когда слайдов нет. */
  onSale?: () => void;
}) {
  const { t } = useTranslation();
  const banners = useGetPortalBanners();
  const promotions = useGetPortalPromotions();
  const dealCount = promotions.data?.status === 200 ? promotions.data.data.dealCount : undefined;
  const slides = bannersFor(liveBanners(banners.data?.status === 200 ? banners.data.data : [], dealCount), category);

  const { supplierId } = useSupplier();
  const suppliers = useGetPortalSuppliers();
  const supplier = suppliers.data?.status === 200
    ? suppliers.data.data.find((one) => one.supplierId === supplierId)
    : undefined;
  // Цвет — из опубликованного дизайна, если он есть: шаблон приносит свой
  // фирменный цвет, и баннер в чужом цвете выбивался бы из кабинета.
  const design = resolveDesign(supplier);
  const brand = design.brand ?? PLATFORM_BRAND;
  // Характер шаблона: фирменные слайды рисуются баннером шаблона (`style.hero`),
  // слайды со своей схемой цвета — как их собрал продавец.
  const hero = design.style?.hero;
  const source = useHeroSource(!!hero);
  // Баннер шаблона выше или ниже слайда в 264 точки — у «историй» над плашкой
  // кружки рубрик, у «строгой ленты» нет фона вовсе. Поэтому у дизайна
  // слайды лежат стопкой в одной ячейке сетки, и высоту даёт самый высокий,
  // а рамку и тень рисует каждый слайд сам. Точки и пауза — под ними.
  const stacked = !!hero;

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [held, setHeld] = useState(false);
  // Карусель за краем экрана не листается: слайд, сменившийся, пока его
  // никто не видел, — лишняя работа телефона и пропущенный баннер.
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);

  const count = slides.length;
  const shown = count ? current % count : 0;
  const moving = count > 1 && !paused && !held && visible;

  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  /*
   * Один таймер на слайд, а не тик каждые 150 мс: тик перерисовывал всю
   * карусель семь раз в секунду. Полоску заполняет CSS-анимация той же
   * длины, а пауза останавливает обе: у таймера — остаток времени,
   * у полоски — `animation-play-state`.
   */
  const spent = useRef({ slide: 0, ms: 0 });
  useEffect(() => {
    if (spent.current.slide !== current) spent.current = { slide: current, ms: 0 };
    if (!moving) return undefined;
    const started = performance.now();
    const timer = window.setTimeout(() => setCurrent((was) => (was + 1) % count), SLIDE_MS - spent.current.ms);
    return () => {
      window.clearTimeout(timer);
      spent.current.ms += performance.now() - started;
    };
  }, [moving, count, current]);

  if (count === 0) {
    // Слайдов нет, а распродажа идёт — у шаблона она и есть главный баннер,
    // как в предпросмотре продавца. Без шаблона витрина остаётся прежней.
    return hero && source.sale && onSale
      ? <Hero hero={hero} data={saleHero(source.sale, source, t)} compact={width > 0 && width < COMPACT_BELOW} onAction={onSale} />
      : null;
  }

  const compact = width > 0 && width < COMPACT_BELOW;
  const go = (index: number) => {
    spent.current = { slide: -1, ms: 0 };
    setCurrent((index + count) % count);
  };
  const isHero = (slide: ShowcaseBannerDto) => stacked && slide.scheme === 'BRAND';

  /*
   * Точки и пауза. На мониторе — поверх слайда в правом нижнем углу, где
   * нет ни текста, ни кнопки. На телефоне слайду тесно, и поверх он закрыл
   * бы кнопку, — там они стоят под слайдом.
   */
  const controls = count > 1 ? (
    <div className={cn(
      'flex h-10 items-center gap-2 rounded-[var(--radius-pill)] bg-[rgb(20_20_18/0.42)] pl-3.5 pr-1.5 backdrop-blur-md',
      compact || stacked ? 'self-center' : 'absolute bottom-3.5 right-3.5 z-[2]',
    )}>
      {slides.map((slide, index) => {
        const on = index === shown;
        return (
          <button
            key={slide.id}
            type="button"
            onClick={() => go(index)}
            aria-label={t('banners.goTo', { n: index + 1 })}
            aria-current={on}
            className={cn(
              'relative h-2 cursor-pointer overflow-hidden rounded-full border-0 bg-white/40 p-0 transition-[width] duration-300',
              'before:absolute before:-inset-x-1 before:-inset-y-4 before:content-[""]',
              on ? 'w-11' : 'w-2',
            )}
          >
            {on && (
              <span
                key={current}
                className="qo-progress block h-full rounded-full bg-white"
                style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: moving ? 'running' : 'paused' }}
              />
            )}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setPaused((was) => !was)}
        aria-label={paused ? t('banners.play') : t('banners.pause')}
        className="flex size-[30px] cursor-pointer items-center justify-center rounded-full border-0 bg-white/15 text-white hover:bg-white/30"
      >
        {paused
          ? <Play aria-hidden="true" className="size-3.5" fill="currentColor" />
          : <Pause aria-hidden="true" className="size-3.5" fill="currentColor" />}
      </button>
    </div>
  ) : null;

  return (
    <div ref={root} className="flex shrink-0 flex-col gap-2.5">
      <section
        aria-roledescription={t('banners.carousel')}
        aria-label={t('banners.label')}
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false); }}
        className={cn(
          'group relative shrink-0',
          stacked
            ? 'grid'
            : cn('overflow-hidden rounded-[var(--radius-gallery)] shadow-[0_18px_40px_-24px_rgb(26_25_23/0.45)]', compact ? 'h-[220px]' : 'h-[264px]'),
        )}
      >
        {slides.map((slide, index) => {
          const on = index === shown;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription={t('banners.slide')}
              aria-label={t('banners.slideLabel', { n: index + 1, total: count, title: slide.title })}
              aria-hidden={!on}
              className={cn(
                'transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none',
                stacked ? '[grid-area:1/1] self-start' : 'absolute inset-0',
                on ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-[1.04] opacity-0',
              )}
            >
              {isHero(slide) ? (
                <Hero hero={hero!} data={slideHero(slide, source, t)} compact={compact} hidden={!on} onAction={() => onAction(slide)} />
              ) : stacked ? (
                <div className={cn('overflow-hidden rounded-[var(--radius-template)] shadow-[0_18px_40px_-24px_rgb(26_25_23/0.45)]', compact ? 'h-[220px]' : 'h-[264px]')}>
                  <BannerSlide slide={slide} brand={brand} compact={compact} hidden={!on} onAction={() => onAction(slide)} />
                </div>
              ) : (
                <BannerSlide slide={slide} brand={brand} compact={compact} hidden={!on} onAction={() => onAction(slide)} />
              )}
            </div>
          );
        })}

        {count > 1 ? (
          <>
            {compact ? null : (
              <>
                <button type="button" onClick={() => go(shown - 1)} aria-label={t('banners.prev')}
                  className="absolute left-3.5 top-1/2 z-[2] flex size-13 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-white/90 text-ink opacity-0 shadow-[0_8px_20px_-8px_rgb(0_0_0/0.45)] transition-opacity duration-200 hover:bg-white focus-visible:opacity-100 group-hover:opacity-100">
                  <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={2.4} />
                </button>
                <button type="button" onClick={() => go(shown + 1)} aria-label={t('banners.next')}
                  className="absolute right-3.5 top-1/2 z-[2] flex size-13 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-white/90 text-ink opacity-0 shadow-[0_8px_20px_-8px_rgb(0_0_0/0.45)] transition-opacity duration-200 hover:bg-white focus-visible:opacity-100 group-hover:opacity-100">
                  <ChevronRight aria-hidden="true" className="size-6" strokeWidth={2.4} />
                </button>
              </>
            )}
            {compact || stacked ? null : controls}
          </>
        ) : null}
      </section>
    {compact || stacked ? controls : null}
    </div>
  );
}

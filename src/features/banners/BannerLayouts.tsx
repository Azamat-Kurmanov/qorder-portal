import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { LIFT, PHOTO, type SlideColors } from './bannerTheme';
import { ArtSvg } from './bannerArt';
import { ThemedLayout } from './BannerThemes';
import { cn } from '../../ui/cn';

/*
 * Раскладки слайдов витрины сверх первых трёх (распродажа, новинка, оптом).
 *
 * Файл один и тот же в кабинете продавца (`frontend/front`) и в кабинете
 * покупателя (`frontend/portal`, `features/banners/BannerLayouts.tsx`):
 * продавец в предпросмотре видит ровно то, что увидит покупатель. Поэтому
 * здесь нет ни библиотек значков, ни помощников классов — только React и
 * цвета схемы. Меняются копии только вместе.
 *
 * Слайд рисуется в двух размерах: на мониторе — высотой 264 во всю ширину
 * колонки, на телефоне — компактно. Заголовок, описание и кнопку собирает
 * тот, кто показывает слайд: у витрины кнопка настоящая, у редактора — нет.
 */

/** Поля слайда, нужные раскладке. */
export interface LayoutSlide {
  template: string;
  badge?: string;
  discount?: string;
  discountNote?: string;
  imageSrc?: string;
  showUntil?: string;
}

/** Заголовок, описание и кнопка — в цветах, которые назовёт раскладка. */
export interface SlideParts {
  title: ReactNode;
  text: ReactNode | null;
  button: ReactNode;
}

/** `big` — заголовок крупнее обычного: он и есть весь слайд. */
export type PartsFor = (colors: SlideColors, big?: boolean) => SlideParts;

const BAG_BODY = 'M22 52h76l-6 84H28z';
const BAG_HANDLE = 'M44 60V42a16 16 0 0 1 32 0v18';
const GIFT_BOW = 'M60 44c-10-18-34-20-30-4 2 6 16 6 30 4z M60 44c10-18 34-20 30-4-2 6-16 6-30 4z';

/** «2026-09-30» → «30.09». */
function dayMonth(iso: string | undefined): string | null {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return match ? `${match[2]}.${match[1]}` : null;
}

/** Картинка — или силуэт сумки, если её нет или она не открылась. */
function Photo({ src, color, className, style, fallback }: {
  src?: string; color: string; className?: string; style?: CSSProperties;
  /** Что стоит, пока снимка нет: иллюстрация шаблона. Пусто — силуэт сумки. */
  fallback?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (src && !broken) {
    return <img src={src} alt="" onError={() => setBroken(true)} className={cn('object-cover', className)} style={style} />;
  }
  if (fallback) {
    return <div aria-hidden="true" className={cn('flex items-center justify-center', className)} style={style}>{fallback}</div>;
  }
  return (
    <div aria-hidden="true" className={cn('flex items-center justify-center', className)} style={style}>
      <svg viewBox="0 0 120 150" className="h-[70%] w-auto max-w-[70%]">
        <path d={BAG_BODY} fill={color} />
        <path d={BAG_HANDLE} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Chip({ c, children }: { c: SlideColors; children: ReactNode }) {
  return (
    <span className="flex h-[30px] max-w-full items-center self-start rounded-[var(--radius-pill)] px-3 text-caption font-bold" style={{ background: c.chipBg, color: c.chipFg }}>
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Колонка текста: метка, заголовок, описание, внизу кнопка.
 *
 * `narrow` — колонка делит слайд с картинкой или скидкой. На телефоне ей не
 * хватает высоты на заголовок, описание и кнопку, и описание обрезалось бы
 * посреди строки — поэтому там его нет вовсе.
 */
function Column({ c, slide, parts, style, compact, center, noText, narrow }: {
  c: SlideColors;
  slide: LayoutSlide;
  parts: SlideParts;
  style: CSSProperties;
  compact: boolean;
  center?: boolean;
  noText?: boolean;
  narrow?: boolean;
}) {
  return (
    <div className={cn('absolute flex flex-col', compact ? 'gap-2' : 'gap-3', center && 'items-center text-center')} style={style}>
      {slide.badge ? <Chip c={c}>{slide.badge}</Chip> : null}
      {parts.title}
      {noText || (compact && narrow) ? null : parts.text}
      <div className={cn('mt-auto flex', center ? 'justify-center' : 'justify-start')}>{parts.button}</div>
    </div>
  );
}

/**
 * Слайд одного из пятнадцати шаблонов этого файла — или `null`, если
 * шаблон не отсюда.
 */
export function BannerLayout({ slide, c, compact, partsFor, untilLabel }: {
  slide: LayoutSlide;
  c: SlideColors;
  compact: boolean;
  partsFor: PartsFor;
  /** Подпись над датой окончания у «Последних дней»: «до». */
  untilLabel: string;
}) {
  const parts = partsFor(c);
  const pad = compact ? 16 : 32;
  const edge = { top: compact ? 16 : 28, bottom: compact ? 16 : 28 };
  const silhouette = c.stack[1];
  // Иллюстрация шаблона: на месте фото, пока его нет, и там, где картинки не бывает.
  const art = (className = 'h-[88%] w-auto max-w-[88%]', style?: CSSProperties) => (
    <ArtSvg template={slide.template} c={c} className={className} style={style} />
  );

  switch (slide.template) {
    case 'SPLIT':
      return (
        <>
          <Photo src={slide.imageSrc} color={silhouette} fallback={art()} className="absolute inset-y-0 right-0 h-full"
            style={{ width: compact ? '40%' : '46%', background: c.panel }} />
          <Column c={c} slide={slide} parts={parts} compact={compact} narrow
            style={{ ...edge, left: pad, right: compact ? 'calc(40% + 14px)' : 'calc(46% + 28px)' }} />
        </>
      );

    case 'FULL_PHOTO': {
      if (!slide.imageSrc) {
        // Пока снимка нет, на его месте силуэт — иначе шаблон не отличить от «По центру».
        return (
          <>
            <Photo color={silhouette} fallback={art()} className="absolute inset-y-0 right-0" style={{ width: compact ? '40%' : '42%' }} />
            <Column c={c} slide={slide} parts={parts} compact={compact} narrow
              style={{ ...edge, left: pad, right: compact ? 'calc(40% + 8px)' : '40%' }} />
          </>
        );
      }
      // Поверх фото текст всегда белый: цвета схемы на снимке не читаются.
      const onPhoto: SlideColors = {
        ...c, fg: PHOTO.fg, sub: PHOTO.sub, chipBg: PHOTO.chipBg, chipFg: PHOTO.chipFg, btnBg: PHOTO.btnBg, btnFg: PHOTO.btnFg,
      };
      return (
        <>
          <Photo src={slide.imageSrc} color={silhouette} fallback={art()} className="absolute inset-0 size-full" />
          <div aria-hidden="true" className="absolute inset-0"
            style={{ background: PHOTO.shade }} />
          <div className="absolute inset-0" style={{ color: onPhoto.fg }}>
            <Column c={onPhoto} slide={slide} parts={partsFor(onPhoto)} compact={compact} narrow
              style={{ ...edge, left: pad, right: compact ? pad : '38%' }} />
          </div>
        </>
      );
    }

    case 'CENTERED':
      return (
        <>
          {art('absolute', { left: compact ? -24 : 8, bottom: compact ? -12 : -18, width: compact ? 96 : 170, height: compact ? 96 : 170, opacity: 0.9 })}
          {art('absolute', { right: compact ? -24 : 8, top: compact ? -12 : -18, width: compact ? 80 : 140, height: compact ? 80 : 140, opacity: 0.9 })}
          <Column c={c} slide={slide} parts={parts} compact={compact} center style={{ ...edge, left: compact ? 56 : 150, right: compact ? 56 : 150 }} />
        </>
      );

    case 'FLASH_SALE':
      return (
        <>
          {compact ? null : art('absolute', { right: 12, top: '50%', width: 190, height: 190, transform: 'translateY(-50%)' })}
          <div data-discount="" className="absolute inset-y-0 flex items-center font-extrabold leading-none tracking-[-0.05em]"
            style={{ left: pad, width: compact ? '40%' : 300, fontSize: compact ? 48 : 96, color: c.circleBg }}>
            {slide.discount}
          </div>
          <Column c={c} slide={slide} parts={parts} compact={compact} narrow
            style={{ ...edge, left: compact ? 'calc(40% + 24px)' : 360, right: compact ? pad : 200 }} />
        </>
      );

    case 'PRICE_TAG':
      return (
        <>
          <div className="absolute overflow-hidden"
            style={{ top: compact ? 10 : 14, bottom: compact ? 10 : 14, right: compact ? 10 : 14, width: compact ? '38%' : 300, borderRadius: 16, background: c.panel }}>
            <Photo src={slide.imageSrc} color={silhouette} fallback={art()} className="absolute inset-0 size-full" />
          </div>
          {slide.discount ? (
            <div data-discount="" className="absolute flex items-center gap-2 font-extrabold leading-none"
              style={{
                top: compact ? 16 : 28, right: compact ? 'calc(38% - 70px)' : 190, padding: compact ? '8px 12px' : '12px 16px',
                fontSize: compact ? 18 : 30, borderRadius: '8px 16px 16px 8px', background: c.circleBg, color: c.circleFg, transform: 'rotate(-6deg)', boxShadow: LIFT,
              }}>
              <span aria-hidden="true" className="block rounded-full" style={{ width: compact ? 7 : 10, height: compact ? 7 : 10, background: c.bg }} />
              {slide.discount}
            </div>
          ) : null}
          <Column c={c} slide={slide} parts={parts} compact={compact} narrow
            style={{ ...edge, left: pad, right: compact ? 'calc(38% + 14px)' : 342 }} />
        </>
      );

    case 'SEASON': {
      const size = compact ? 150 : 230;
      return (
        <>
          {/* На телефоне кружок лёг бы на плашку над заголовком. */}
          {compact ? null : <div aria-hidden="true" className="absolute rounded-full" style={{ width: 38, height: 38, right: 290, top: 26, background: c.circleBg }} />}
          <div aria-hidden="true" className="absolute rounded-full" style={{ width: compact ? 12 : 18, height: compact ? 12 : 18, right: compact ? 12 : 30, bottom: compact ? 14 : 22, background: c.circleBg, opacity: 0.7 }} />
          <Photo src={slide.imageSrc} color={silhouette} fallback={art()} className="absolute overflow-hidden rounded-full"
            style={{ width: size, height: size, right: compact ? -12 : 50, top: '50%', transform: 'translateY(-50%)', border: `${compact ? 4 : 6}px solid ${c.panel}`, background: c.panel }} />
          <Column c={c} slide={slide} parts={parts} compact={compact} narrow
            style={{ ...edge, left: pad, right: compact ? size + 4 : size + 100 }} />
        </>
      );
    }

    case 'ANNOUNCEMENT': {
      const ribbon = compact ? 32 : 40;
      return (
        <>
          {art('absolute', { right: compact ? 0 : 20, bottom: compact ? -10 : -16, width: compact ? 120 : 200, height: compact ? 120 : 200 })}
          {slide.badge ? (
            <div className="absolute inset-x-0 top-0 flex items-center font-extrabold uppercase tracking-[0.08em]"
              style={{ height: ribbon, paddingLeft: pad, paddingRight: pad, fontSize: compact ? 11 : 13, background: c.circleBg, color: c.circleFg }}>
              <span className="truncate">{slide.badge}</span>
            </div>
          ) : null}
          <Column c={c} slide={{ ...slide, badge: undefined }} parts={parts} compact={compact}
            style={{ top: slide.badge ? ribbon + (compact ? 12 : 22) : edge.top, bottom: edge.bottom, left: pad, right: compact ? 118 : 230 }} />
        </>
      );
    }

    case 'DELIVERY':
      return (
        <>
          {art('absolute', { right: compact ? 4 : 16, bottom: compact ? -8 : -14, width: compact ? 120 : 190, height: compact ? 120 : 190 })}
          <Plaque c={c} compact={compact} discount={slide.discount} note={slide.discountNote} />
          <Column c={c} slide={slide} parts={parts} compact={compact} narrow
            style={{ ...edge, left: pad, right: compact ? 146 : 250 }} />
        </>
      );

    case 'GIFT':
      return (
        <>
          <div className="absolute flex items-center justify-center overflow-hidden"
            style={{ top: compact ? 10 : 14, bottom: compact ? 10 : 14, right: compact ? 10 : 14, width: compact ? '38%' : 280, borderRadius: 16, background: c.panel }}>
            {slide.imageSrc ? (
              <Photo src={slide.imageSrc} color={silhouette} fallback={art()} className="absolute inset-0 size-full" />
            ) : art('h-[92%] w-auto')}
            {slide.imageSrc ? (
              <svg viewBox="0 0 120 60" aria-hidden="true" className="absolute left-1/2 top-2 -translate-x-1/2" style={{ width: compact ? 56 : 84 }}>
                <path d={GIFT_BOW.replace(/44/g, '40')} fill={c.circleBg} />
              </svg>
            ) : null}
          </div>
          <Column c={c} slide={slide} parts={parts} compact={compact} narrow
            style={{ ...edge, left: pad, right: compact ? 'calc(38% + 24px)' : 324 }} />
        </>
      );

    case 'CIRCLE_PHOTO': {
      const size = compact ? 130 : 208;
      const left = compact ? 12 : 28;
      const dot = compact ? 52 : 76;
      return (
        <>
          <Photo src={slide.imageSrc} color={silhouette} fallback={art()} className="absolute overflow-hidden rounded-full"
            style={{ width: size, height: size, left, top: '50%', transform: 'translateY(-50%)', border: `${compact ? 4 : 6}px solid ${c.panel}`, background: c.panel }} />
          {slide.discount ? (
            <div data-discount="" className="absolute flex items-center justify-center rounded-full font-extrabold leading-none tracking-[-0.03em]"
              style={{ width: dot, height: dot, left: left + size - dot * 0.7, top: compact ? 12 : 22, fontSize: compact ? 15 : 22, background: c.circleBg, color: c.circleFg, transform: 'rotate(-8deg)', boxShadow: LIFT }}>
              {slide.discount}
            </div>
          ) : null}
          <Column c={c} slide={slide} parts={parts} compact={compact} narrow
            style={{ ...edge, left: left + size + (compact ? 16 : 36), right: pad }} />
        </>
      );
    }

    case 'MINIMAL':
      return (
        <>
          <div aria-hidden="true" className="absolute" style={{ inset: compact ? 10 : 14, borderRadius: 16, border: `1.5px solid ${c.fg}`, opacity: 0.22 }} />
          {art('absolute', { right: compact ? 14 : 36, bottom: compact ? 10 : 18, width: compact ? 96 : 170, height: compact ? 96 : 170 })}
          <Column c={c} slide={slide} parts={parts} compact={compact} noText
            style={{ top: compact ? 24 : 40, bottom: compact ? 24 : 40, left: compact ? 24 : 48, right: compact ? 24 : 48 }} />
        </>
      );

    case 'LAST_DAYS': {
      const date = dayMonth(slide.showUntil);
      return (
        <>
          {compact ? null : art('absolute', { right: 240, top: '50%', width: 150, height: 150, transform: 'translateY(-50%)' })}
          <div className="absolute flex flex-col items-center justify-center gap-1 text-center"
            style={{ top: compact ? 12 : 28, bottom: compact ? 12 : 28, right: compact ? 12 : 28, width: compact ? 104 : 200, borderRadius: 16, background: c.circleBg, color: c.circleFg, boxShadow: LIFT }}>
            {date ? (
              <>
                <span className="font-bold" style={{ fontSize: compact ? 11 : 14 }}>{untilLabel}</span>
                <span className="font-extrabold leading-none tracking-[-0.04em]" style={{ fontSize: compact ? 26 : 48 }}>{date}</span>
              </>
            ) : null}
            {slide.discount ? (
              date ? (
                <span data-discount="" className="mt-1 rounded-[var(--radius-pill)] font-extrabold" style={{ padding: compact ? '0 8px' : '4px 12px', fontSize: compact ? 13 : 18, background: c.circleFg, color: c.circleBg }}>
                  {slide.discount}
                </span>
              ) : (
                <span className="font-extrabold leading-none tracking-[-0.04em]" style={{ fontSize: compact ? 28 : 52 }} data-discount="">{slide.discount}</span>
              )
            ) : null}
          </div>
          <Column c={c} slide={slide} parts={parts} compact={compact}
            style={{ ...edge, left: pad, right: compact ? 128 : 390 }} />
        </>
      );
    }

    case 'STRIPE': {
      const width = compact ? '42%' : '50%';
      return (
        <>
          <div className="absolute inset-y-0 right-0 overflow-hidden" style={{ width, background: c.panel }}>
            <Photo src={slide.imageSrc} color={silhouette} fallback={art()} className="absolute inset-0 size-full" />
            {slide.discount ? (
              <div aria-hidden="true" className="absolute flex items-center justify-center gap-4 whitespace-nowrap font-extrabold tracking-[-0.02em]"
                style={{ left: '-30%', right: '-30%', top: '50%', height: compact ? 34 : 48, fontSize: compact ? 15 : 22, background: c.circleBg, color: c.circleFg, transform: 'translateY(-50%) rotate(-12deg)', boxShadow: LIFT }}>
                {Array.from({ length: 6 }, (_, i) => <span key={i} data-discount="">{slide.discount}</span>)}
              </div>
            ) : null}
          </div>
          {/* Скидка на ленте — узор; прочитать её можно здесь. */}
          {slide.discount ? <span className="sr-only" data-discount="">{slide.discount}</span> : null}
          <Column c={c} slide={slide} parts={parts} compact={compact} narrow
            style={{ ...edge, left: pad, right: compact ? 'calc(42% + 14px)' : 'calc(50% + 28px)' }} />
        </>
      );
    }

    case 'BIG_TITLE': {
      const big = partsFor(c, true);
      return (
        <>
        {art('absolute', { right: compact ? -20 : 10, top: compact ? -10 : -20, width: compact ? 130 : 230, height: compact ? 130 : 230, opacity: 0.28 })}
        <div className={cn('absolute flex flex-col', compact ? 'gap-2' : 'gap-3')} style={{ ...edge, left: pad, right: pad }}>
          {slide.badge ? <Chip c={c}>{slide.badge}</Chip> : null}
          {big.title}
          <div className="mt-auto flex items-end justify-between gap-4">
            <div className="min-w-0 max-w-[60%]">{compact ? null : big.text}</div>
            <div className="shrink-0">{big.button}</div>
          </div>
        </div>
        </>
      );
    }

    case 'BUNDLE': {
      const size = compact ? 108 : 190;
      return (
        <>
          {art('absolute', { right: compact ? size - 36 : size + 20, bottom: compact ? -8 : -14, width: compact ? 90 : 150, height: compact ? 90 : 150 })}
          <div className="absolute flex flex-col items-center justify-center gap-1 rounded-full text-center"
            style={{ width: size, height: size, right: compact ? 12 : 48, top: '50%', transform: 'translateY(-50%)', background: c.circleBg, color: c.circleFg, padding: compact ? 8 : 24, boxShadow: LIFT }}>
            <span className="font-extrabold leading-none tracking-[-0.04em]" style={{ fontSize: compact ? 30 : 56 }} data-discount="">{slide.discount}</span>
            {slide.discountNote ? <span className="font-bold leading-[1.25]" style={{ fontSize: compact ? 10 : 13 }}>{slide.discountNote}</span> : null}
          </div>
          <Column c={c} slide={slide} parts={parts} compact={compact}
            style={{ ...edge, left: pad, right: compact ? size + 24 : size + 170 }} />
        </>
      );
    }

    default:
      // Тематические шаблоны (праздники и поводы) — отдельным файлом, как у редактора продавца.
      return <ThemedLayout slide={slide} c={c} compact={compact} parts={parts} />;
  }
}

/** Плашка «сумма крупно, условие под ней» — как у оптового шаблона. */
function Plaque({ c, compact, discount, note }: { c: SlideColors; compact: boolean; discount?: string; note?: string }) {
  if (!discount && !note) return null;
  return (
    <div className="absolute flex flex-col items-center gap-1 text-center"
      style={{
        right: compact ? 12 : 28, top: compact ? 12 : 28, width: compact ? 122 : 180, padding: compact ? '12px 8px' : '16px',
        borderRadius: 16, background: c.circleBg, color: c.circleFg, boxShadow: LIFT,
      }}>
      {discount ? <span data-discount="" className="font-extrabold leading-none tracking-[-0.04em]" style={{ fontSize: compact ? 28 : 44 }}>{discount}</span> : null}
      {note ? <span className="font-bold leading-[1.3]" style={{ fontSize: compact ? 11 : 14 }}>{note}</span> : null}
    </div>
  );
}

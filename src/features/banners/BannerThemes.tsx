import type { CSSProperties, ReactNode } from 'react';
import type { SlideColors } from './bannerTheme';
import type { LayoutSlide, SlideParts } from './BannerLayouts';
import { LIFT } from './bannerTheme';
import { Art, ArtSvg } from './bannerArt';

/*
 * Тематические шаблоны слайдов: праздники, сезоны и сервис магазина.
 *
 * Файл один и тот же в кабинете продавца (`frontend/front`) и в кабинете
 * покупателя (`frontend/portal`), как и `BannerLayouts.tsx`: продавец в
 * предпросмотре видит ровно то, что увидит покупатель. Поэтому здесь только
 * React и цвета схемы слайда — ни библиотек значков, ни помощников классов.
 * Меняются копии только вместе.
 *
 * Каждый шаблон — это раскладка (где текст, где рисунок) и мотив: рисунок
 * темы, собранный из фигур в цветах схемы. Цвет мотива берётся из схемы,
 * а не задан шаблоном: продавец выбирает схему, и новогодний слайд может
 * быть и синим, и бордовым.
 */

export const THEME_TEMPLATES = [
  'NEW_YEAR', 'NAURYZ', 'MARCH_8', 'BLACK_FRIDAY', 'BACK_TO_SCHOOL', 'SUMMER', 'RAMADAN', 'BIRTHDAY', 'LOYALTY', 'CASHBACK',
  'PREORDER', 'RESTOCK', 'BESTSELLER', 'ECO', 'HANDMADE', 'WHOLESALE', 'INSTALLMENT', 'PICKUP', 'WEEKEND', 'NIGHT_SALE',
  'PROMO_CODE', 'COLLECTION', 'REVIEWS', 'GIVEAWAY', 'B2B', 'SCHEDULE', 'GRAND_OPENING', 'TRADE_IN', 'GIFT_CARD', 'WINTER',
] as const;

export type ThemeTemplate = typeof THEME_TEMPLATES[number];

const PILL = 'var(--radius-pill, 999px)';

type Arrangement = 'right' | 'left' | 'center' | 'ribbon' | 'discount';

/**
 * Как шаблон расставляет слайд: `right` — текст слева, рисунок справа;
 * `left` — наоборот; `center` — текст по центру, мотив рамкой вокруг;
 * `ribbon` — лента сверху; `discount` — крупная скидка слева.
 */
const ARRANGEMENT: Record<ThemeTemplate, Arrangement> = {
  NEW_YEAR: 'center', NAURYZ: 'ribbon', MARCH_8: 'right', BLACK_FRIDAY: 'discount', BACK_TO_SCHOOL: 'right',
  SUMMER: 'right', RAMADAN: 'center', BIRTHDAY: 'center', LOYALTY: 'right', CASHBACK: 'right',
  PREORDER: 'left', RESTOCK: 'right', BESTSELLER: 'left', ECO: 'right', HANDMADE: 'left',
  WHOLESALE: 'right', INSTALLMENT: 'discount', PICKUP: 'right', WEEKEND: 'discount', NIGHT_SALE: 'center',
  PROMO_CODE: 'right', COLLECTION: 'left', REVIEWS: 'center', GIVEAWAY: 'right', B2B: 'right',
  SCHEDULE: 'right', GRAND_OPENING: 'ribbon', TRADE_IN: 'right', GIFT_CARD: 'right', WINTER: 'right',
};

/** Шаблоны, у которых в рисунке место под фото товара. */
const PHOTO: ReadonlySet<ThemeTemplate> = new Set([
  'MARCH_8', 'BACK_TO_SCHOOL', 'SUMMER', 'PREORDER', 'RESTOCK', 'BESTSELLER', 'ECO', 'HANDMADE', 'COLLECTION',
  'GIVEAWAY', 'GRAND_OPENING', 'TRADE_IN', 'WINTER',
]);

/** Форма рамки фото: круг, арка, скруглённый прямоугольник, полароид. */
const FRAME: Partial<Record<ThemeTemplate, 'circle' | 'arch' | 'card' | 'polaroid'>> = {
  MARCH_8: 'arch', BACK_TO_SCHOOL: 'polaroid', SUMMER: 'circle', PREORDER: 'card', RESTOCK: 'card', BESTSELLER: 'circle',
  ECO: 'arch', HANDMADE: 'polaroid', COLLECTION: 'arch', GIVEAWAY: 'card', GRAND_OPENING: 'card', TRADE_IN: 'circle', WINTER: 'arch',
};

/* ----------------------------------------------------------------------------
 * Раскладки
 * ------------------------------------------------------------------------- */

function Photo({ src, c, frame, style, template }: {
  src?: string; c: SlideColors; frame: 'circle' | 'arch' | 'card' | 'polaroid'; style: CSSProperties; template: string;
}) {
  const radius: CSSProperties['borderRadius'] = frame === 'circle' ? 9999 : frame === 'arch' ? '9999px 9999px 16px 16px' : frame === 'card' ? 18 : 4;
  return (
    <div className="absolute overflow-hidden" style={{
      ...style, borderRadius: radius, background: c.panel, boxShadow: LIFT,
      border: frame === 'polaroid' ? `10px solid ${c.stack[2]}` : undefined, borderBottomWidth: frame === 'polaroid' ? 34 : undefined,
      // Своя центровка рамки (translateY) не затирается: поворот — только полароиду.
      transform: frame === 'polaroid' ? 'rotate(4deg)' : style.transform,
    }}>
      {src ? <img src={src} alt="" className="size-full object-cover" /> : (
        // Пока фото нет — иллюстрация шаблона, а не общий силуэт сумки.
        <ArtSvg template={template} c={c} className="absolute inset-0 m-auto h-[82%] w-auto" />
      )}
    </div>
  );
}

/** Колонка текста: метка, заголовок, описание, кнопка. */
function Text({ c, slide, parts, style, compact, center }: {
  c: SlideColors; slide: LayoutSlide; parts: SlideParts; style: CSSProperties; compact: boolean; center?: boolean;
}) {
  return (
    <div className="absolute flex flex-col" style={{ ...style, gap: compact ? 8 : 12, alignItems: center ? 'center' : undefined, textAlign: center ? 'center' : undefined }}>
      {slide.badge ? (
        <span className="flex max-w-full items-center self-start font-bold" style={{ alignSelf: center ? 'center' : 'flex-start', height: 30, padding: '0 12px', fontSize: 13, borderRadius: PILL, background: c.chipBg, color: c.chipFg }}>
          <span className="truncate">{slide.badge}</span>
        </span>
      ) : null}
      {parts.title}
      {compact ? null : parts.text}
      <div className="mt-auto flex" style={{ justifyContent: center ? 'center' : 'flex-start' }}>{parts.button}</div>
    </div>
  );
}

/** Скидка штампом: круг второго цвета схемы, чуть повёрнут. */
function Stamp({ c, compact, discount, note, style }: { c: SlideColors; compact: boolean; discount?: string; note?: string; style: CSSProperties }) {
  if (!discount) return null;
  const size = compact ? 76 : note ? 132 : 112;
  return (
    <div className="absolute flex flex-col items-center justify-center text-center" style={{
      ...style, width: size, height: size, borderRadius: 9999, background: c.circleBg, color: c.circleFg, boxShadow: LIFT, transform: 'rotate(-10deg)', padding: 8,
    }}>
      <span className="whitespace-nowrap font-extrabold leading-none tracking-[-0.04em]" style={{ fontSize: (compact ? 22 : note ? 34 : 38) * (discount.length > 4 ? 0.72 : 1) }}>{discount}</span>
      {note && !compact ? <span className="font-bold leading-[1.2]" style={{ fontSize: 11, marginTop: 4 }}>{note}</span> : null}
    </div>
  );
}

/**
 * Слайд одного из тематических шаблонов — или `null`, если шаблон не отсюда.
 */
export function ThemedLayout({ slide, c, compact, parts }: {
  slide: LayoutSlide;
  c: SlideColors;
  compact: boolean;
  parts: SlideParts;
}): ReactNode {
  if (!(THEME_TEMPLATES as readonly string[]).includes(slide.template)) return null;
  const template = slide.template as ThemeTemplate;
  const arrangement = ARRANGEMENT[template];
  const pad = compact ? 16 : 32;
  const edge = { top: compact ? 16 : 28, bottom: compact ? 16 : 28 };
  const art = compact ? 150 : 250;
  const photo = PHOTO.has(template);
  const frame = FRAME[template] ?? 'card';
  const motifBox = (style: CSSProperties, opacity = 1) => (
    <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute" style={{ ...style, opacity }}>
      <Art template={template} c={c} />
    </svg>
  );

  switch (arrangement) {
    case 'center':
      return (
        <>
          {motifBox({ left: compact ? -40 : -10, top: '50%', width: art, height: art, transform: 'translateY(-50%)' }, 0.9)}
          {motifBox({ right: compact ? -40 : -10, top: '50%', width: art, height: art, transform: 'translateY(-50%)' }, 0.9)}
          <Stamp c={c} compact={compact} discount={slide.discount} note={slide.discountNote} style={{ right: compact ? 8 : 24, bottom: compact ? 8 : 18 }} />
          <Text c={c} slide={slide} parts={parts} compact={compact} center style={{ ...edge, left: compact ? 80 : art, right: compact ? 80 : art }} />
        </>
      );
    case 'ribbon': {
      const ribbon = compact ? 30 : 38;
      return (
        <>
          <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: ribbon, background: c.circleBg }}>
            <svg viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full">
              {Array.from({ length: 20 }, (_, i) => (
                <path key={i} d={`M${i * 20} 20 q5 -14 10 0 q5 14 10 0`} fill="none" stroke={c.circleFg} strokeWidth={3} opacity={0.6} />
              ))}
            </svg>
          </div>
          {photo ? (
            <Photo src={slide.imageSrc} c={c} frame={frame} template={template} style={{ right: compact ? 12 : 40, top: ribbon + (compact ? 10 : 18), bottom: compact ? 10 : 18, width: compact ? '36%' : 280 }} />
          ) : motifBox({ right: compact ? -10 : 30, top: ribbon, bottom: 0, width: compact ? 150 : 250, height: compact ? 150 : 226 })}
          <Stamp c={c} compact={compact} discount={slide.discount} note={slide.discountNote} style={{ right: compact ? 10 : 300, bottom: compact ? 10 : 20 }} />
          <Text c={c} slide={slide} parts={parts} compact={compact}
            style={{ top: ribbon + (compact ? 12 : 22), bottom: edge.bottom, left: pad, right: compact ? '40%' : 340 }} />
        </>
      );
    }
    case 'discount':
      return (
        <>
          {/* На мониторе иллюстрация — целиком справа; на телефоне места нет, и она бледным фоном. */}
          {compact
            ? motifBox({ right: -40, bottom: -40, width: 150, height: 150 }, 0.28)
            : motifBox({ right: 24, top: '50%', width: 220, height: 220, transform: 'translateY(-50%)' })}
          <div className="absolute inset-y-0 flex flex-col justify-center font-extrabold leading-none tracking-[-0.05em]"
            style={{ left: pad, width: compact ? '42%' : 330, fontSize: compact ? 46 : 104, color: c.circleBg }}>
            {slide.discount}
            {slide.discountNote ? <span className="font-bold tracking-normal" style={{ fontSize: compact ? 11 : 16, color: c.sub, marginTop: 8 }}>{slide.discountNote}</span> : null}
          </div>
          <Text c={c} slide={slide} parts={parts} compact={compact} style={{ ...edge, left: compact ? 'calc(42% + 20px)' : 380, right: compact ? pad : 260 }} />
        </>
      );
    case 'left':
      return (
        <>
          {photo ? (
            <Photo src={slide.imageSrc} c={c} frame={frame} template={template} style={{ left: compact ? 12 : 40, top: compact ? 12 : 22, bottom: compact ? 12 : 22, width: compact ? '36%' : 260 }} />
          ) : motifBox({ left: compact ? -10 : 20, top: '50%', width: art, height: art, transform: 'translateY(-50%)' })}
          {photo && slide.imageSrc ? motifBox({ left: compact ? '26%' : 230, bottom: compact ? -10 : -20, width: compact ? 70 : 120, height: compact ? 70 : 120 }) : null}
          <Stamp c={c} compact={compact} discount={slide.discount} note={slide.discountNote} style={{ right: compact ? 10 : 30, top: compact ? 10 : 24 }} />
          <Text c={c} slide={slide} parts={parts} compact={compact} style={{ ...edge, left: compact ? 'calc(36% + 28px)' : 340, right: slide.discount ? (compact ? 90 : 170) : pad }} />
        </>
      );
    default:
      return (
        <>
          {photo ? (
            <>
              <Photo src={slide.imageSrc} c={c} frame={frame} template={template} style={frame === 'circle'
                ? { right: compact ? -10 : 60, top: '50%', width: compact ? 150 : 220, height: compact ? 150 : 220, transform: 'translateY(-50%)' }
                : { right: compact ? 12 : 44, top: compact ? 12 : 22, bottom: compact ? 12 : 22, width: compact ? '36%' : 260 }} />
              {/* Без фото в рамке уже стоит иллюстрация — второй, мелкий повтор рядом лишний. */}
              {slide.imageSrc ? motifBox({ right: compact ? '30%' : 250, bottom: compact ? -16 : -24, width: compact ? 80 : 130, height: compact ? 80 : 130 }) : null}
            </>
          ) : motifBox({ right: compact ? -20 : 40, top: '50%', width: art, height: art, transform: 'translateY(-50%)' })}
          <Stamp c={c} compact={compact} discount={slide.discount} note={slide.discountNote}
            style={photo ? { right: compact ? '32%' : 290, top: compact ? 10 : 22 } : { right: compact ? 12 : 270, top: compact ? 10 : 24 }} />
          <Text c={c} slide={slide} parts={parts} compact={compact}
            style={{ ...edge, left: pad, right: compact ? (slide.discount ? 'calc(32% + 84px)' : '40%') : slide.discount ? 430 : 340 }} />
        </>
      );
  }
}

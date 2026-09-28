import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Box, Clock } from 'lucide-react';
import type { ShowcaseBannerDto } from '../../api/generated';
import { cn } from '../../ui/cn';
import { BannerLayout, type PartsFor } from './BannerLayouts';
import { BADGE, SILHOUETTE, STAR_COLOR, slideColors } from './bannerTheme';

/** Силуэты вместо картинки — как в макете: пальто у распродажи, юбка у новинки. */
const COAT = 'M46 16l14 7 14-7 22 9 10 70-16 4-6-40v76H46V59l-6 40-16-4 10-70z';
const SKIRT = 'M42 28h36l20 104H22z';
const STACK = [
  'M46 20c9 4 19 4 28 0l-2 12H48z M34 36c10-6 42-6 52 0l-3 8c8 20 10 58 6 86-2 8-54 8-56 0-4-28-2-66 6-86z',
  'M52 14h16v18c0 6 14 12 14 26v76a6 6 0 0 1-6 6H44a6 6 0 0 1-6-6V58c0-14 14-20 14-26z',
  'M24 58h66v76H24z M24 58l14-18h66l-14 18z M94 58l14-18v76l-14 18z',
];
const STAR = 'M12 2l2.4 6.9L21 9.3l-5.3 4.3L17.6 21 12 17l-5.6 4 1.9-7.4L3 9.3l6.6-.4z';

/**
 * Картинка — или силуэт, если её нет или она не открылась: ссылку из чужого
 * облака могли закрыть, и пустое место на витрине хуже силуэта.
 */
function Picture({ src, fallback, color, className }: { src?: string; fallback: string; color: string; className: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (src && !broken) {
    return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={cn('object-cover', className)} />;
  }
  return (
    <svg viewBox="0 0 120 150" aria-hidden="true" className={className}>
      <path d={fallback} fill={color} />
    </svg>
  );
}

function Chip({ bg, fg, icon, children }: { bg: string; fg: string; icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex h-[30px] items-center gap-2 self-start rounded-[var(--radius-pill)] px-3 text-caption font-bold" style={{ background: bg, color: fg }}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Слайд витрины.
 *
 * На мониторе — раскладка макета высотой 264 во всю ширину колонки: текст
 * привязан к левому краю, картинка и скидка — к правому. На телефоне той же
 * раскладке не хватает места, и слайд собирается компактно: тот же порядок
 * и те же цвета, но картинка уже, а описания нет (как в макете ClientMobile).
 *
 * Первые три шаблона нарисованы здесь, остальные — в `BannerLayouts`.
 */
export function BannerSlide({ slide, brand, compact, onAction, hidden }: {
  slide: ShowcaseBannerDto;
  brand: string;
  compact: boolean;
  onAction: () => void;
  hidden: boolean;
}) {
  const { t } = useTranslation();
  const c = slideColors(slide.scheme, brand);

  const partsFor: PartsFor = (colors, big) => ({
    button: (
      <button
        type="button"
        tabIndex={hidden ? -1 : 0}
        onClick={onAction}
        className={cn(
          'mt-auto flex max-w-full shrink-0 cursor-pointer items-center gap-2.5 self-start rounded-[var(--radius-tile)] border-0 font-bold transition-transform duration-300 hover:scale-[1.03]',
          compact ? 'h-11 px-4 text-body' : 'h-[50px] px-[22px] text-base',
        )}
        style={{ background: colors.btnBg, color: colors.btnFg }}
      >
        <span className="truncate">{slide.buttonText}</span>
        <ArrowRight aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.2} />
      </button>
    ),
    title: (
      <div
        className={cn(
          'font-extrabold [text-wrap:balance]',
          big
            ? compact ? 'text-[1.875rem] leading-[1.02] tracking-[-0.03em]' : 'text-[3.5rem] leading-[0.98] tracking-[-0.035em]'
            : compact ? 'text-title leading-[1.1] tracking-[-0.025em]' : 'text-[2rem] leading-[1.04] tracking-[-0.025em]',
        )}
        style={{ color: colors.fg }}
      >
        {slide.title}
      </div>
    ),
    // На телефоне описания нет, как в макете ClientMobile: в 220 точек высоты
    // оно теснило заголовок и кнопку, а смысл слайда несёт заголовок.
    text: slide.text && !compact ? (
      <div className="text-body leading-[1.45]" style={{ color: colors.sub }}>
        {slide.text}
      </div>
    ) : null,
  });
  const { button, title, text } = partsFor(c);

  return (
    <div className="relative size-full overflow-hidden" style={{ background: c.bg, color: c.fg }}>
      <div aria-hidden="true" className="absolute rounded-full" style={{ width: 420, height: 420, right: -90, top: -120, background: c.glow }} />
      <div aria-hidden="true" className="absolute rounded-full" style={{ width: 220, height: 220, right: 170, bottom: -150, background: c.glow }} />

      {slide.template === 'SALE' ? (
        <>
          {slide.imageSrc ? (
            <Picture src={slide.imageSrc} fallback={COAT} color={SILHOUETTE.sale}
              className={cn('absolute right-0 top-0 h-full', compact ? 'w-[38%]' : 'w-[300px]')} />
          ) : (
            <svg viewBox="0 0 120 150" aria-hidden="true" className="absolute"
              style={compact ? { right: 4, bottom: -30, width: 150, height: 180 } : { right: 26, bottom: -44, width: 250, height: 290 }}>
              <path d={COAT} fill={SILHOUETTE.sale} />
            </svg>
          )}
          {slide.discount ? (
            <div
              className="absolute flex flex-col items-center justify-center rounded-full leading-none shadow-[0_14px_30px_-14px_rgb(0_0_0/0.45)]"
              style={{
                ...(compact ? { right: 12, top: 12, width: 72, height: 72 } : { right: 232, top: 28, width: 108, height: 108 }),
                background: c.circleBg, color: c.circleFg, transform: 'rotate(-8deg)',
              }}
            >
              <span className={cn('font-bold', compact ? 'text-2xs' : 'text-caption')}>{t('banners.upTo')}</span>
              <span className={cn('font-extrabold tracking-[-0.03em]', compact ? 'text-title' : 'text-[2.125rem]')}>{slide.discount}</span>
            </div>
          ) : null}
          <div className={cn('absolute flex flex-col', compact ? 'inset-y-4 left-4 right-[34%] gap-2' : 'bottom-7 left-8 top-7 w-[360px] gap-3')}>
            {slide.badge ? <Chip bg={c.chipBg} fg={c.chipFg} icon={<Clock aria-hidden="true" className="size-[15px] shrink-0" strokeWidth={2.2} />}>{slide.badge}</Chip> : null}
            {title}
            {text ? <div className="max-w-[330px]">{text}</div> : null}
            {button}
          </div>
        </>
      ) : null}

      {slide.template === 'NEW_ITEM' ? (
        <>
          <div
            className={cn('absolute flex items-center justify-center overflow-hidden', compact ? 'inset-y-2.5 left-2.5 w-[38%] rounded-[var(--radius-tile)]' : 'inset-y-3.5 left-3.5 w-[300px] rounded-[calc(var(--radius-tile)*1.125)]')}
            style={{ background: c.panel }}
          >
            <Picture src={slide.imageSrc} fallback={SKIRT} color={SILHOUETTE.new}
              className={slide.imageSrc ? 'absolute inset-0 size-full' : compact ? 'h-[140px] w-[112px]' : 'h-[210px] w-[170px]'} />
            {slide.badge ? (
              <span className="absolute left-3 top-3 flex h-[30px] max-w-[calc(100%-24px)] items-center gap-1.5 rounded-[var(--radius-pill)] px-3 text-caption font-extrabold"
                style={{ background: BADGE.bg, color: BADGE.fg }}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0"><path d={STAR} fill={STAR_COLOR} /></svg>
                <span className="truncate">{slide.badge}</span>
              </span>
            ) : null}
          </div>
          <div className={cn('absolute flex flex-col', compact ? 'inset-y-4 left-[calc(38%+22px)] right-4 gap-2' : 'bottom-7 left-[346px] right-8 top-[30px] gap-3')}>
            {title}
            {text}
            {button}
          </div>
        </>
      ) : null}

      {slide.template === 'BULK' ? (
        <>
          {compact ? null : (
            <div aria-hidden="true" className="absolute" style={{ right: 196, bottom: -26, width: 296, height: 190 }}>
              <svg viewBox="0 0 120 150" className="absolute bottom-0" style={{ left: 0, width: 120, height: 150, opacity: 0.55 }}><path d={STACK[0]} fill={c.stack[0]} /></svg>
              <svg viewBox="0 0 120 150" className="absolute bottom-0" style={{ left: 66, width: 140, height: 175, opacity: 0.8 }}><path d={STACK[1]} fill={c.stack[1]} /></svg>
              <svg viewBox="0 0 120 150" className="absolute bottom-0" style={{ left: 146, width: 150, height: 190 }}><path d={STACK[2]} fill={c.stack[2]} /></svg>
            </div>
          )}
          <div
            className={cn(
              'absolute flex flex-col items-center gap-1 rounded-[calc(var(--radius-tile)*1.25)] text-center shadow-[0_14px_30px_-16px_rgb(0_0_0/0.45)]',
              compact ? 'right-3 top-3 w-[108px] px-2 py-3' : 'right-7 top-7 w-[164px] px-4 py-[18px]',
            )}
            style={{ background: c.circleBg, color: c.circleFg }}
          >
            <span className={cn('font-extrabold leading-none tracking-[-0.04em]', compact ? 'text-[1.75rem]' : 'text-[2.75rem]')}>{slide.discount}</span>
            <span className={cn('font-bold leading-[1.3]', compact ? 'text-2xs' : 'text-sm')}>{slide.discountNote}</span>
          </div>
          <div className={cn('absolute flex flex-col', compact ? 'inset-y-4 left-4 right-[132px] gap-2' : 'bottom-7 left-8 top-7 w-[330px] gap-3')}>
            {slide.badge ? <Chip bg={c.chipBg} fg={c.chipFg} icon={<Box aria-hidden="true" className="size-[15px] shrink-0" strokeWidth={2.2} />}>{slide.badge}</Chip> : null}
            {title}
            {text}
            {button}
          </div>
        </>
      ) : null}

      <BannerLayout slide={slide} c={c} compact={compact} partsFor={partsFor} untilLabel={t('banners.until')} />
    </div>
  );
}

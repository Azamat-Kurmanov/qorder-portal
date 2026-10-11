import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Box, Clock } from 'lucide-react';
import type { ShowcaseBannerDto } from '../../api/generated';
import { cn } from '../../ui/cn';
import { BannerLayout, type PartsFor } from './BannerLayouts';
import { ArtSvg } from './bannerArt';
import { phoneBadgeText, phoneButtonText } from './buttonLabel';
import { BADGE, SILHOUETTE, STAR_COLOR, slideColors } from './bannerTheme';
import { ART_MODE, SkinLayer, skinColors, type BannerSkin } from './bannerSkins';
import { Countdown } from './Countdown';
import { useMotion } from '../../ui/motion/motionLevel';
import { useCountUp } from '../../ui/motion/useCountUp';

/** Силуэты вместо картинки — как в макете: пальто у распродажи, юбка у новинки. */
const COAT = 'M46 16l14 7 14-7 22 9 10 70-16 4-6-40v76H46V59l-6 40-16-4 10-70z';
const SKIRT = 'M42 28h36l20 104H22z';
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
/**
 * Скидка досчитывается от нуля, когда слайд показался («живо» и выше): видно,
 * что цифра настоящая и только что «случилась». Текст с одним числом
 * («−20%», «до 30%») — иначе как есть; «спокойно» — сразу своё число.
 */
function useCountedText(text: string | undefined, hidden: boolean): string | undefined {
  const level = useMotion();
  const numbers = text?.match(/\d+/g);
  const target = numbers?.length === 1 ? Number(numbers[0]) : null;
  const [started, setStarted] = useState(false);
  useEffect(() => setStarted(!hidden), [hidden]);
  const shown = useCountUp(target !== null && started ? target : 0, 700);
  if (target === null || level === 'calm') return text;
  return text!.replace(/\d+/, String(Math.round(shown)));
}

export function BannerSlide({ slide: given, brand, compact, onAction, hidden, skin, alt = false, big: large = false, endsAt }: {
  slide: ShowcaseBannerDto;
  brand: string;
  compact: boolean;
  onAction: () => void;
  hidden: boolean;
  /** Одежда темы кабинета (`bannerSkins.tsx`); пусто — слайд как прежде. */
  skin?: BannerSkin;
  /** Вторая тема направления — свой оттенок одежды. */
  alt?: boolean;
  /** Крупный вариант — главный баннер темы (фирменный слайд, распродажа) вместо прежних героев. */
  big?: boolean;
  /** Конец распродажи — отсчёт на крупном баннере. */
  endsAt?: string;
}) {
  const { t } = useTranslation();
  // На телефоне плашка над заголовком — короче, по словам: целиком в узкую
  // колонку она не влезала и обрезалась многоточием. Одно место на все раскладки.
  const discount = useCountedText(given.discount, hidden);
  const shortened = compact && given.badge ? { ...given, badge: phoneBadgeText(given.badge) } : given;
  const slide = discount === given.discount ? shortened : { ...shortened, discount };
  const scheme = slideColors(slide.scheme, brand);
  // Одежда пересчитывает цвета схемы: на тёмной основе неона текст светлый и т. п.
  const c = skin ? skinColors(skin, alt, scheme, !!slide.imageSrc) : scheme;

  // Светлый текст — тёмные ячейки отсчёта, тёмный — светлые.
  const lightText = /^#[0-9A-F]{6}$/i.test(c.fg) && parseInt(c.fg.slice(1, 3), 16) + parseInt(c.fg.slice(3, 5), 16) + parseInt(c.fg.slice(5, 7), 16) > 382;
  const partsFor: PartsFor = (colors, wide) => {
    const big = wide || large;
    return {
    button: (
      <button
        type="button"
        data-rise="3"
        // Подпись на телефоне укорочена — читалке отдаём полную.
        aria-label={compact && phoneButtonText(slide.buttonText ?? '') !== slide.buttonText?.trim() ? slide.buttonText : undefined}
        tabIndex={hidden ? -1 : 0}
        onClick={onAction}
        className={cn(
          'qo-skin-cta mt-auto flex max-w-full shrink-0 cursor-pointer items-center rounded-[var(--radius-tile)] border-0 font-bold transition-transform duration-300 hover:scale-[1.03]',
          // На телефоне — во всю ширину колонки, и подпись переносится на вторую
          // строку, а не обрезается: «Выбрать одеж…» не говорило, куда ведёт кнопка.
          compact
            ? 'min-h-11 w-full justify-between gap-2 self-stretch px-3.5 py-1.5 text-sm leading-tight'
            : 'h-[50px] gap-2.5 self-start px-[22px] text-base',
        )}
        style={{ background: colors.btnBg, color: colors.btnFg }}
      >
        <span className={compact ? 'line-clamp-2 text-left' : 'truncate'}>{compact ? phoneButtonText(slide.buttonText ?? '') : slide.buttonText}</span>
        <ArrowRight aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.2} />
      </button>
    ),
    title: (
      <div
        data-rise="1"
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
      <div data-rise="2" className="text-body leading-[1.45]" style={{ color: colors.sub }}>
        {slide.text}
      </div>
    ) : null,
    };
  };
  const { button, title, text } = partsFor(c);

  return (
    // Скрытый слайд — без анимации: вернувшись на экран, атрибут появляется
    // заново, и анимация играет с начала, а не доигрывается за кадром.
    <div data-anim={hidden ? undefined : slide.animation ?? 'FADE'} className="qo-banner relative size-full overflow-hidden"
      data-skin={skin} data-skin-alt={(skin && alt) || undefined} data-art-mode={skin ? ART_MODE[skin] : undefined}
      data-photo={slide.imageSrc ? '' : undefined}
      data-big={large || undefined}
      style={{
        backgroundColor: c.bg, backgroundImage: c.paint, color: c.fg,
        ...(skin ? { '--skin-c1': scheme.btnBg, '--skin-c2': scheme.circleBg } as CSSProperties : null),
      }}>
      {skin ? <SkinLayer skin={skin} alt={alt} /> : null}
      <div aria-hidden="true" className="absolute rounded-full" style={{ width: 420, height: 420, right: -90, top: -120, background: c.glow }} />
      <div aria-hidden="true" className="absolute rounded-full" style={{ width: 220, height: 220, right: 170, bottom: -150, background: c.glow }} />

      {slide.template === 'SALE' ? (
        <>
          {slide.imageSrc ? (
            <Picture src={slide.imageSrc} fallback={COAT} color={SILHOUETTE.sale}
              className={cn('absolute right-0 top-0 h-full', compact ? 'w-[38%]' : 'w-[300px]')} />
          ) : (
            <ArtSvg template="SALE" c={c} className="absolute"
              style={compact ? { right: 0, bottom: -10, width: 150, height: 150 } : { right: 16, bottom: -12, width: 250, height: 250 }} />
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
              <span className={cn('font-extrabold tracking-[-0.03em]', compact ? 'text-title' : 'text-[2.125rem]')} data-discount="">{slide.discount}</span>
            </div>
          ) : null}
          <div className={cn('absolute flex flex-col', compact ? 'inset-y-4 left-4 right-[34%] gap-2' : 'bottom-7 left-8 top-7 w-[360px] gap-3')}>
            {slide.badge ? <Chip bg={c.chipBg} fg={c.chipFg} icon={<Clock aria-hidden="true" className="size-[15px] shrink-0" strokeWidth={2.2} />}>{slide.badge}</Chip> : null}
            {title}
            {text ? <div className="max-w-[330px]">{text}</div> : null}
            {endsAt && compact ? <Countdown endsAt={endsAt} tone={lightText ? 'dark' : 'light'} small /> : null}
            {button}
          </div>
          {/* На мониторе отсчёт — в углу, как в предпросмотре продавца: в колонке
              он выталкивал кнопку за край слайда при заголовке длиннее строки. */}
          {endsAt && !compact ? (
            <span className="absolute bottom-4 right-4">
              <Countdown endsAt={endsAt} tone={lightText ? 'dark' : 'light'} />
            </span>
          ) : null}
        </>
      ) : null}

      {slide.template === 'NEW_ITEM' ? (
        <>
          <div
            className={cn('absolute flex items-center justify-center overflow-hidden', compact ? 'inset-y-2.5 left-2.5 w-[38%] rounded-[var(--radius-tile)]' : 'inset-y-3.5 left-3.5 w-[300px] rounded-[calc(var(--radius-tile)*1.125)]')}
            style={{ background: c.panel }}
          >
            {slide.imageSrc ? (
              <Picture src={slide.imageSrc} fallback={SKIRT} color={SILHOUETTE.new} className="absolute inset-0 size-full" />
            ) : (
              <ArtSvg template="NEW_ITEM" c={c} className={compact ? 'size-[150px]' : 'size-[230px]'} />
            )}
            {slide.badge ? (
              <span className={cn('absolute flex max-w-[calc(100%-16px)] items-center rounded-[var(--radius-pill)] font-extrabold',
                compact ? 'left-2 top-2 h-6 gap-1 px-2 text-2xs' : 'left-3 top-3 h-[30px] gap-1.5 px-3 text-caption')}
                style={{ background: BADGE.bg, color: BADGE.fg }}>
                <svg width={compact ? 11 : 14} height={compact ? 11 : 14} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0"><path d={STAR} fill={STAR_COLOR} /></svg>
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
          {compact ? null : <ArtSvg template="BULK" c={c} className="absolute" style={{ right: 200, bottom: -14, width: 230, height: 230 }} />}
          <div
            className={cn(
              'absolute flex flex-col items-center gap-1 rounded-[calc(var(--radius-tile)*1.25)] text-center shadow-[0_14px_30px_-16px_rgb(0_0_0/0.45)]',
              compact ? 'right-3 top-3 w-[108px] px-2 py-3' : 'right-7 top-7 w-[164px] px-4 py-[18px]',
            )}
            style={{ background: c.circleBg, color: c.circleFg }}
          >
            <span className={cn('font-extrabold leading-none tracking-[-0.04em]', compact ? 'text-[1.75rem]' : 'text-[2.75rem]')} data-discount="">{slide.discount}</span>
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

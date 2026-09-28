import palette from './bannerPalette.json';
import type { ShowcaseBannerDtoScheme } from '../../api/generated';

/**
 * Цвета слайда витрины.
 *
 * Палитра — та же, что у редактора продавца (`frontend/front`,
 * `features/banners/bannerPalette.json`): продавец видит в предпросмотре
 * ровно то, что здесь увидит покупатель. Меняются они только вместе.
 */
export interface SlideColors {
  bg: string;
  fg: string;
  sub: string;
  chipBg: string;
  chipFg: string;
  btnBg: string;
  btnFg: string;
  circleBg: string;
  circleFg: string;
  glow: string;
  panel: string;
  stripe: string;
  stack: [string, string, string];
}

function channels(hex: string): number[] {
  const clean = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
}

function mix(from: string, to: string, t: number): string {
  const a = channels(from);
  const b = channels(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function slideColors(scheme: ShowcaseBannerDtoScheme | undefined, brand: string): SlideColors {
  if (scheme === 'BRAND') {
    const deep = mix(brand, palette.black, 0.22);
    return {
      ...palette.schemes.BRAND,
      // Заливка — токеном, а не числом: в тёмной теме фирменный баннер
      // притушен панелью (`--color-banner`, src/supplier/supplierTheme.ts),
      // и белые буквы на нём остаются читаемыми. Число — запасное, если
      // токена нет (предпросмотр вне кабинета).
      bg: `var(--color-banner, ${brand})`,
      btnFg: deep,
      circleFg: deep,
      stack: [mix(brand, palette.white, 0.45), mix(brand, palette.white, 0.7), palette.white],
    };
  }
  const fixed = palette.schemes[scheme ?? 'GRAPHITE'] ?? palette.schemes.GRAPHITE;
  return { ...fixed, stack: fixed.stack as [string, string, string] };
}

export const STAR_COLOR = palette.star;
export const SILHOUETTE = palette.silhouette;
export const BADGE = palette.badge;

/** Текст поверх фото на весь слайд: цвета схемы на снимке не читаются. */
export const PHOTO = palette.photo;
/** Тень плашек и кружков скидки: слайд одинаков в обеих темах кабинета. */
export const LIFT = palette.lift;

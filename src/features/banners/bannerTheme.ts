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
  /**
   * Слои поверх `bg` (`background-image`): цветовые пятна и градиент, а не
   * плоский цвет — плоский фон делал баннеры бледными. `bg` — основа под ними
   * (`background-color`) и цвет для смешений.
   */
  paint: string;
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
      paint: brandPaint(brand),
      btnFg: deep,
      circleFg: deep,
      stack: [mix(brand, palette.white, 0.45), mix(brand, palette.white, 0.7), palette.white],
    };
  }
  const fixed = palette.schemes[scheme ?? 'GRAPHITE'] ?? palette.schemes.GRAPHITE;
  return { ...fixed, paint: fixed.paint ?? 'none', stack: fixed.stack as [string, string, string] };
}

const PAINT_LIGHT = palette.white;
const PAINT_DEEP = palette.black;

/** Блики «цвета магазина»: светлое пятно и глубокая тень поверх его цвета. */
function brandPaint(brand: string): string {
  return `radial-gradient(60% 95% at 90% 6%, ${mix(brand, PAINT_LIGHT, 0.38)}b3 0%, transparent 62%), `
    + `radial-gradient(52% 85% at 4% 100%, ${mix(brand, PAINT_DEEP, 0.45)}99 0%, transparent 60%)`;
}

export const STAR_COLOR = palette.star;
export const SILHOUETTE = palette.silhouette;
export const BADGE = palette.badge;

/** Текст поверх фото на весь слайд: цвета схемы на снимке не читаются. */
export const PHOTO = palette.photo;
/** Тень плашек и кружков скидки: слайд одинаков в обеих темах кабинета. */
export const LIFT = palette.lift;

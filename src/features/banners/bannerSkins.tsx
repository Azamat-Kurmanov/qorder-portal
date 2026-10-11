import type { SlideColors } from './bannerTheme';
import './bannerSkins.css';
import palette from './bannerPalette.json';

/** Цвета одежд — в общей палитре баннеров: литерал цвета в коде запрещён приёмкой слоя. */
const P = palette.skins;

/**
 * Одежды баннеров живых тем (спецификация 2026-10-09, «Баннеры»).
 *
 * Что показать — решает продавец (раскладка, текст, фото, схема), как это
 * выглядит — тема кабинета. Одежда не меняет расположение: она пересчитывает
 * цвета слайда (`skinColors`), кладёт задний слой (`SkinLayer`) и задаёт
 * способ отрисовки мотива (`ART_MODE`); остальное — `bannerSkins.css`.
 *
 * Один и тот же файл лежит в `front` и `portal` (как `bannerArt.tsx`):
 * продавец в предпросмотре видит ровно то, что увидит покупатель.
 */
export type BannerSkin = 'glass' | 'depth' | 'neon' | 'soft' | 'studio' | 'lookbook';

export const SKINS: BannerSkin[] = ['glass', 'depth', 'neon', 'soft', 'studio', 'lookbook'];

/** Тема → одежда; вторая тема направления (`alt`) — со своим оттенком. */
const THEMES: Record<string, { skin: BannerSkin; alt: boolean }> = {
  GLOW: { skin: 'glass', alt: false }, PRISM: { skin: 'glass', alt: true },
  DEPTH: { skin: 'depth', alt: false }, FLOAT: { skin: 'depth', alt: true },
  NEON: { skin: 'neon', alt: false }, PULSE: { skin: 'neon', alt: true },
  BLOBS: { skin: 'soft', alt: false }, JELLY: { skin: 'soft', alt: true },
  STUDIO: { skin: 'studio', alt: false }, FLASH: { skin: 'studio', alt: true },
  LOOKBOOK: { skin: 'lookbook', alt: false }, SEASON: { skin: 'lookbook', alt: true },
};

/** Одежда темы кабинета; `null` — тема не живая (или дизайна нет): баннер как прежде. */
export function skinOf(templateId: string | undefined | null): { skin: BannerSkin; alt: boolean } | null {
  return (templateId && THEMES[templateId]) || null;
}

/** Как рисуется мотив: заливкой, тонкой линией, светящейся линией или стеклом. */
export const ART_MODE: Record<BannerSkin, 'fill' | 'line' | 'glow' | 'glass'> = {
  glass: 'glass', depth: 'fill', neon: 'glow', soft: 'fill', studio: 'line', lookbook: 'line',
};

const HEX = /^#[0-9A-Fa-f]{6}$/;
/** Метка на тёмной основе и на светлой: подложка полупрозрачная, текст — по контрасту. */
const CHIP_ON_DARK = { chipBg: P.chipOnDark, chipFg: P.paper };
const CHIP_ON_LIGHT = { chipBg: P.chipOnLight, chipFg: P.ink };
const WHITE = P.paper;
const INK = P.ink;

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function mix(from: string, to: string, t: number): string {
  const [a, b] = [channels(from), channels(to)];
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Цвет, высветленный до читаемого на тёмной основе (4,5:1). */
function lift(color: string, base: string): string {
  let out = color;
  for (let k = 0.1; contrast(out, base) < 4.5 && k <= 1; k += 0.1) out = mix(color, WHITE, k);
  return out;
}

/** Насыщенность цвета — разброс каналов: у серого ноль. */
function chroma(hex: string): number {
  const c = channels(hex);
  return Math.max(...c) - Math.min(...c);
}

/**
 * Тон схемы — её самый насыщенный цвет (основа, кнопка, круг скидки): им
 * одежда окрашивает пятна, неон, пастель и акцент студии. Кнопка схемы
 * бывает белой, и одежда от неё вышла бы белой.
 */
function toneOf(c: SlideColors): string {
  const colors = [c.bg, c.btnBg, c.circleBg, c.circleFg].filter((color) => HEX.test(color));
  return colors.reduce((best, color) => (chroma(color) > chroma(best) ? color : best), colors[0] ?? P.fallback);
}

/** Цвет, затемнённый до нужного контраста с основой: акцент на белом (3:1) или надпись (4,5:1). */
function darkenTo(color: string, base: string, ratio: number): string {
  let out = color;
  for (let k = 0.1; contrast(out, base) < ratio && k <= 1; k += 0.1) out = mix(color, P.shade, k);
  return out;
}

/** Надпись на заливке: белая или чернильная — какая читается лучше. */
function inkOn(fill: string): string {
  return contrast(fill, WHITE) >= contrast(fill, INK) ? WHITE : INK;
}

/**
 * Цвета слайда в одежде. Схема продавца окрашивает одежду (`accent` — её
 * кнопка): в стекле, объёме, неоне и мягкой — пятна, свечение и капли;
 * в студии — только акцент; в лукбуке — тихая подложка. На тёмной основе
 * (объём, неон, ночь призмы) текст светлый, неоновый цвет высветлен.
 */
export function skinColors(skin: BannerSkin, alt: boolean, c: SlideColors, photo: boolean): SlideColors {
  const accent = toneOf(c);
  switch (skin) {
    case 'glass':
      return alt
        ? { ...c, ...CHIP_ON_DARK, bg: P.prismBg, paint: 'none', fg: P.prismFg, sub: P.prismSub, glow: `${accent}55` }
        : { ...c, paint: 'none', glow: `${accent}40` };
    case 'depth':
      return {
        ...c, ...CHIP_ON_DARK, bg: P.depthBg, fg: WHITE, sub: P.depthSub, glow: `${accent}4d`,
        paint: `linear-gradient(120deg, ${mix(accent, P.shade, 0.15)}d9, ${P.depthBg} 70%)`,
      };
    case 'neon': {
      const base = P.neonBg;
      const line = lift(accent, base);
      return {
        ...c, bg: base, paint: 'none', fg: P.neonFg, sub: P.neonSub, glow: `${line}33`,
        btnBg: 'transparent', btnFg: line, ...CHIP_ON_DARK, circleBg: base, circleFg: line,
        panel: P.neonPanel, stripe: line,
      };
    }
    case 'soft': {
      const bg = mix(accent, WHITE, alt ? 0.55 : 0.85);
      return { ...c, bg, paint: 'none', fg: P.softFg, sub: P.softSub, glow: `${accent}55`, panel: mix(accent, WHITE, 0.7),
        chipBg: P.chipSoft, chipFg: P.softFg };
    }
    case 'studio': {
      // Вспышка залита акцентом; под белым текстом — с запасом 5,5:1, чтобы читалась и метка на нём.
      const flood = inkOn(accent) === WHITE ? darkenTo(accent, WHITE, 5.5) : accent;
      return alt
        ? { ...c, ...(inkOn(flood) === WHITE ? CHIP_ON_DARK : CHIP_ON_LIGHT), bg: flood, paint: 'none', fg: inkOn(flood), sub: inkOn(flood), btnBg: inkOn(flood) === WHITE ? WHITE : INK, btnFg: inkOn(flood) === WHITE ? darkenTo(accent, WHITE, 4.5) : WHITE, glow: 'transparent' }
        : { ...c, ...CHIP_ON_LIGHT, bg: WHITE, paint: 'none', fg: INK, sub: P.studioSub, btnBg: darkenTo(accent, WHITE, 3), btnFg: inkOn(darkenTo(accent, WHITE, 3)), glow: 'transparent', panel: P.studioPanel };
    }
    case 'lookbook': {
      if (photo) return { ...c, ...CHIP_ON_DARK, bg: P.lookPhotoBg, paint: 'none', fg: WHITE, sub: P.lookPhotoSub, btnBg: 'transparent', btnFg: WHITE, glow: 'transparent' };
      const bg = alt ? P.seasonBg : WHITE;
      return { ...c, ...CHIP_ON_LIGHT, bg, paint: 'none', fg: P.shade, sub: P.lookSub, btnBg: 'transparent', btnFg: P.shade, glow: 'transparent', panel: alt ? P.seasonPanel : P.lookPanel };
    }
  }
}

/**
 * Задний слой одежды — под содержимым слайда, не ловит нажатий и не звучит
 * для программы чтения с экрана. Цвета — `--skin-c1` (кнопка схемы) и
 * `--skin-c2` (свечение), их ставит слайд.
 */
export function SkinLayer({ skin, alt }: { skin: BannerSkin; alt: boolean }) {
  return (
    <div aria-hidden="true" className="qo-skin-layer" data-skin-layer={skin} data-skin-alt={alt || undefined}>
      {skin === 'neon' ? <i className="qo-skin-horizon" /> : null}
      {skin === 'studio' ? <i className="qo-skin-spot" /> : null}
      {skin === 'glass' || skin === 'depth' || skin === 'soft' ? (
        <>
          <i className="qo-skin-blob qo-skin-blob-1" />
          <i className="qo-skin-blob qo-skin-blob-2" />
        </>
      ) : null}
      {skin === 'lookbook' ? <i className="qo-skin-shade" /> : null}
    </div>
  );
}

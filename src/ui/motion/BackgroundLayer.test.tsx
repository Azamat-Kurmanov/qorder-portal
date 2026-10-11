import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackgroundLayer, VEIL } from './BackgroundLayer';
import { PATTERN_CODES, patternMask } from './cabinetPatterns';

const photo = { url: 'https://drive.google.com/thumbnail?id=abc&sz=w2560', fit: 'COVER', veil: 'MEDIUM', blur: 'NONE', fixed: true } as const;

/** Относительная яркость sRGB по WCAG. */
function luminance([r, g, b]: number[]): number {
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const mix = (top: number[], bottom: number[], alpha: number) => top.map((c, i) => c * alpha + bottom[i] * (1 - alpha));

describe('слой фона кабинета', () => {
  it('без узора и фото — ничего', () => {
    const { container } = render(<BackgroundLayer pattern={null} photo={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('узор — маской отрасли', () => {
    const { container } = render(<BackgroundLayer pattern="FOOD" photo={null} />);
    const layer = container.querySelector('.qo-bg-pattern') as HTMLElement;
    expect(container.querySelector('[data-pattern="food"]')).not.toBeNull();
    expect(layer.style.getPropertyValue('--bg-pattern')).toBe(patternMask('FOOD'));
  });

  it('у каждой отрасли, сезона, праздника и события свой узор', () => {
    expect(PATTERN_CODES).toHaveLength(24);
    expect(new Set(PATTERN_CODES.map(patternMask)).size).toBe(24);
    expect(patternMask('UNKNOWN')).toBeNull();
  });

  it('фото проявляется после загрузки, вуаль по уровню приглушения', () => {
    const { container } = render(<BackgroundLayer pattern={null} photo={photo} />);
    const shown = container.querySelector('.qo-bg-photo') as HTMLElement;
    expect(shown.dataset.loaded).toBeUndefined();
    fireEvent.load(container.querySelector('img')!);
    expect(shown.dataset.loaded).toBe('true');
    expect(shown.style.getPropertyValue('--bg-photo')).toBe(`url("${photo.url}")`);
    expect((container.querySelector('.qo-bg-veil') as HTMLElement).style.opacity).toBe(String(VEIL.MEDIUM));
  });

  it('фото не загрузилось — слой снят, остаётся подложка', () => {
    const { container } = render(<BackgroundLayer pattern={null} photo={photo} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.firstChild).toBeNull();
  });

  it('едет со страницей — слой не фиксирован; настройки фото — атрибутами', () => {
    const { container } = render(
      <BackgroundLayer pattern={null} photo={{ ...photo, fixed: false, fit: 'TILE', blur: 'SOFT' }} />,
    );
    expect(container.querySelector('.qo-bg')!.hasAttribute('data-scroll')).toBe(true);
    const shown = container.querySelector('.qo-bg-photo') as HTMLElement;
    expect(shown.dataset.fit).toBe('tile');
    expect(shown.dataset.blur).toBe('soft');
  });

  it('среднее и сильное приглушение держат контраст текста 4,5:1 на любом фото', () => {
    const light = { canvas: [255, 255, 255], ink: [26, 26, 26] };
    const dark = { canvas: [17, 17, 17], ink: [238, 238, 238] };
    for (const veil of [VEIL.MEDIUM, VEIL.STRONG]) {
      for (const shot of [[0, 0, 0], [255, 255, 255]]) {
        for (const theme of [light, dark]) {
          expect(contrast(theme.ink, mix(theme.canvas, shot, veil))).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

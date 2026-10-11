import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import type { ShowcaseBannerDto } from '../../api/generated';
import { renderScreen } from '../../test/render';
import { BannerSlide } from './BannerSlide';
import { ART_TEMPLATES } from './bannerArt';
import { ART_MODE, SKINS, skinOf } from './bannerSkins';

// Встроенные шаблоны слайда и раскладки — расположение у всех одежд то же.
const TEMPLATES = ['SALE', 'NEW_ITEM', 'BULK', 'SPLIT', 'FULL_PHOTO', 'CENTERED', 'FLASH_SALE', 'PRICE_TAG', 'SEASON',
  'ANNOUNCEMENT', 'DELIVERY', 'GIFT', 'CIRCLE_PHOTO', 'MINIMAL', 'LAST_DAYS', 'STRIPE', 'BIG_TITLE', 'BUNDLE'];

const slide = (template: string) => ({
  id: 's1', visible: true, template, scheme: 'GRAPHITE', badge: 'До 30 сентября', title: 'Осенняя распродажа',
  text: 'Пуховики и тренчи', buttonText: 'Смотреть товары', discount: '−20%', discountNote: 'от 400 000 ₸', target: 'CATALOG',
}) as unknown as ShowcaseBannerDto;

describe('одежды баннеров', () => {
  it('тема ведёт на свою одежду; вторая тема направления — с оттенком', () => {
    expect(skinOf('GLOW')).toEqual({ skin: 'glass', alt: false });
    expect(skinOf('PRISM')).toEqual({ skin: 'glass', alt: true });
    expect(skinOf('NEON')).toEqual({ skin: 'neon', alt: false });
    expect(skinOf('SEASON')).toEqual({ skin: 'lookbook', alt: true });
    expect(skinOf('CLASSIC')).toBeNull();
    expect(skinOf(undefined)).toBeNull();
  });

  describe.each(SKINS)('одежда %s', (skin) => {
    it.each(TEMPLATES)('%s без фото — заголовок, кнопка и способ отрисовки мотива', (template) => {
      renderScreen(<BannerSlide slide={slide(template)} brand="#1F5C57" compact={false} hidden={false} onAction={() => {}} skin={skin} />);
      expect(screen.getAllByText('Осенняя распродажа').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Смотреть товары/ })).toBeInTheDocument();
      const root = document.querySelector('.qo-banner')!;
      expect(root).toHaveAttribute('data-skin', skin);
      expect(root).toHaveAttribute('data-art-mode', ART_MODE[skin]);
      if (ART_TEMPLATES.includes(template)) expect(root.querySelector('[data-art]')).not.toBeNull();
    });
  });

  it('без темы — слайд как прежде, без одежды', () => {
    renderScreen(<BannerSlide slide={slide('SALE')} brand="#1F5C57" compact={false} hidden={false} onAction={() => {}} />);
    expect(document.querySelector('.qo-banner')).not.toHaveAttribute('data-skin');
  });

  it.each(['bannerSkins.tsx', 'bannerSkins.css', 'bannerArt.tsx'])('%s одинаков в портале и в кабинете продавца', (file) => {
    const portal = readFileSync(resolve(process.cwd(), 'src/features/banners', file), 'utf8');
    const front = readFileSync(resolve(process.cwd(), '../front/src/features/banners', file), 'utf8');
    expect(front).toBe(portal);
  });
});

describe('скидка на баннере досчитывается', () => {
  it('«живо» — от нуля до своего числа', async () => {
    const { act } = await import('@testing-library/react');
    const { vi } = await import('vitest');
    const { MotionLevelContext } = await import('../../ui/motion/motionLevel');
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      renderScreen(
        <MotionLevelContext.Provider value="lively">
          <BannerSlide slide={slide('SALE')} brand="#1F5C57" compact={false} hidden={false} onAction={() => {}} skin="glass" />
        </MotionLevelContext.Provider>,
      );
      const value = () => document.querySelector('[data-discount]')!.textContent;
      act(() => { vi.advanceTimersByTime(150); });
      expect(value()).not.toBe('−20%');
      act(() => { vi.advanceTimersByTime(600); });
      expect(value()).toBe('−20%');
    } finally {
      vi.useRealTimers();
    }
  });

  it('«спокойно» — сразу своё число', () => {
    renderScreen(<BannerSlide slide={slide('SALE')} brand="#1F5C57" compact={false} hidden={false} onAction={() => {}} skin="glass" />);
    expect(document.querySelector('[data-discount]')!.textContent).toBe('−20%');
  });
});

describe('в любой одежде и схеме текст и кнопка читаются', async () => {
  const { slideColors } = await import('./bannerTheme');
  const { skinColors } = await import('./bannerSkins');
  const palette = (await import('./bannerPalette.json')).default as { schemes: Record<string, unknown> };
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const hex = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value);
  // Полупрозрачный цвет палитры («rgba(255,255,255,.14)») — наложенный на основу слайда.
  const solid = (color: string, under: string) => {
    const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(color.replace(/\s/g, ''));
    if (!m || !hex(under)) return color;
    const a = Number(m[4]);
    const base = [1, 3, 5].map((i) => parseInt(under.slice(i, i + 2), 16));
    return `#${[m[1], m[2], m[3]].map((v, i) => Math.round(Number(v) * a + base[i] * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
  };
  const cases = SKINS.flatMap((skin) => [false, true].flatMap((alt) =>
    Object.keys(palette.schemes).map((scheme) => [skin, alt, scheme] as const)));

  it.each(cases)('%s (оттенок %s), схема %s', (skin, alt, scheme) => {
    const c = skinColors(skin, alt, slideColors(scheme as never, '#1F5C57'), false);
    if (hex(c.bg)) expect(ratio(c.fg, c.bg), 'заголовок').toBeGreaterThanOrEqual(4.5);
    // Прозрачная кнопка (неон, лукбук) читается на основе слайда, залитая — на своей заливке.
    const under = c.btnBg === 'transparent' ? c.bg : c.btnBg;
    if (hex(under) && hex(c.btnFg)) expect(ratio(c.btnFg, under), 'кнопка').toBeGreaterThanOrEqual(4.5);
    if (hex(c.btnBg) && hex(c.bg) && skin === 'studio') expect(ratio(c.btnBg, c.bg), 'кнопка видна на основе').toBeGreaterThan(1.5);
    // Метка (срок, «Новинка»): текст читается на своей подложке, наложенной на основу слайда.
    const chip = solid(c.chipBg, c.bg);
    if (hex(chip) && hex(c.chipFg)) expect(ratio(c.chipFg, chip), 'метка').toBeGreaterThanOrEqual(4.5);
  });
});

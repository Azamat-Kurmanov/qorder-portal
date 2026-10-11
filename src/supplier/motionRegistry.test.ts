import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import registry from './cabinetTemplates.json';
import { MOTION_TEMPLATES, motionTemplateOf } from './cabinetDesign';
import { CabinetDesignDtoTemplate } from '../api/generated';

const CODES = ['GLOW', 'PRISM', 'DEPTH', 'FLOAT', 'NEON', 'PULSE', 'BLOBS', 'JELLY', 'STUDIO', 'FLASH', 'LOOKBOOK', 'SEASON'];
const BACKDROPS = ['GLOW', 'SHIMMER', 'HORIZON', 'PARTICLES', 'BLOBS', 'SPOTLIGHT', 'SCROLLTINT', 'NONE'];

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('реестр живых тем', () => {
  it('12 живых тем в шести направлениях, коды — из перечисления сервера', () => {
    expect(MOTION_TEMPLATES.map((t) => t.id)).toEqual(CODES);
    const server = Object.keys(CabinetDesignDtoTemplate);
    expect(CODES.every((code) => server.includes(code))).toBe(true);
    const skins = new Set(MOTION_TEMPLATES.map((t) => t.style.bannerSkin));
    expect(skins.size).toBe(6);
  });

  it('каждый старый код ведёт ровно на одну из 12 тем', () => {
    const server = Object.keys(CabinetDesignDtoTemplate).filter((code) => !CODES.includes(code));
    expect(server).toHaveLength(40);
    for (const code of server) expect(CODES).toContain((registry.motionAliases as Record<string, string>)[code]);
    expect(motionTemplateOf('CLASSIC').id).toBe('GLOW');
    expect(motionTemplateOf('BOUTIQUE').id).toBe('LOOKBOOK');
    expect(motionTemplateOf('НЕТ ТАКОГО').id).toBe('GLOW');
  });

  it('живой фон и движение по умолчанию — из допустимых значений', () => {
    for (const t of MOTION_TEMPLATES) {
      expect(BACKDROPS).toContain(t.style.backdrop);
      expect(['CALM', 'LIVELY', 'VIVID']).toContain(t.style.motion);
    }
  });

  it('текст читается в обеих палитрах каждой темы', () => {
    for (const t of MOTION_TEMPLATES) {
      for (const p of [t.palette.light, t.palette.dark]) {
        expect(contrast(p.ink, p.canvas), t.id).toBeGreaterThanOrEqual(7);
        expect(contrast(p.muted, p.surface), t.id).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.muted, p.canvas), t.id).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('файл реестра одинаков в портале и в кабинете продавца', () => {
    const portal = readFileSync(resolve(process.cwd(), 'src/supplier/cabinetTemplates.json'), 'utf8');
    const front = readFileSync(resolve(process.cwd(), '../front/src/features/cabinetDesign/cabinetTemplates.json'), 'utf8');
    expect(front).toBe(portal);
  });
});

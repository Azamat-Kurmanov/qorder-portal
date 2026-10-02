import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOT_STYLE_ID, DESIGN_CSS_KEY, dropBootDesign, rememberDesignCss } from './designBoot';

describe('оформление магазина до первого кадра', () => {
  /** Скрипт в index.html знает ключ и id наизусть — разойтись им нельзя. */
  it('index.html читает тот же ключ и ставит тот же элемент', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain(`'${DESIGN_CSS_KEY}'`);
    expect(html).toContain(`'${BOOT_STYLE_ID}'`);
  });

  it('запоминает оформление и забывает его у магазина без дизайна', () => {
    rememberDesignCss(':root{--color-accent:#b0413e}');
    expect(localStorage.getItem(DESIGN_CSS_KEY)).toBe(':root{--color-accent:#b0413e}');
    rememberDesignCss(null);
    expect(localStorage.getItem(DESIGN_CSS_KEY)).toBeNull();
  });

  it('стартовая копия убирается, когда пришло настоящее оформление', () => {
    const style = document.createElement('style');
    style.id = BOOT_STYLE_ID;
    document.head.appendChild(style);
    dropBootDesign();
    expect(document.getElementById(BOOT_STYLE_ID)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { confetti, shouldCelebrate } from './confetti';

describe('конфетти при отправке заявки', () => {
  it('только «ярко» и только у Капель и Леденца', () => {
    expect(shouldCelebrate('vivid', 'BLOBS')).toBe(true);
    expect(shouldCelebrate('vivid', 'JELLY')).toBe(true);
    expect(shouldCelebrate('lively', 'BLOBS')).toBe(false);
    expect(shouldCelebrate('calm', 'JELLY')).toBe(false);
    expect(shouldCelebrate('vivid', 'NEON')).toBe(false);
    expect(shouldCelebrate('vivid', undefined)).toBe(false);
  });

  it('без 2D-холста (jsdom) — ничего не ломается и не остаётся на странице', async () => {
    await confetti();
    expect(document.querySelector('canvas')).toBeNull();
  });
});

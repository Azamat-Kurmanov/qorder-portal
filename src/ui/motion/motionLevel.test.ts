import { describe, expect, it } from 'vitest';
import { motionLevel, type MotionEnv } from './motionLevel';

const free: MotionEnv = { reduce: false, saveData: false, deviceMemory: 8, path: '/catalog' };

describe('итоговый уровень движения', () => {
  it('без ограничений — как выбрал продавец', () => {
    expect(motionLevel('CALM', free)).toBe('calm');
    expect(motionLevel('LIVELY', free)).toBe('lively');
    expect(motionLevel('VIVID', free)).toBe('vivid');
  });

  it('«уменьшить движение» в системе — всегда спокойно', () => {
    for (const choice of ['CALM', 'LIVELY', 'VIVID'] as const) {
      expect(motionLevel(choice, { ...free, reduce: true })).toBe('calm');
    }
  });

  it('экономия трафика и слабое устройство — не выше «живо»', () => {
    expect(motionLevel('VIVID', { ...free, saveData: true })).toBe('lively');
    expect(motionLevel('VIVID', { ...free, deviceMemory: 4 })).toBe('lively');
    expect(motionLevel('VIVID', { ...free, deviceMemory: 2 })).toBe('lively');
    expect(motionLevel('CALM', { ...free, saveData: true })).toBe('calm');
    // Браузер, не сообщающий память, слабым не считается.
    expect(motionLevel('VIVID', { ...free, deviceMemory: undefined })).toBe('vivid');
  });

  it('там, где считают деньги, — не выше «живо»', () => {
    for (const path of ['/cart', '/checkout', '/orders', '/orders/42']) {
      expect(motionLevel('VIVID', { ...free, path }), path).toBe('lively');
    }
    // Похожее начало адреса — не страница денег.
    expect(motionLevel('VIVID', { ...free, path: '/ordersheet' })).toBe('vivid');
  });
});

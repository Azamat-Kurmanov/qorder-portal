import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MotionLevelContext, type MotionLevel } from './motionLevel';
import { useCountUp } from './useCountUp';

const at = (level: MotionLevel) => ({ children }: { children: ReactNode }) =>
  <MotionLevelContext.Provider value={level}>{children}</MotionLevelContext.Provider>;

describe('плавная смена суммы', () => {
  afterEach(() => vi.useRealTimers());

  it('«спокойно» — новое число сразу', () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v), { initialProps: { v: 100 }, wrapper: at('calm') });
    rerender({ v: 500 });
    expect(result.current).toBe(500);
  });

  it('«живо» — досчитывает до нового числа и останавливается на нём', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, 400), { initialProps: { v: 100 }, wrapper: at('lively') });
    expect(result.current).toBe(100);
    rerender({ v: 500 });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBeGreaterThan(100);
    expect(result.current).toBeLessThan(500);
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe(500);
  });
});

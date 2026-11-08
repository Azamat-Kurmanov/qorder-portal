import { beforeEach, describe, expect, it, vi } from 'vitest';

const countShareCart = vi.fn(() => Promise.resolve());
vi.mock('../../api/generated', () => ({ countShareCart: (...a: unknown[]) => countShareCart(...(a as [])) }));

const { rememberShareVisit, reportShareCart } = await import('./shareVisit');

beforeEach(() => {
  sessionStorage.clear();
  countShareCart.mockClear();
});

describe('визит по ссылке «Поделиться»', () => {
  it('первое добавление в корзину после перехода — в счёт, второе — нет', () => {
    rememberShareVisit('abc', 'i');
    reportShareCart();
    reportShareCart();
    expect(countShareCart).toHaveBeenCalledTimes(1);
    expect(countShareCart).toHaveBeenCalledWith('abc', 'i');
  });

  it('без перехода по ссылке ничего не считается', () => {
    reportShareCart();
    expect(countShareCart).not.toHaveBeenCalled();
  });
});

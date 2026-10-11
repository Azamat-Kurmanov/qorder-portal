import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderScreen } from '../../test/render';
import { ScrollJumps } from './ScrollJumps';

/** Страница высотой 3000 точек в окне 800, отлистанная до `y`. */
function page(y: number) {
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 3000 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
}

describe('стрелки вверх и вниз', () => {
  afterEach(() => vi.restoreAllMocks());

  it('в начале страницы — только «вниз»; она прыгает в самый низ сразу', () => {
    page(0);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderScreen(<ScrollJumps content={{ current: document.body }} />);
    expect(screen.queryByRole('button', { name: 'Наверх' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Вниз страницы' }));
    expect(scroll).toHaveBeenCalledWith({ top: 3000, behavior: 'instant' });
  });

  it('в середине — обе; «наверх» прыгает в самое начало', () => {
    page(0);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderScreen(<ScrollJumps content={{ current: document.body }} />);
    page(1000);
    act(() => { window.dispatchEvent(new Event('scroll')); });
    expect(screen.getByRole('button', { name: 'Вниз страницы' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Наверх' }));
    expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it('в самом низу — только «наверх»', () => {
    page(2200);
    renderScreen(<ScrollJumps content={{ current: document.body }} />);
    expect(screen.getByRole('button', { name: 'Наверх' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Вниз страницы' })).toBeNull();
  });
});

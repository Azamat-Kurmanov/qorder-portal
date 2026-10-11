import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Backdrop } from './Backdrop';

const layer = () => document.querySelector('.qo-backdrop');

describe('живой фон', () => {
  it('«Ровный» — слоя нет', () => {
    render(<Backdrop code="NONE" level="vivid" />);
    expect(layer()).toBeNull();
  });

  it('слой за содержимым: скрыт от чтения с экрана, вид — по коду', () => {
    render(<Backdrop code="HORIZON" level="lively" />);
    expect(layer()).toHaveAttribute('aria-hidden', 'true');
    expect(layer()).toHaveAttribute('data-backdrop', 'horizon');
  });

  it('частицы — холстом только при «ярко», иначе без холста', async () => {
    const { rerender } = render(<Backdrop code="PARTICLES" level="lively" />);
    expect(document.querySelector('canvas')).toBeNull();
    rerender(<Backdrop code="PARTICLES" level="vivid" />);
    await act(async () => { await import('./Particles'); });
    expect(document.querySelector('canvas')).not.toBeNull();
  });

  it('вкладка в фоне — фон на паузе', () => {
    render(<Backdrop code="GLOW" level="vivid" />);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(layer()).toHaveAttribute('data-paused');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(layer()).not.toHaveAttribute('data-paused');
  });
});

describe('живой фон Сезона', () => {
  it('перетекание у Сезона — полосами его цветов', () => {
    render(<Backdrop code="SCROLLTINT" level="lively" season />);
    expect(document.querySelector('.qo-backdrop')).toHaveAttribute('data-season');
  });

  it('у других тем — цветом магазина', () => {
    render(<Backdrop code="SCROLLTINT" level="lively" />);
    expect(document.querySelector('.qo-backdrop')).not.toHaveAttribute('data-season');
  });
});

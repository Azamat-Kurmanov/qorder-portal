import { afterEach, describe, expect, it, vi } from 'vitest';
import { CART_TARGET, flyToCart } from '../flyToCart';

function place(html: string) {
  document.body.innerHTML = html;
  for (const element of document.querySelectorAll('*')) {
    element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 40, height: 40 }) as DOMRect;
    element.getClientRects = () => [{}] as unknown as DOMRectList;
  }
}

describe('полёт в корзину по уровню движения', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

  it('«спокойно» — копия не летит', () => {
    place(`<div data-motion="calm"><img id="shot"><span ${CART_TARGET}></span></div>`);
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate;
    flyToCart(document.getElementById('shot'));
    expect(animate).not.toHaveBeenCalled();
  });

  it('«живо» — летит', () => {
    place(`<div data-motion="lively"><img id="shot"><span ${CART_TARGET}></span></div>`);
    const animate = vi.fn(() => ({}) as Animation);
    HTMLElement.prototype.animate = animate;
    flyToCart(document.getElementById('shot'));
    expect(animate).toHaveBeenCalledTimes(1);
  });
});

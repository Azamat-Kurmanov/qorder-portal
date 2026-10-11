import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachPointerFx } from './pointerFx';

function setup() {
  document.body.innerHTML = '<div id="root"><article data-fx id="card"><span id="inside"></span></article><p id="other"></p></div>';
  const card = document.getElementById('card')!;
  card.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 100 }) as DOMRect;
  return { root: document.getElementById('root')!, card };
}

const move = (target: Element, x: number, y: number) =>
  target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));

describe('эффекты под курсором', () => {
  beforeEach(() => vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => { run(0); return 1; }));
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  it('над карточкой — место курсора и наклон в её переменных', () => {
    const { root, card } = setup();
    attachPointerFx(root, () => true);
    move(document.getElementById('inside')!, 300, 50);
    expect(card.style.getPropertyValue('--px')).toBe('200px');
    expect(card.style.getPropertyValue('--py')).toBe('0px');
    expect(card.style.getPropertyValue('--rx')).toBe('6');
    expect(card.style.getPropertyValue('--ry')).toBe('6');
    expect(card).toHaveAttribute('data-fx-on');
  });

  it('курсор ушёл с карточки — эффект снят', () => {
    const { root, card } = setup();
    attachPointerFx(root, () => true);
    move(card, 200, 100);
    move(document.getElementById('other')!, 0, 0);
    expect(card).not.toHaveAttribute('data-fx-on');
  });

  it('не «ярко» или палец — ничего не происходит', () => {
    const { root, card } = setup();
    attachPointerFx(root, () => false);
    move(card, 200, 100);
    expect(card).not.toHaveAttribute('data-fx-on');
    expect(card.style.getPropertyValue('--px')).toBe('');
  });

  it('отключение снимает слушатель', () => {
    const { root, card } = setup();
    const detach = attachPointerFx(root, () => true);
    detach();
    move(card, 200, 100);
    expect(card).not.toHaveAttribute('data-fx-on');
  });
});

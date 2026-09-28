import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ItemThumb } from '../features/catalog/ItemThumb';
import { LineThumb } from '../features/cart/LineThumb';

/** Цвета градиента из атрибута style — без различий в записи процентов. */
function colours(element: HTMLElement): string[] {
  return (element.getAttribute('style') ?? '').match(/#[0-9A-Fa-f]{6}|rgb\([^)]+\)/g) ?? [];
}

/**
 * Один товар без снимка выглядит одинаково на витрине и в корзине:
 * по пятну человек узнаёт позицию, и в двух местах оно обязано совпадать.
 */
describe('заполнитель снимка', () => {
  it.each(['item-1', 'item-2', '3f1c2a9e-7b1d-4c11-9a51-0c2b8f7e9d10', 'x'])(
    'у позиции %s на витрине и в корзине одни и те же цвета',
    (id) => {
      render(
        <MemoryRouter>
          <ItemThumb itemId={id} />
          <LineThumb seed={id} />
        </MemoryRouter>,
      );
      const tile = colours(screen.getByTestId('item-thumb'));
      expect(tile).toHaveLength(2);
      expect(colours(screen.getByTestId('line-thumb'))).toEqual(tile);
    },
  );
});

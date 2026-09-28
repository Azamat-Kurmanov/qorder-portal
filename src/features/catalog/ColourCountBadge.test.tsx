import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import type { ShowcaseItemDto } from '../../api/generated';
import { ItemTile } from './CatalogPage';
import { renderScreen } from '../../test/render';

const ITEM: ShowcaseItemDto = {
  id: 'item-1',
  name: 'Футболка',
  unit: 'шт',
  price: 5000,
  favorite: false,
  terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 1, quantityStep: 1 },
} as ShowcaseItemDto;

/**
 * Метка «N цвета» на фото карточки: число приходит с сервера, а плюрализация
 * и порог «от двух» — дело карточки.
 */
describe('метка цветов на карточке каталога', () => {
  it('показывает число цветов с верной формой слова', () => {
    const { unmount } = renderScreen(<ItemTile item={{ ...ITEM, colorCount: 4 }} taken={new Set()} roomy />);
    expect(screen.getByTestId('colour-count')).toHaveTextContent('4 цвета');
    unmount();

    renderScreen(<ItemTile item={{ ...ITEM, colorCount: 5 }} taken={new Set()} roomy />);
    expect(screen.getByTestId('colour-count')).toHaveTextContent('5 цветов');
  });

  it('без вариантов по цвету метки нет', () => {
    const { unmount } = renderScreen(<ItemTile item={ITEM} taken={new Set()} roomy />);
    expect(screen.queryByTestId('colour-count')).toBeNull();
    unmount();

    renderScreen(<ItemTile item={{ ...ITEM, colorCount: 1 }} taken={new Set()} roomy />);
    expect(screen.queryByTestId('colour-count')).toBeNull();
  });
});

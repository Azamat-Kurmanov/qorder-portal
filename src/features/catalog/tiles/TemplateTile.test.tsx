import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { ShowcaseItemDto } from '../../../api/generated';
import type { MotionStyle } from '../../../supplier/cabinetDesign';
import { renderScreen } from '../../../test/render';
import { TemplateTile } from './TemplateTile';

const TILES: MotionStyle['tile'][] = ['glass', 'tilt', 'float', 'glow', 'jelly', 'outline', 'swap', 'plain'];
// Плитки, у которых есть эффект под курсором: свечение или наклон.
const WITH_FX = ['glass', 'tilt', 'glow'];

// Самая бедная позиция: ни снимка, ни цены — плитка всё равно законченная.
const BARE = { id: 'item-1', name: 'Цемент М400', unit: 'мешок', available: true } as unknown as ShowcaseItemDto;

describe('восемь плиток живых тем', () => {
  it.each(TILES)('«%s»: имя ссылкой и «В корзину» у позиции без снимка и цены', (tile) => {
    renderScreen(<TemplateTile item={BARE} taken={new Set()} tile={tile} price="plain" />);

    const card = screen.getByTestId('item-tile');
    expect(card).toHaveAttribute('data-tile', tile);
    expect(within(card).getByRole('link', { name: 'Цемент М400' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /В корзину|Добавить/ })).toBeInTheDocument();
    if (WITH_FX.includes(tile)) expect(card).toHaveAttribute('data-fx');
    else expect(card).not.toHaveAttribute('data-fx');
  });
});

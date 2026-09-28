import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { ItemFacts } from './itemParts';
import { renderScreen } from '../../test/render';

describe('условия продажи плашками', () => {
  it('длинная фраза переносится внутри плашки: высота не зажата', () => {
    renderScreen(
      <ItemFacts item={{ unit: 'бутылка', terms: { hit: false, novelty: false, ageRestricted: true } }} pills />,
    );

    const pill = screen.getByText(/Продаём с 21 года/);
    expect(pill).not.toHaveClass('h-[34px]');
    expect(pill).toHaveClass('min-h-[34px]', 'py-1.5', 'leading-[1.3]');
  });
});

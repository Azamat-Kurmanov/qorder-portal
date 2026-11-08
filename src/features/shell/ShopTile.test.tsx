import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderScreen } from '../../test/render';
import { ShopTile } from './ShopTile';

describe('знак магазина', () => {
  it('логотип не загрузился — вместо битой картинки буквы магазина', () => {
    renderScreen(<ShopTile supplier={{ name: 'ИП "Мухамедиева"', logoUrl: 'https://example.com/logo.png' }} alt="Логотип" initials />);
    fireEvent.error(screen.getByRole('img', { name: 'Логотип' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('ИМ')).toBeInTheDocument();
  });

  /** Буква на чужом цвете: надпись по цвету этого магазина, а не по `on-brand` открытого. */
  it('буква читается на светлом и на тёмном цвете магазина', () => {
    renderScreen(<>
      <ShopTile supplier={{ name: 'Жёлтый', brandColor: '#FFC629' }} />
      <ShopTile supplier={{ name: 'Синий', brandColor: '#0038FF' }} />
    </>);
    expect(screen.getByText('Ж')).toHaveStyle({ color: '#1A1917' });
    expect(screen.getByText('С')).toHaveStyle({ color: '#FFFFFF' });
  });
});

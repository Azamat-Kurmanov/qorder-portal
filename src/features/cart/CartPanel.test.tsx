import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { CartPanel } from './CartPanel';
import { closeCart, openCart } from './cartDrawer';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const cart = {
  lines: [{
    itemId: 'item-1', name: 'Цемент М400', quantity: 2, unit: 'мешок',
    priceAtAdding: 2500, price: 2500, priceChanged: false, total: 5000,
  }],
  total: 5000,
  goodsTotal: 5000,
  skipped: [],
  vatPayer: true,
};

/**
 * Корзина на телефоне — нижним листом, как в макете «Карточка товара
 * (телефон)»: до 85% высоты, с ручкой сверху и заголовком «Корзина» 16px.
 * С `sm` — прежняя выдвижная панель справа.
 */
describe('корзина на телефоне — нижний лист', () => {
  afterEach(() => {
    act(() => closeCart());
    vi.unstubAllGlobals();
  });

  it('лист снизу до 85% высоты, с ручкой и заголовком 16px', async () => {
    stubFetch([
      get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'СтройБаза' }]),
      get('/api/portal/cart', cart),
    ]);
    renderScreen(<CartPanel />);
    act(() => openCart());

    const sheet = await screen.findByTestId('cart-panel');
    expect(sheet).toHaveClass('bottom-0', 'max-h-[85dvh]', 'rounded-t-[24px]');
    // Выше телефона — прежняя панель справа во всю высоту.
    expect(sheet).toHaveClass('sm:inset-y-3', 'sm:max-h-none');
    const handle = within(sheet).getByTestId('sheet-handle');
    expect(handle).toHaveAttribute('aria-hidden', 'true');
    expect(handle).toHaveClass('sm:hidden');
    const title = within(sheet).getByRole('heading', { name: 'Корзина' });
    expect(title).toHaveClass('text-base', 'sm:text-[1.625rem]');
    expect(await within(sheet).findByText('Цемент М400')).toBeInTheDocument();
  });
});

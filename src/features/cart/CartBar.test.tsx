import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import i18n from '../../i18n';
import { CartBar } from './CartBar';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const cart = {
  lines: [{
    itemId: 'item-1', name: 'Cement M400', quantity: 2, unit: 'bag',
    priceAtAdding: 2500, price: 2500, priceChanged: false, total: 5000,
  }],
  total: 5000,
  skipped: [],
};

describe('полоса корзины на телефоне', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await i18n.changeLanguage('ru');
  });

  it('одна строка — сколько позиций и на какую сумму, ведёт в корзину', async () => {
    stubFetch([get('/api/portal/cart', cart)]);

    renderScreen(<CartBar />);
    const bar = await screen.findByTestId('cart-bar');
    expect(bar).toHaveAttribute('href', '/checkout');
    expect(bar).toHaveTextContent(/1 позиция ·\s5\s000/);
    expect(bar).toHaveTextContent('Корзина');
  });

  it('пустая корзина — полосы нет', async () => {
    stubFetch([get('/api/portal/cart', { lines: [], total: 0, skipped: [] })]);

    renderScreen(<CartBar />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByTestId('cart-bar')).toBeNull();
  });
});

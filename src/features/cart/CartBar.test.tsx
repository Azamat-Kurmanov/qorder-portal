import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { resetCartDrawer, useCartDrawer } from './cartDrawer';
import { renderHook } from '@testing-library/react';
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

function useCartDrawerState() {
  return renderHook(() => useCartDrawer()).result.current;
}

describe('полоса корзины на телефоне', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    resetCartDrawer();
    await i18n.changeLanguage('ru');
  });

  it('кнопка с суммой открывает полноценную корзину, а не свой отдельный лист', async () => {
    stubFetch([get('/api/portal/cart', cart)]);

    renderScreen(<CartBar />);
    expect(useCartDrawerState().open).toBe(false);
    await userEvent.click(await screen.findByRole('button', { name: /в корзине/i }));

    expect(useCartDrawerState().open).toBe(true);
    // Собственного листа у полосы больше нет: корзину рисует оболочка (CartPanel).
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('кнопка с суммой говорит, что откроет лист, а не уведёт на другой экран', async () => {
    stubFetch([get('/api/portal/cart', cart)]);

    renderScreen(<CartBar />);
    const open = await screen.findByRole('button', { name: /в корзине/i });
    expect(open).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByRole('button', { name: /Оформить/ })).not.toHaveAttribute('aria-haspopup');
  });
});

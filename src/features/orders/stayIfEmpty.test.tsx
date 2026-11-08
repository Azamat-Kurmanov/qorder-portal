import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepeatOrderButton } from './RepeatOrderButton';
import { method, stubFetch } from '../../test/http';
import { renderScreen } from '../../test/render';

describe('повтор, после которого корзина пуста', () => {
  it('остаёмся на месте и называем причину', async () => {
    stubFetch([
      method('POST', '/api/portal/cart/from-last-order', {
        lines: [], skipped: [{ name: 'абрикосы спелые, 10 кг', reason: 'Этого товара нет в каталоге магазина' }],
      }),
    ]);
    renderScreen(<RepeatOrderButton />);

    await userEvent.click(screen.getByRole('button', { name: /повторить прошлый заказ/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('абрикосы спелые, 10 кг — Этого товара нет в каталоге магазина');
    expect(window.location.pathname).not.toBe('/checkout');
  });
});

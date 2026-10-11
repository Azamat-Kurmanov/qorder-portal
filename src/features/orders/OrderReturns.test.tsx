import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { OrderPage } from './OrderPage';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const issued = {
  id: 'order-7', state: 'ISSUED', needsAnswer: false, cancellable: false, currency: 'KZT',
  createdAt: '2026-09-01T10:00:00Z', issuedAt: '2026-09-03T10:00:00Z', total: 12500,
  submitted: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2500, amount: 12500 }],
};

function openOrder() {
  renderScreen(
    <Routes>
      <Route path="/orders/:id" element={<OrderPage />} />
    </Routes>,
    { route: '/orders/order-7' },
  );
}

describe('возврат в карточке заказа', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('показывает возврат: строки, сумму и что деньги ещё не вернули', async () => {
    stubFetch([
      get('/api/portal/orders/order-7/returns', [{
        returnNo: 1, createdAt: '2026-09-05T10:00:00Z', refundAmount: 5000, refunded: false,
        lines: [{ name: 'Цемент М400', quantity: 2, unit: 'мешок' }],
      }]),
      get('/api/portal/orders/order-7', issued),
    ]);
    openOrder();
    const block = await screen.findByRole('region', { name: 'Возврат 1' });
    expect(block).toHaveTextContent('2 мешка · Цемент М400');
    expect(block).toHaveTextContent(/К возврату: 5\s?000/);
    expect(block).toHaveTextContent('Деньги ещё не возвращены');
  });

  it('деньги вернули — дата', async () => {
    stubFetch([
      get('/api/portal/orders/order-7/returns', [{
        returnNo: 1, createdAt: '2026-09-05T10:00:00Z', refundAmount: 5000, refunded: true, refundedAt: '2026-09-06T10:00:00Z',
        lines: [{ name: 'Цемент М400', quantity: 2, unit: 'мешок' }],
      }]),
      get('/api/portal/orders/order-7', issued),
    ]);
    openOrder();
    expect(await screen.findByRole('region', { name: 'Возврат 1' })).toHaveTextContent(/Деньги возвращены 6/);
  });

  it('без возвратов блока нет', async () => {
    stubFetch([get('/api/portal/orders/order-7/returns', []), get('/api/portal/orders/order-7', issued)]);
    openOrder();
    await screen.findByTestId('submitted');
    expect(screen.queryByRole('region', { name: /Возврат/ })).not.toBeInTheDocument();
  });
});

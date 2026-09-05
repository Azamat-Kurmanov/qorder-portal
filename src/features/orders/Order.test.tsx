import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { OrderPage } from './OrderPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const renegotiated = {
  id: 'order-1',
  state: 'AWAITING_CONFIRMATION',
  needsAnswer: true,
  cancellable: true,
  createdAt: '2026-09-01T10:00:00Z',
  total: 12500,
  submitted: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2500, amount: 12500 }],
  proposed: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2700, amount: 13500 }],
  proposedTotal: 13500,
  diff: [{ kind: 'PRICE_CHANGED', name: 'Цемент М400', was: 2500, now: 2700 }],
};

function openOrder() {
  renderScreen(
    <Routes>
      <Route path="/orders/:id" element={<OrderPage />} />
    </Routes>,
    { route: '/orders/order-1' },
  );
}

/**
 * Пересогласование глазами клиента.
 *
 * Главное здесь — две редакции рядом и названное отличие: подтверждение
 * относится к предложенному составу, и согласиться вслепую человек не должен.
 */
describe('заявка на пересогласовании', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('показывает обе редакции и что именно изменилось', async () => {
    stubFetch([get('/api/portal/orders/order-1', renegotiated)]);

    openOrder();

    expect(await screen.findByText('Вы отправляли')).toBeInTheDocument();
    // Полное совпадение, а не вхождение: те же слова стоят в заголовке
    // предупреждения о правках, и вхождение нашло бы оба.
    expect(screen.getByText('Поставщик предлагает')).toBeInTheDocument();
    expect(within(screen.getByTestId('submitted')).getByText('12 500 ₸')).toBeInTheDocument();
    expect(within(screen.getByTestId('proposed')).getByText('13 500 ₸')).toBeInTheDocument();
    expect(screen.getByTestId('diff')).toHaveTextContent('цена 2 500 ₸ → 2 700 ₸');
  });

  it('ответ уходит кнопкой', async () => {
    const { calls } = stubFetch([
      get('/api/portal/orders/order-1', renegotiated),
      method('POST', '/api/portal/orders/order-1/confirm', {
        ...renegotiated, state: 'ACCEPTED', needsAnswer: false, cancellable: false,
      }),
    ]);

    openOrder();

    // Кнопка названа вместе с заявкой: действие необратимо, и «Согласен»
    // само по себе не говорит, с чем именно.
    await userEvent.click(
      await screen.findByRole('button', { name: /согласен с изменениями в заявке/i }),
    );

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/confirm'))).toBe(true);
    });
    expect(await screen.findByText(/ответ отправлен/i)).toBeInTheDocument();
  });

  /** Пока поставщик ничего не предложил, отвечать нечего — можно только отменить. */
  it('без предложения показывает один состав и отмену', async () => {
    stubFetch([get('/api/portal/orders/order-1', {
      ...renegotiated,
      state: 'IN_REVIEW',
      needsAnswer: false,
      proposed: undefined,
      proposedTotal: undefined,
      diff: [],
    })]);

    openOrder();

    expect(await screen.findByText(/состав заявки/i)).toBeInTheDocument();
    expect(screen.queryByTestId('proposed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^согласен/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /отменить заявку/i })).toBeInTheDocument();
  });

  /** Принятую заявку отменять нечем: заказ мог уйти в учётную систему. */
  it('у принятой заявки отмены нет', async () => {
    stubFetch([get('/api/portal/orders/order-1', {
      ...renegotiated,
      state: 'ACCEPTED',
      needsAnswer: false,
      cancellable: false,
      proposed: undefined,
      diff: [],
    })]);

    openOrder();

    expect(await screen.findByText(/принята/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /отменить заявку/i })).not.toBeInTheDocument();
  });
});

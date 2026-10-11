import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FirstSteps } from './FirstSteps';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const CART = { lines: [], total: 0, skipped: [], goodsTotal: 0, saleSavings: 0, ageConfirmed: false };

function stub(lines: number, orders: { state: string }[]) {
  stubFetch([
    get('/api/portal/cart', { ...CART, lines: Array.from({ length: lines }, (_, i) => ({ itemId: `i${i}` })) }),
    get('/api/portal/orders', orders.map((order, i) => ({ id: `o${i}`, ...order }))),
  ]);
}

describe('«Как сделать первый заказ» у покупателя', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('новичку — три шага, ни один не отмечен', async () => {
    stub(0, []);
    renderScreen(<FirstSteps active />);
    expect(await screen.findByRole('region', { name: 'Как сделать первый заказ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Положите товар в корзину — не сделано/ })).toHaveAttribute('href', '/catalog');
  });

  it('заявка отправлена — первые два шага отмечены сами', async () => {
    stub(0, [{ state: 'SUBMITTED' }]);
    renderScreen(<FirstSteps active />);
    expect(await screen.findByRole('link', { name: /Отправьте заявку продавцу — сделано/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Положите товар в корзину — сделано/ })).toBeInTheDocument();
  });

  it('продавец ответил на заявку — блока нет', async () => {
    stub(0, [{ state: 'ACCEPTED' }]);
    renderScreen(<FirstSteps active />);
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Как сделать первый заказ' })).not.toBeInTheDocument());
  });

  it('«Скрыть» убирает блок и помнит это', async () => {
    stub(1, []);
    const { unmount } = renderScreen(<FirstSteps active />);
    await userEvent.click(await screen.findByRole('button', { name: 'Скрыть' }));
    expect(screen.queryByRole('region', { name: 'Как сделать первый заказ' })).not.toBeInTheDocument();
    unmount();
    renderScreen(<FirstSteps active />);
    expect(screen.queryByRole('region', { name: 'Как сделать первый заказ' })).not.toBeInTheDocument();
  });

  it('кабинет не открыт — блока нет и запросов нет', () => {
    stub(0, []);
    renderScreen(<FirstSteps active={false} />);
    expect(screen.queryByRole('region', { name: 'Как сделать первый заказ' })).not.toBeInTheDocument();
  });
});

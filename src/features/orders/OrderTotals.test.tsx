import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderTotals } from './OrderTotals';

/** Итог заявки с грузчиками: продавцу — строкой в сумме, «напрямую» — под итогом. */
describe('итог заявки с грузчиками', () => {
  it('грузчики продавцу — строкой под доставкой', () => {
    render(<OrderTotals currency="KZT" total={15000} breakdown={{ goodsTotal: 12500, deliveryPrice: 1500, loadersPrice: 1000, loadersPayee: 'SELLER' }} />);

    expect(screen.getByTestId('order-loaders')).toHaveTextContent(/Грузчики\s*1\s000\s₸/);
    expect(screen.queryByTestId('order-loaders-direct')).not.toBeInTheDocument();
  });

  it('грузчики напрямую — под итогом, не в нём', () => {
    render(<OrderTotals currency="KZT" total={14000} breakdown={{ goodsTotal: 12500, deliveryPrice: 1500, loadersPrice: 3000, loadersPayee: 'DIRECT' }} />);

    expect(screen.getByTestId('order-loaders-direct')).toHaveTextContent(/Грузчики — оплата напрямую: 3\s000\s₸/);
    expect(screen.queryByTestId('order-loaders')).not.toBeInTheDocument();
    expect(screen.getByTestId('order-total')).toHaveTextContent(/14\s000/);
  });

  it('без грузчиков строки нет', () => {
    render(<OrderTotals currency="KZT" total={14000} breakdown={{ goodsTotal: 12500, deliveryPrice: 1500 }} />);

    expect(screen.queryByTestId('order-loaders')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-loaders-direct')).not.toBeInTheDocument();
  });
});

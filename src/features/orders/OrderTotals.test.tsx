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

    expect(screen.getByTestId('order-loaders-direct')).toHaveTextContent(/Грузчикам\s*3\s000\s₸/);
    expect(screen.queryByTestId('order-loaders')).not.toBeInTheDocument();
    expect(screen.getByTestId('order-total')).toHaveTextContent(/Продавцу\s*14\s000/);
    expect(screen.getByTestId('order-grand-total')).toHaveTextContent(/^17\s000\s₸$/);
  });

  it('свой перевозчик клиента — отдельно, по его тарифу; всего — «от»', () => {
    render(<OrderTotals currency="KZT" total={14000}
      breakdown={{ goodsTotal: 14000, delivery: { carrierName: 'inDriver', transportPayee: 'DIRECT' } }} />);

    expect(screen.queryByTestId('order-delivery')).not.toBeInTheDocument();
    expect(screen.getByTestId('order-delivery-direct')).toHaveTextContent('Перевозчику «inDriver»по его тарифу');
    expect(screen.getByTestId('order-grand-total')).toHaveTextContent(/от 14\s000/);
  });

  it('доставка перевозчику напрямую с суммой — не в «Продавцу», но во «всего»', () => {
    render(<OrderTotals currency="KZT" total={12500}
      breakdown={{ goodsTotal: 12500, deliveryPrice: 1500, delivery: { carrierName: 'СДЭК', transportPayee: 'DIRECT' } }} />);

    expect(screen.queryByTestId('order-delivery')).not.toBeInTheDocument();
    expect(screen.getByTestId('order-grand-total')).toHaveTextContent(/^14\s000\s₸$/);
  });

  it('без грузчиков строки нет', () => {
    render(<OrderTotals currency="KZT" total={14000} breakdown={{ goodsTotal: 12500, deliveryPrice: 1500 }} />);

    expect(screen.queryByTestId('order-loaders')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-loaders-direct')).not.toBeInTheDocument();
  });

  it('НДС в цене товаров — «в т.ч. НДС», иначе — «НДС»', () => {
    const { unmount } = render(<OrderTotals currency="KZT" total={135000} breakdown={{ goodsTotal: 135000, vatAmount: 18620.69, goodsVatMode: 'INCLUDED' }} />);
    expect(screen.getByTestId('order-vat')).toHaveTextContent(/в т\.ч\. НДС/);
    unmount();

    render(<OrderTotals currency="KZT" total={156600} breakdown={{ goodsTotal: 135000, vatAmount: 21600, goodsVatMode: 'ON_TOP' }} />);
    expect(screen.getByTestId('order-vat')).not.toHaveTextContent('в т.ч.');
  });
});

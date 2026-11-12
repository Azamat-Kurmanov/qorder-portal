import { expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '../../i18n';
import { StockNote } from './StockNote';

it('под заказ с другого склада — полностью и коротко', () => {
  render(<StockNote stock="FROM_OTHER_WAREHOUSE" />);
  expect(screen.getByText('Под заказ с другого склада')).toBeInTheDocument();
  cleanup();
  render(<StockNote stock="FROM_OTHER_WAREHOUSE" short />);
  expect(screen.getByText('Под заказ')).toBeInTheDocument();
});

it('свободно меньше нужного — число не зелёное', () => {
  render(<StockNote stock="UNKNOWN" available={5} needed={10} />);
  expect(screen.getByText('Свободно: 5').className).toContain('text-unclear-ink');
  cleanup();
  render(<StockNote stock="IN_STOCK" available={5} needed={3} />);
  expect(screen.getByText('Свободно: 5').className).toContain('text-in-stock');
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CartDto, CartLineDto } from '../../api/generated';
import { GoodsLine, VatLine } from './CartTotals';

function line(unit: string, quantity: number, price: number, vatRate?: number): CartLineDto {
  return {
    itemId: `${unit}-${quantity}-${price}`, name: 'Позиция', quantity, unit,
    priceAtAdding: price, price, priceChanged: false, total: quantity * price,
    terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 1, quantityStep: 1 },
    vatRate,
  } as CartLineDto;
}

function cart(lines: CartLineDto[], vatAmount?: number, vatPayer = true): CartDto {
  const total = lines.reduce((sum, l) => sum + l.total, 0);
  return {
    lines, total, goodsTotal: total, volumeGoods: total, saleSavings: 0, skipped: [], ageConfirmed: false, vatAmount, vatPayer,
  } as CartDto;
}

/** Итоги корзины по макету «Каталог v2»: «Товары, N …» и «НДС» сверху цены. */
describe('итоги корзины', () => {
  it('штучные строки складываются в штуки', () => {
    render(<GoodsLine cart={cart([line('шт', 3, 100), line('шт.', 2, 50)])} />);
    expect(screen.getByTestId('cart-goods')).toHaveTextContent('Товары, 5 шт.');
  });

  it('смешанные единицы считаются позициями', () => {
    render(<GoodsLine cart={cart([line('шт', 3, 100), line('мешок', 2, 2500)])} />);
    expect(screen.getByTestId('cart-goods')).toHaveTextContent('Товары, 2 позиции');
  });

  it('одна ставка у всех строк — с процентом', () => {
    render(<VatLine cart={cart([line('шт', 5, 2500, 16), line('шт', 1, 100, 16)], 2016)} />);
    const vat = screen.getByTestId('cart-vat');
    expect(vat).toHaveTextContent(/НДС 16%/);
    // Налог сверху, а не «в т.ч.»: он прибавлен к итогу.
    expect(vat).not.toHaveTextContent('в т.ч.');
  });

  it('разные ставки — без процента', () => {
    render(<VatLine cart={cart([line('шт', 5, 2500, 16), line('шт', 3, 1200, 12)], 2432)} />);
    const vat = screen.getByTestId('cart-vat');
    expect(vat).toHaveTextContent(/НДС/);
    expect(vat).not.toHaveTextContent('%');
  });

  it('нет налога — нет строки', () => {
    const { container } = render(<VatLine cart={cart([line('шт', 5, 2500)])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('у продавца без НДС итог так и говорит — «без НДС»', () => {
    render(<VatLine cart={cart([line('шт', 5, 2500, 16)], undefined, false)} />);
    expect(screen.getByTestId('cart-vat')).toHaveTextContent('без НДС');
  });

  it('у плательщика — сумма налога, как раньше', () => {
    render(<VatLine cart={cart([line('шт', 5, 2500, 16), line('шт', 1, 100, 16)], 2016, true)} />);
    expect(screen.getByTestId('cart-vat')).toHaveTextContent(/НДС 16%.*2\s016/);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShowcaseCardDto, ShowcaseVariantDto } from '../../api/generated';
import { SizeGrid, sizeRowsOf } from './SizeGrid';

const setLine = vi.fn();
let lines: { itemId: string; quantity: number }[] = [];

vi.mock('../cart/useCart', () => ({
  useCart: () => ({ data: { status: 200, data: { lines } } }),
  cartOf: (response?: { data: unknown }) => response?.data,
  useSetCartLine: () => ({ mutateAsync: setLine }),
}));
vi.mock('../../supplier/SupplierCurrency', () => ({ useSupplierCurrency: () => 'KZT' }));

function variant(itemId: string, colour: string, size: string, extra: Partial<ShowcaseVariantDto> = {}): ShowcaseVariantDto {
  return {
    itemId, price: 12500,
    fields: [
      { code: 'colour', name: 'Цвет', type: 'OPTION', value: colour },
      { code: 'size', name: 'Размер', type: 'OPTION', value: size },
    ],
    ...extra,
  } as ShowcaseVariantDto;
}

const VARIANTS = [
  variant('r44', 'Красный', '44'), variant('r46', 'Красный', '46'), variant('r48', 'Красный', '48', { stock: 'OUT_OF_STOCK' }),
  variant('b44', 'Синий', '44'), variant('b46', 'Синий', '46'),
];

const card = (id = 'r44') => ({ id, name: 'Платье', unit: 'шт', price: 12500, variants: VARIANTS } as unknown as ShowcaseCardDto);

beforeEach(() => {
  setLine.mockReset().mockResolvedValue({ status: 200 });
  lines = [];
});

describe('сетка размеров', () => {
  it('размеры — только того же цвета, в порядке оси', () => {
    expect(sizeRowsOf(VARIANTS, VARIANTS[0]).map((row) => row.variant.itemId)).toEqual(['r44', 'r46', 'r48']);
    expect(sizeRowsOf(VARIANTS, VARIANTS[3]).map((row) => row.variant.itemId)).toEqual(['b44', 'b46']);
  });

  it('«По 1 каждого размера» — кроме отсутствующих; «В корзину» задаёт количество каждому размеру', async () => {
    render(<SizeGrid item={card()} />);
    expect(screen.getAllByTestId('size-row')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'По 1 каждого размера' }));
    expect(screen.getByLabelText('Количество размера 48')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: /В корзину: 2/ }));
    expect(setLine).toHaveBeenCalledWith({ itemId: 'r44', data: { quantity: 1 } });
    expect(setLine).toHaveBeenCalledWith({ itemId: 'r46', data: { quantity: 1 } });
    expect(setLine).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Корзина обновлена')).toBeInTheDocument();
  });

  it('уже лежащее в корзине видно в поле; неизменённые размеры не отправляются', async () => {
    lines = [{ itemId: 'r44', quantity: 3 }];
    render(<SizeGrid item={card()} />);
    expect(screen.getByLabelText('Количество размера 44')).toHaveValue('3');
    await userEvent.type(screen.getByLabelText('Количество размера 46'), '2');
    await userEvent.click(screen.getByRole('button', { name: /В корзину: 5/ }));
    expect(setLine).toHaveBeenCalledTimes(1);
    expect(setLine).toHaveBeenCalledWith({ itemId: 'r46', data: { quantity: 2 } });
  });

  it('отказ корзины назван с размером', async () => {
    setLine.mockRejectedValueOnce(Object.assign(new Error('x'), { info: { detail: 'Минимум 5 шт.' } }));
    render(<SizeGrid item={card()} />);
    await userEvent.type(screen.getByLabelText('Количество размера 44'), '1');
    await userEvent.click(screen.getByRole('button', { name: /В корзину/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Размер 44: Минимум 5 шт.');
  });

  it('один размер у цвета — сетки нет', () => {
    const { container } = render(<SizeGrid item={{ ...card('b44'), variants: VARIANTS.slice(3, 4) } as ShowcaseCardDto} />);
    expect(container).toBeEmptyDOMElement();
  });
});

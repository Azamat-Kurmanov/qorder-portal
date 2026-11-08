import { describe, expect, it } from 'vitest';
import type { CartDto, CartLineDto } from '../../api/generated';
import { lineMode, lineOf, partOf, takenIn } from './cartPart';

const line = (patch: Partial<CartLineDto>) => ({ itemId: 'i', name: 'n', quantity: 1, total: 100, ...patch }) as CartLineDto;
const cart = (lines: CartLineDto[]) => ({ lines, total: 999, goodsTotal: 999, skipped: [], saleSavings: 5 }) as unknown as CartDto;

describe('оптовая и розничная заявки', () => {
  it('строка — в заявке своего режима; без режима упаковки оптом, штуки в розницу', () => {
    expect(lineMode(line({ mode: 'RETAIL', split: { packs: 1 } as never }))).toBe('RETAIL');
    expect(lineMode(line({ split: { packs: 2 } as never }))).toBe('WHOLESALE');
    expect(lineMode(line({}))).toBe('RETAIL');
  });

  it('часть корзины — строки своего вида и их сумма', () => {
    const both = cart([line({ itemId: 'a', total: 300, mode: 'WHOLESALE' }), line({ itemId: 'b', total: 50 })]);
    const wholesale = partOf(both, 'WHOLESALE');
    expect(wholesale.lines.map((one) => one.itemId)).toEqual(['a']);
    expect(wholesale.total).toBe(300);
    expect(partOf(both, 'RETAIL').total).toBe(50);
  });
});

describe('один товар в обеих заявках', () => {
  const both = cart([line({ itemId: 'c', mode: 'WHOLESALE', quantity: 40 }), line({ itemId: 'c', mode: 'RETAIL', quantity: 3 }),
    line({ itemId: 'n', quantity: 5 })]);

  it('строка ищется в своей заявке; у товара без двух способов — единственная', () => {
    expect(lineOf(both, 'c', 'RETAIL')?.quantity).toBe(3);
    expect(lineOf(both, 'c', 'WHOLESALE')?.quantity).toBe(40);
    expect(lineOf(both, 'n', 'RETAIL')?.quantity).toBe(5);
    expect(lineOf(cart([line({ itemId: 'c', mode: 'WHOLESALE' })]), 'c', 'RETAIL')).toBeUndefined();
  });

  it('«взят» — только в заявке выбранного способа', () => {
    const wholesaleOnly = cart([line({ itemId: 'c', mode: 'WHOLESALE' }), line({ itemId: 'n' })]);
    expect([...takenIn(wholesaleOnly, 'RETAIL')]).toEqual(['n']);
    expect([...takenIn(wholesaleOnly, 'WHOLESALE')].sort()).toEqual(['c', 'n']);
  });
});

import { describe, expect, it } from 'vitest';
import { namedPriceOf } from './myOrdersModel';

const order = (diff: { kind: string; name: string }[], needsAnswer = true) => ({ needsAnswer, diff }) as never;

describe('продавец только назвал сумму', () => {
  it('доставка, грузчики или обе', () => {
    expect(namedPriceOf(order([{ kind: 'PRICE_NAMED', name: 'Доставка по городу, пр. Абая, 10' }]))).toBe('delivery');
    expect(namedPriceOf(order([{ kind: 'PRICE_NAMED', name: 'Грузчики' }]))).toBe('loaders');
    expect(namedPriceOf(order([{ kind: 'PRICE_NAMED', name: 'Доставка' }, { kind: 'PRICE_NAMED', name: 'Грузчики' }]))).toBe('both');
  });

  it('есть настоящие правки или ответа не ждут — обычное «изменил заявку»', () => {
    expect(namedPriceOf(order([{ kind: 'PRICE_NAMED', name: 'Доставка' }, { kind: 'QUANTITY_CHANGED', name: 'Абрикосы' }]))).toBeNull();
    expect(namedPriceOf(order([{ kind: 'PRICE_NAMED', name: 'Доставка' }], false))).toBeNull();
    expect(namedPriceOf(order([]))).toBeNull();
  });
});

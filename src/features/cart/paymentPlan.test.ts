import { describe, expect, it } from 'vitest';
import { paymentPlan } from './paymentPlan';

describe('кому и сколько платить', () => {
  it('всё продавцу и всё известно — «всего» равно «итого», отдельных платежей нет', () => {
    const plan = paymentPlan({ total: 17_000, shipping: 2_000, direct: false, loaders: { amount: 1_000, direct: false } });
    expect(plan).toMatchObject({ seller: 17_000, sellerLater: [], separate: [], grand: 17_000, approximate: false });
  });

  it('свой перевозчик по его тарифу и грузчики напрямую — «всего» от суммы продавцу и грузчикам', () => {
    const plan = paymentPlan({ total: 14_000, direct: true, loaders: { amount: 3_000, direct: true } }, 'inDriver');
    expect(plan.separate).toEqual([{ kind: 'carrier', name: 'inDriver', amount: undefined }, { kind: 'loaders', amount: 3_000 }]);
    expect(plan.grand).toBe(17_000);
    expect(plan.approximate).toBe(true);
  });

  it('договорная доставка и грузчики продавцу — он добавит их при проверке', () => {
    const plan = paymentPlan({ total: 14_000, direct: false, loaders: { direct: false } });
    expect(plan.sellerLater).toEqual(['delivery', 'loaders']);
    expect(plan.approximate).toBe(true);
  });
});

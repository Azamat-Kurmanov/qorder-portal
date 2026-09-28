import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import type { DeliveryLoaders } from '../../api/generated';
import { chosenLoaders, loadersPrice, loadersTerms } from './loaders';

const onRequest = (patch: Partial<DeliveryLoaders>): DeliveryLoaders => ({
  mode: 'ON_REQUEST', tariff: 'FIXED', provider: 'OWN', payee: 'SELLER', ...patch,
});

/** Зеркало `LoadersPricing` сервера: те же случаи, те же ответы. */
describe('сумма грузчиков', () => {
  it('бесплатно и фиксированно', () => {
    expect(loadersPrice(onRequest({ tariff: 'FREE' }), [], undefined, false)).toEqual({ amount: 0 });
    expect(loadersPrice(onRequest({ amount: 3000 }), [], undefined, false)).toEqual({ amount: 3000 });
  });

  it('за этаж: без лифта, с лифтом, первый этаж и без этажа', () => {
    const perFloor = onRequest({ tariff: 'PER_FLOOR', amount: 500, liftAmount: 200 });
    expect(loadersPrice(perFloor, [], 5, false)).toEqual({ amount: 2500 });
    expect(loadersPrice(perFloor, [], 5, true)).toEqual({ amount: 1000 });
    expect(loadersPrice(perFloor, [], 1, false)).toEqual({ amount: 0 });
    expect(loadersPrice(perFloor, [], undefined, false)).toEqual({ unknown: 'FLOOR_MISSING' });
  });

  it('за количество — шаги вверх', () => {
    const perTen = onRequest({ tariff: 'PER_UNITS', amount: 1000, step: 10 });
    expect(loadersPrice(perTen, [{ quantity: 7 }, { quantity: 5 }], undefined, false)).toEqual({ amount: 2000 });
    expect(loadersPrice(perTen, [{ quantity: 10 }], undefined, false)).toEqual({ amount: 1000 });
  });

  it('за вес — по весу единицы; дробные килограммы не дают лишнего шага', () => {
    const perHundred = onRequest({ tariff: 'PER_WEIGHT', amount: 1000, step: 100 });
    expect(loadersPrice(perHundred, [{ quantity: 5, unitWeightKg: 50 }], undefined, false)).toEqual({ amount: 3000 });
    expect(loadersPrice(onRequest({ tariff: 'PER_WEIGHT', amount: 1000, step: 0.3 }),
      [{ quantity: 3, unitWeightKg: 0.1 }], undefined, false)).toEqual({ amount: 1000 });
  });

  it('вес не у всех строк — сумму уточнит продавец, а не ноль', () => {
    expect(loadersPrice(onRequest({ tariff: 'PER_WEIGHT', amount: 1000, step: 100 }),
      [{ quantity: 5, unitWeightKg: 50 }, { quantity: 2 }], undefined, false)).toEqual({ unknown: 'WEIGHT_MISSING' });
  });

  it('договорная — неизвестна', () => {
    expect(loadersPrice(onRequest({ tariff: 'NEGOTIABLE' }), [], 3, false)).toEqual({ unknown: 'NEGOTIABLE' });
  });

  it('выбор клиента: без флажка и без «по запросу» грузчиков нет', () => {
    expect(chosenLoaders(onRequest({ amount: 3000 }), { methodId: 'm' }, [])).toBeUndefined();
    expect(chosenLoaders({ mode: 'INCLUDED' }, { methodId: 'm', loaders: true }, [])).toBeUndefined();
    expect(chosenLoaders(onRequest({ amount: 3000, provider: 'CREW', payee: 'DIRECT' }), { methodId: 'm', loaders: true }, []))
      .toEqual({ amount: 3000, direct: true });
  });

  it('условия словами', () => {
    expect(loadersTerms(onRequest({ tariff: 'PER_UNITS', amount: 1000, step: 10, provider: 'CREW', payee: 'DIRECT' }), i18n.t, 'KZT'))
      .toMatch(/^грузчики 1\s000\s₸ за каждые 10 шт\., оплачиваются напрямую$/);
    expect(loadersTerms({ mode: 'INCLUDED' }, i18n.t, 'KZT')).toBe('грузчики входят в доставку');
    expect(loadersTerms({ mode: 'NONE' }, i18n.t, 'KZT')).toBeNull();
    expect(loadersTerms(undefined, i18n.t, 'KZT')).toBeNull();
  });
});

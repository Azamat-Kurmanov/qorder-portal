import { beforeAll, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import type { DeliveryOptionsDto, PortalPromotionsDto } from '../../api/generated';
import { announceMessages } from './announceMessages';

const t = i18n.t.bind(i18n);
const promo = (extra: Partial<PortalPromotionsDto> = {}) =>
  ({ volumeTiers: [], deals: [], dealCount: 0, saleCategories: [], ...extra }) as PortalPromotionsDto;
const delivery = (free: (number | undefined)[]) =>
  ({ mode: 'DELIVERY', pickupPoints: [], methods: free.map((freeFromAmount, i) => ({ id: `m${i}`, name: 'Курьер', pickup: false, freeFromAmount })) }) as unknown as DeliveryOptionsDto;

describe('строки полосы объявлений', () => {
  beforeAll(async () => { await i18n.changeLanguage('ru'); });

  it('нет данных — нет строк', () => {
    expect(announceMessages({}, t)).toEqual([]);
    expect(announceMessages({ promotions: promo(), delivery: delivery([undefined]) }, t)).toEqual([]);
  });

  it('распродажа, доставка, объём, первая заявка — по порядку и из своих данных', () => {
    const lines = announceMessages({
      currency: 'KZT',
      promotions: promo({
        sale: { title: 'Осенняя распродажа', maxPercent: 30, endsOn: '2026-10-30', countdown: false } as never,
        volumeTiers: [{ from: 150000, percent: 3 }, { from: 400000, percent: 5 }],
        firstOrder: { percent: 5, status: 'ELIGIBLE' },
      }),
      delivery: delivery([undefined, 50000, 20000]),
    }, t);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('Осенняя распродажа');
    expect(lines[0]).toContain('30');
    expect(lines[1]).toMatch(/Доставка бесплатно от 20\s000 ₸/);
    expect(lines[2]).toMatch(/5%.*400\s000 ₸/);
    expect(lines[3]).toMatch(/5%/);
  });

  it('скидка на первую заявку — только если она положена покупателю', () => {
    const used = announceMessages({ promotions: promo({ firstOrder: { percent: 5, status: 'USED' } }) }, t);
    expect(used).toEqual([]);
  });

  it('сумма — валютой магазина', () => {
    const [line] = announceMessages({ currency: 'RUB', delivery: delivery([3000]) }, t);
    expect(line).toContain('₽');
  });
});

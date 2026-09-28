import { describe, expect, it } from 'vitest';
import type { ShowcaseWholesaleDto } from '../../api/generated';
import { packsOnly, splitOf, tierFor, toPieces } from './wholesale';

const CEMENT: ShowcaseWholesaleDto = {
  unit: 'упаковка', packQty: 20, pieceUnit: 'мешок', retail: true,
  tiers: [{ from: 2, price: 1800 }, { from: 10, price: 1700 }],
};

describe('опт до корзины', () => {
  it('разбиение как у сервера: 30 — розница, 45 — 2 уп. + 5, 200 — 10 уп.', () => {
    expect(splitOf(CEMENT, 30)).toMatchObject({ packs: 0, rest: 30 });
    expect(splitOf(CEMENT, 45)).toMatchObject({ packs: 2, rest: 5, tier: { price: 1800 } });
    expect(splitOf(CEMENT, 200)).toMatchObject({ packs: 10, rest: 0, tier: { price: 1700 } });
  });

  it('упаковка дороже розницы за штуку — всё в розницу', () => {
    expect(splitOf(CEMENT, 45, 89)).toMatchObject({ packs: 0, rest: 45 });
    expect(splitOf(CEMENT, 45, 90)).toMatchObject({ packs: 2, rest: 5 });
  });

  it('«только опт» считает упаковки и кладёт штуки', () => {
    const only = { wholesale: { ...CEMENT, retail: false } };
    expect(packsOnly(only)).toBe(true);
    expect(packsOnly({ wholesale: CEMENT })).toBe(false);
    expect(toPieces(only, 3)).toBe(60);
    expect(toPieces({ wholesale: CEMENT }, 3)).toBe(3);
  });

  it('ступень — последняя, до которой дотянулось число упаковок', () => {
    expect(tierFor(CEMENT.tiers, 1)).toBeUndefined();
    expect(tierFor(CEMENT.tiers, 9)?.price).toBe(1800);
    expect(tierFor(CEMENT.tiers, 10)?.price).toBe(1700);
  });
});

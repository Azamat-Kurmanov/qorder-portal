import { describe, expect, it } from 'vitest';
import { firstQuantity, fitQuantity, lessQuantity, stepOf } from './saleTerms';

const bottles = { hit: false, novelty: false, ageRestricted: false, quantityStep: 6 };
const sacks = { hit: false, novelty: false, ageRestricted: false, minQuantity: 10 };

describe('минимум и кратность', () => {
  it('без условий — от одной единицы и любым количеством', () => {
    expect(stepOf(undefined)).toBe(1);
    expect(firstQuantity(undefined)).toBe(1);
    expect(fitQuantity(7, undefined)).toBe(7);
  });

  it('кратность: первое нажатие кладёт шаг, набранное поднимается до кратного', () => {
    expect(firstQuantity(bottles)).toBe(6);
    expect(fitQuantity(7, bottles)).toBe(12);
    expect(lessQuantity(12, bottles)).toBe(6);
    expect(lessQuantity(6, bottles)).toBe(0);
  });

  it('минимум: ниже него строка убирается, а не остаётся недопустимой', () => {
    expect(firstQuantity(sacks)).toBe(10);
    expect(fitQuantity(3, sacks)).toBe(10);
    expect(lessQuantity(11, sacks)).toBe(10);
    expect(lessQuantity(10, sacks)).toBe(0);
  });

  it('минимум не кратен шагу — первым кладётся ближайшее кратное', () => {
    expect(firstQuantity({ ...sacks, quantityStep: 6 })).toBe(12);
  });

  it('ноль убирает строку', () => {
    expect(fitQuantity(0, bottles)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { seasonOf, todaysLook } from './seasonalLook';

const base = { pattern: null, photo: false, occasion: null, occasionFrom: null, occasionUntil: null, occasionBackground: true };

describe('фон на сегодня', () => {
  it('сезон по месяцу: границы — первое число', () => {
    expect(seasonOf('2027-02-28')).toBe('WINTER');
    expect(seasonOf('2027-03-01')).toBe('SPRING');
    expect(seasonOf('2027-05-31')).toBe('SPRING');
    expect(seasonOf('2027-06-01')).toBe('SUMMER');
    expect(seasonOf('2027-09-01')).toBe('AUTUMN');
    expect(seasonOf('2027-11-30')).toBe('AUTUMN');
    expect(seasonOf('2027-12-01')).toBe('WINTER');
  });

  it('«по сезону» — узор текущего сезона', () => {
    const look = { ...base, pattern: 'SEASON' };
    expect(todaysLook(look, '2027-01-15')).toEqual({ pattern: 'WINTER' });
    expect(todaysLook(look, '2027-04-15')).toEqual({ pattern: 'SPRING' });
    expect(todaysLook(look, '2027-07-15')).toEqual({ pattern: 'SUMMER' });
    expect(todaysLook(look, '2027-10-15')).toEqual({ pattern: 'AUTUMN' });
  });

  it('выбранное продавцом — как есть', () => {
    expect(todaysLook({ ...base, pattern: 'FOOD' }, '2027-01-15')).toEqual({ pattern: 'FOOD' });
  });

  it('в дни повода — праздничный узор, вне дней — свои', () => {
    const birthday = { ...base, pattern: 'FOOD', occasion: 'BIRTHDAY', occasionFrom: '2027-05-01', occasionUntil: '2027-05-03' };
    expect(todaysLook(birthday, '2027-05-01')).toEqual({ pattern: 'BIRTHDAY' });
    expect(todaysLook(birthday, '2027-05-03')).toEqual({ pattern: 'BIRTHDAY' });
    expect(todaysLook(birthday, '2027-05-04')).toEqual({ pattern: 'FOOD' });
    expect(todaysLook({ ...birthday, occasion: 'BLACK_FRIDAY' }, '2027-05-02')).toEqual({ pattern: 'SALE' });
  });

  it('праздничный фон выключен — праздник фон не трогает', () => {
    const sale = { ...base, occasion: 'SALE', occasionFrom: '2027-05-01', occasionUntil: '2027-05-03', occasionBackground: false };
    expect(todaysLook(sale, '2027-05-02')).toEqual({ pattern: null });
  });

  it('своё фото праздник не трогает', () => {
    const ny = { ...base, photo: true, occasion: 'NEW_YEAR', occasionFrom: '2027-12-20', occasionUntil: '2028-01-02' };
    expect(todaysLook(ny, '2027-12-31')).toEqual({ pattern: null });
  });
});

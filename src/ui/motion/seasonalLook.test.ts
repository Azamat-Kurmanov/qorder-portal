import { describe, expect, it } from 'vitest';
import { seasonOf, todaysLook } from './seasonalLook';

const base = { pattern: null, backdrop: 'GLOW', photo: false, occasion: null, occasionFrom: null, occasionUntil: null, occasionBackground: true };

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

  it('«по сезону» — узор и живой фон текущего сезона', () => {
    const look = { ...base, pattern: 'SEASON', backdrop: 'SEASON' };
    expect(todaysLook(look, '2027-01-15')).toEqual({ pattern: 'WINTER', backdrop: 'SNOW' });
    expect(todaysLook(look, '2027-04-15')).toEqual({ pattern: 'SPRING', backdrop: 'PETALS' });
    expect(todaysLook(look, '2027-07-15')).toEqual({ pattern: 'SUMMER', backdrop: 'SUNSHINE' });
    expect(todaysLook(look, '2027-10-15')).toEqual({ pattern: 'AUTUMN', backdrop: 'LEAVES' });
  });

  it('выбранное продавцом — как есть', () => {
    expect(todaysLook({ ...base, pattern: 'FOOD', backdrop: 'WAVES' }, '2027-01-15')).toEqual({ pattern: 'FOOD', backdrop: 'WAVES' });
  });

  it('в дни повода — праздничные узор и живой фон, вне дней — свои', () => {
    const birthday = { ...base, pattern: 'FOOD', occasion: 'BIRTHDAY', occasionFrom: '2027-05-01', occasionUntil: '2027-05-03' };
    expect(todaysLook(birthday, '2027-05-01')).toEqual({ pattern: 'BIRTHDAY', backdrop: 'BALLOONS' });
    expect(todaysLook(birthday, '2027-05-03')).toEqual({ pattern: 'BIRTHDAY', backdrop: 'BALLOONS' });
    expect(todaysLook(birthday, '2027-05-04')).toEqual({ pattern: 'FOOD', backdrop: 'GLOW' });
    expect(todaysLook({ ...birthday, occasion: 'BLACK_FRIDAY' }, '2027-05-02')).toEqual({ pattern: 'SALE', backdrop: 'SALE_TAGS' });
  });

  it('праздничный фон выключен — праздник фон не трогает', () => {
    const sale = { ...base, occasion: 'SALE', occasionFrom: '2027-05-01', occasionUntil: '2027-05-03', occasionBackground: false };
    expect(todaysLook(sale, '2027-05-02')).toEqual({ pattern: null, backdrop: 'GLOW' });
  });

  it('при своём фото праздник меняет только живой фон', () => {
    const ny = { ...base, photo: true, occasion: 'NEW_YEAR', occasionFrom: '2027-12-20', occasionUntil: '2028-01-02' };
    expect(todaysLook(ny, '2027-12-31')).toEqual({ pattern: null, backdrop: 'GARLAND' });
  });
});

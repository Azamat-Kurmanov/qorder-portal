import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { quantityWithUnit, unitFor, unitPer } from './units';

describe('количество с единицей', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('знакомая единица склоняется по числу', () => {
    expect(quantityWithUnit(1, 'мешок')).toBe('1 мешок');
    expect(quantityWithUnit(3, 'мешок')).toBe('3 мешка');
    expect(quantityWithUnit(10, 'мешок')).toBe('10 мешков');
    expect(quantityWithUnit(12, 'бутылка')).toBe('12 бутылок');
    expect(quantityWithUnit(21, 'ведро')).toBe('21 ведро');
  });

  it('сокращение и незнакомая единица остаются как есть', () => {
    expect(quantityWithUnit(6, 'шт.')).toBe('6 шт.');
    expect(quantityWithUnit(5, 'м²')).toBe('5 м²');
  });

  it('«шт» без точки выводится с точкой, как в подписи рядом', () => {
    expect(quantityWithUnit(2, 'шт')).toBe('2 шт.');
  });

  it('на казахском единица не склоняется', async () => {
    await i18n.changeLanguage('kk');
    expect(quantityWithUnit(10, 'мешок')).toBe('10 мешок');
  });

  it('единица рядом с числом в поле склоняется по нему, «шт» — с точкой', async () => {
    expect(unitFor(1, 'мешок')).toBe('мешок');
    expect(unitFor(3, 'мешок')).toBe('мешка');
    expect(unitFor(20, 'мешок')).toBe('мешков');
    expect(unitFor(0, 'мешок')).toBe('мешков');
    expect(unitFor(5, 'шт')).toBe('шт.');
    await i18n.changeLanguage('kk');
    expect(unitFor(20, 'мешок')).toBe('мешок');
  });
});

describe('единица после «за»', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('знакомая единица стоит в винительном падеже, «шт» — с точкой', () => {
    expect(unitPer('шт')).toBe('шт.');
    expect(unitPer('шт.')).toBe('шт.');
    expect(unitPer('упаковка')).toBe('упаковку');
    expect(unitPer('коробка')).toBe('коробку');
    expect(unitPer('бутылка')).toBe('бутылку');
    expect(unitPer('канистра')).toBe('канистру');
    expect(unitPer('Упаковка')).toBe('упаковку');
    expect(unitPer('мешок')).toBe('мешок');
  });

  it('сокращение и незнакомая единица остаются как есть', () => {
    expect(unitPer('м³')).toBe('м³');
    expect(unitPer('кг')).toBe('кг');
    expect(unitPer('л')).toBe('л');
    expect(unitPer('рулончик')).toBe('рулончик');
  });

  it('на казахском и английском не склоняется', async () => {
    await i18n.changeLanguage('kk');
    expect(unitPer('упаковка')).toBe('упаковка');
    await i18n.changeLanguage('en');
    expect(unitPer('коробка')).toBe('коробка');
  });
});

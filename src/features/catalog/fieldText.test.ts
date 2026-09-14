import { describe, expect, it } from 'vitest';
import { fieldText } from './fieldText';

/**
 * Значение характеристики готовится сервером, но показывается по-разному
 * в зависимости от типа: список — подписью, несколько значений — перечнем,
 * число — с единицей, да/нет — словом на языке клиента.
 */
describe('значение характеристики для показа', () => {
  it('текст и выбранный вариант показываются как есть', () => {
    expect(fieldText({ code: 'COMPOSITION', name: 'Состав', type: 'TEXT', value: 'хлопок 80%' }))
      .toBe('хлопок 80%');
    expect(fieldText({ code: 'SEASON', name: 'Сезон', type: 'OPTION', value: 'Зима' }))
      .toBe('Зима');
  });

  it('несколько выбранных вариантов перечисляются в порядке выбора', () => {
    expect(fieldText({
      code: 'COLORS', name: 'Цвета', type: 'OPTION_MULTI', values: ['Чёрный', 'Синий'],
    })).toBe('Чёрный, Синий');
  });

  it('число и диапазон показываются с единицей', () => {
    expect(fieldText({ code: 'VOLUME', name: 'Объём', type: 'NUMBER', value: '1.5', unit: 'л' }))
      .toBe('1.5 л');
    expect(fieldText({
      code: 'LENGTH', name: 'Длина', type: 'RANGE', value: '10', valueTo: '20', unit: 'см',
    })).toBe('10–20 см');
  });

  it('да и нет переводятся: клиенту слово «true» ничего не говорит', () => {
    expect(fieldText({ code: 'WATERPROOF', name: 'Непромокаемая', type: 'BOOLEAN', value: 'true' }))
      .toBe('Да');
    expect(fieldText({ code: 'WATERPROOF', name: 'Непромокаемая', type: 'BOOLEAN', value: 'false' }))
      .toBe('Нет');
  });

  it('дата показывается по-местному, а не в машинной записи', () => {
    expect(fieldText({ code: 'BEST_BEFORE', name: 'Годен до', type: 'DATE', value: '2026-12-31' }))
      .toBe('31.12.2026');
  });

  /**
   * Пустое значение — не «неизвестно», а «продавец не заполнил»: показывать
   * подпись с пустотой значит занимать строку сообщением ни о чём.
   */
  it('пустое значение не показывается вовсе', () => {
    expect(fieldText({ code: 'SIZE', name: 'Размер', type: 'OPTION' })).toBe('');
    expect(fieldText({ code: 'COLORS', name: 'Цвета', type: 'OPTION_MULTI', values: [] })).toBe('');
    expect(fieldText({ code: 'LENGTH', name: 'Длина', type: 'RANGE', value: '', valueTo: '' })).toBe('');
  });
});

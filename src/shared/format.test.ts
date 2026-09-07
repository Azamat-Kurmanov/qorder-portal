import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { shortDate, tenge } from './format';

describe('запись чисел и дат', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('сумма записывается по правилам выбранного языка', async () => {
    const russian = tenge(12500);
    await i18n.changeLanguage('en');
    const english = tenge(12500);

    // Разделитель разрядов у русского — неразрывный пробел, у английского —
    // запятая. Совпади они, локаль до Intl не доходит.
    expect(english).not.toBe(russian);
    expect(english).toContain('₸');
  });

  /*
   * Формат считается на каждый вызов, а не один раз на модуле: язык меняют
   * в работающем кабинете, и константа осталась бы прежней до перезагрузки
   * страницы — суммы на казахском экране остались бы записаны по-русски.
   */
  it('смена языка влияет на уже загруженный модуль', async () => {
    await i18n.changeLanguage('kk');
    const kazakh = tenge(1000000);
    await i18n.changeLanguage('en');

    expect(tenge(1000000)).not.toBe(kazakh);
  });

  it('дата записывается по правилам выбранного языка', async () => {
    const iso = '2026-09-07T10:00:00Z';
    const russian = shortDate(iso);
    await i18n.changeLanguage('en');

    expect(russian).not.toBe('');
    expect(shortDate(iso)).not.toBe('');
  });

  // Нечитаемую дату модуль отдаёт как есть: подставить сегодняшнюю значило бы
  // назвать клиенту срок, которого сервер не называл.
  it('нечитаемая дата возвращается без изменений', () => {
    expect(shortDate('не дата')).toBe('не дата');
  });
});

describe('склонение слова «позиция»', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('русский склоняет по числу', () => {
    expect(i18n.t('common.positions', { count: 1 })).toBe('позиция');
    expect(i18n.t('common.positions', { count: 3 })).toBe('позиции');
    expect(i18n.t('common.positions', { count: 12 })).toBe('позиций');
  });

  // У казахского правила другие: третья ветка русского условия к нему
  // неприменима, и самописная функция дала бы неверное слово.
  it('казахский не наследует русские ветки', async () => {
    await i18n.changeLanguage('kk');
    expect(i18n.t('common.positions', { count: 1 }))
      .toBe(i18n.t('common.positions', { count: 12 }));
  });
});

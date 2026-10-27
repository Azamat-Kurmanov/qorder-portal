import { afterAll, describe, expect, it, vi } from 'vitest';

/*
 * Браузер без казахских данных локалей — как Chrome 156: `kk-KZ` даёт английскую запись
 * («31,990», «09-12», месяц «M09»). В Node данные есть, поэтому браузер изображается
 * подменой `Intl.DateTimeFormat` и `NumberFormat` до загрузки модулей.
 */
const RealDate = Intl.DateTimeFormat;
const RealNumber = Intl.NumberFormat;
const asChrome = (locale?: string | string[]) => (String(locale).startsWith('kk') ? 'en-US' : locale);
vi.stubGlobal('Intl', {
  ...Intl,
  DateTimeFormat: function DateTimeFormat(locale?: string | string[], options?: Intl.DateTimeFormatOptions) {
    return new RealDate(asChrome(locale), options);
  },
  NumberFormat: function NumberFormat(locale?: string | string[], options?: Intl.NumberFormatOptions) {
    return new RealNumber(asChrome(locale), options);
  },
});

const { default: i18n, kazakhIntl } = await import('../i18n');
const { dayMonth, money, shortDate } = await import('./format');

describe('казахский в браузере без казахских данных', () => {
  afterAll(async () => {
    await i18n.changeLanguage('ru');
    vi.unstubAllGlobals();
  });

  it('суммы и даты цифрами — как у ru-KZ, месяц словом — по-казахски', async () => {
    await i18n.changeLanguage('kk');

    expect(kazakhIntl).toBe(false);
    expect(money(31990, 'KZT')).toBe('31 990 ₸');
    expect(shortDate('2026-09-12T12:00:00')).toBe('12.09');
    expect(dayMonth('2026-09-12')).toBe('12 қыркүйек');
    expect(dayMonth('2026-10-29T10:00:00', true)).toBe('2026 ж. 29 қазан');
  });

  it('русский и английский не задеты', async () => {
    await i18n.changeLanguage('ru');
    expect(dayMonth('2026-09-12')).toBe('12 сентября');
    await i18n.changeLanguage('en');
    expect(dayMonth('2026-09-12')).toBe('12 September');
  });
});

import { formatPhone } from './phone';
import { intlLocale } from '../i18n';
import { currencySign, type Currency } from './currency';

/**
 * Числа и цены в том виде, в каком их читает человек.
 *
 * Отдельным модулем, а не по месту: цена показывается на трёх экранах,
 * и разойдись форматирование — клиент решит, что суммы разные.
 *
 * Формат считается на каждый вызов, а не один раз на модуле: язык меняют
 * в работающем кабинете, и посчитанная при загрузке константа осталась бы
 * прежней до перезагрузки страницы — суммы на казахском экране остались бы
 * записаны по-русски.
 */
function numberFormat(): Intl.NumberFormat {
  return new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 2 });
}

/** Число без хвоста нулей и без знака валюты: количество, ставка НДС. Бывшая `money(value)`. */
export function decimal(value: number): string {
  return numberFormat().format(value);
}

/**
 * Сумма со знаком валюты магазина: число по правилам языка и знак валюты
 * рядом с ним, как в справочнике (`shared/currency.ts`).
 *
 * `currency === undefined` — магазин ещё не известен (список поставщиков
 * не дошёл или ушёл переключением) — число выводится без знака, тем же
 * `decimal`: выдумывать знак раньше, чем известна валюта магазина, нельзя.
 * Второй аргумент обязателен: он называет явно, что вызывающая сторона
 * ещё не довела валюту заявки или магазина по цепочке вызовов, а не забыла
 * её передать.
 */
export function money(value: number, currency: Currency | undefined): string {
  return currency === undefined ? decimal(value) : `${numberFormat().format(value)} ${currencySign(currency)}`;
}

/** Дата без года: клиенту важно «на когда», а не архивная точность. */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat(intlLocale(), { day: '2-digit', month: '2-digit' }).format(date);
}

/**
 * Номер в том виде, в каком его читают вслух: «+7 701 000 00 01».
 *
 * Хранит и присылает его сервер цифрами подряд, и в таком виде человек
 * не узнаёт собственного номера — а в шапке номер стоит ровно затем, чтобы
 * он себя узнал. Казахстанская запись разбивается по разрядам, у номера
 * другой страны отделяется только код (`shared/phone.ts`): чужой формат,
 * разбитый по чужим правилам, читается хуже неразбитого.
 */
export function phone(value: string): string {
  return formatPhone(value);
}

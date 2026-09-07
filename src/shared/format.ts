import { intlLocale } from '../i18n';

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

/** Число без хвоста нулей: «5», а не «5.0000». */
export function money(value: number): string {
  return numberFormat().format(value);
}

/** Сумма с валютой. Тенге остаётся тенге на всех языках: меняется запись числа. */
export function tenge(value: number): string {
  return `${numberFormat().format(value)} ₸`;
}

/** Дата без года: клиенту важно «на когда», а не архивная точность. */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat(intlLocale(), { day: '2-digit', month: '2-digit' }).format(date);
}

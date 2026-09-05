/**
 * Числа и цены в том виде, в каком их читает человек.
 *
 * Отдельным модулем, а не по месту: цена показывается на трёх экранах,
 * и разойдись форматирование — клиент решит, что суммы разные.
 */
const NUMBER = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 2 });

/** Число без хвоста нулей: «5», а не «5.0000». */
export function money(value: number): string {
  return NUMBER.format(value);
}

/** Сумма с валютой. */
export function tenge(value: number): string {
  return `${NUMBER.format(value)} ₸`;
}

/**
 * Цена со ставкой налога и датой актуальности.
 *
 * Требование о полноте торговой информации действует и здесь: витрина
 * предъявляет цену раньше, чем подтверждение заявки, и цена без даты
 * превращается в бессрочное обещание.
 */
export function priceLine(price: number, vatRate?: number, priceAsOf?: string): string {
  const parts = [tenge(price)];
  if (vatRate !== undefined) parts.push(`в том числе НДС ${NUMBER.format(vatRate)}%`);
  if (priceAsOf) parts.push(`цена на ${shortDate(priceAsOf)}`);
  return parts.join(', ');
}

/** Дата без года: клиенту важно «на когда», а не архивная точность. */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat('ru-KZ', { day: '2-digit', month: '2-digit' }).format(date);
}

/**
 * Слова, которыми список заявок называет дату и состав.
 *
 * Рядом с экраном, а не в общем `shared/format`: «4 сентября» нужно
 * только здесь. В остальном кабинете дата стоит короткой — «04.09», —
 * и подпись «Заявка от 04.09» читается номером, а не днём.
 */
const DAY = new Intl.DateTimeFormat('ru-KZ', { day: 'numeric', month: 'long' });

/** День без года: заявки живут неделями, и год в подписи — лишний шум. */
export function orderDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DAY.format(date);
}

/**
 * Сколько позиций в заявке.
 *
 * Со склонением, а не «6 поз.»: сокращение экономит четыре буквы и стоит
 * того, что человек читает строку дважды.
 */
export function positions(count: number): string {
  const tail = count % 10;
  const hundred = count % 100;

  if (tail === 1 && hundred !== 11) return `${count} позиция`;
  if (tail >= 2 && tail <= 4 && (hundred < 12 || hundred > 14)) return `${count} позиции`;
  return `${count} позиций`;
}

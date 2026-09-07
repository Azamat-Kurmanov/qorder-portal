import { intlLocale } from '../../i18n';

/**
 * Слова, которыми список заявок называет дату.
 *
 * Рядом с экраном, а не в общем `shared/format`: «4 сентября» нужно
 * только здесь. В остальном кабинете дата стоит короткой — «04.09», —
 * и подпись «Заявка от 04.09» читается номером, а не днём.
 *
 * Формат считается на каждый вызов: язык меняют в работающем кабинете,
 * а название месяца у каждого языка своё.
 */

/** День без года: заявки живут неделями, и год в подписи — лишний шум. */
export function orderDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long' }).format(date);
}

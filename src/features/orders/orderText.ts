import { dayMonth } from '../../shared/format';
import { intlLocale } from '../../i18n';
import type { TFunction } from 'i18next';
import type { SnapshotLineDto } from '../../api/generated';
import { quantityWithUnit } from '../../shared/units';

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
  return dayMonth(iso);
}

/**
 * «Продавец ответит сегодня до 15:30» — пока ход за продавцом. Без неё
 * клиент не знает, ждать или звонить; сервер не присылает прошедший срок.
 */
export function answerExpectedText(iso: string, t: TFunction): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(date);
  const today = new Date().toDateString() === date.toDateString();
  return t('orders.answerBy', { day: today ? t('orders.v2.today') : orderDay(iso), time });
}

/**
 * Штуки оптовой строки: « · 60 мешков», а у снятой с продажи позиции,
 * единица штук которой уже неизвестна, — « · по 50». У штучной строки пусто.
 */
export function packNote(line: SnapshotLineDto, t: TFunction): string {
  if (!line.packQty) return '';
  return ` · ${line.pieceUnit
    ? quantityWithUnit(line.quantity * line.packQty, line.pieceUnit)
    : t('cart.wholesale.pack', { amount: line.packQty })}`;
}

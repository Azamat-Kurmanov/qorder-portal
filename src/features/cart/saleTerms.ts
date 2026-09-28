import type { ItemSaleTerms } from '../../api/generated';

/**
 * Минимум и кратность продавца — одно правило на витрину, карточку и корзину.
 *
 * Сервер держит то же правило и отклоняет количество, которое ему
 * не отвечает; здесь оно нужно, чтобы кнопки «+» и «−» и первое нажатие
 * «В корзину» сразу набирали допустимое, а не получали отказ.
 *
 * `terms` может не прийти вовсе — у ответа старого сервера его нет, — и тогда
 * позиция продаётся как всегда: от одной единицы и любым количеством.
 */

/** Шаг «+» и «−»: кратность или одна единица. */
export function stepOf(terms: ItemSaleTerms | undefined): number {
  return terms?.quantityStep ?? 1;
}

/** Сколько кладёт первое нажатие: минимум, поднятый до кратности. */
export function firstQuantity(terms: ItemSaleTerms | undefined): number {
  return fitQuantity(terms?.minQuantity ?? stepOf(terms), terms);
}

/**
 * Ближайшее допустимое количество не меньше набранного: не ниже минимума
 * и кратное шагу. Ноль и меньше — «убрать строку».
 */
export function fitQuantity(quantity: number, terms: ItemSaleTerms | undefined): number {
  if (!(quantity > 0)) return 0;
  const step = stepOf(terms);
  const atLeast = Math.max(quantity, terms?.minQuantity ?? 0);
  // Округление до десятитысячных гасит хвосты двоичной арифметики:
  // 0,1 × 3 иначе оказывалось бы чуть больше 0,3 и уходило бы на шаг выше.
  const steps = Math.ceil(Number((atLeast / step).toFixed(4)));
  return Number((steps * step).toFixed(4));
}

/** «−»: на шаг меньше, а ниже минимума — строка убирается целиком. */
export function lessQuantity(current: number, terms: ItemSaleTerms | undefined): number {
  const next = Number((current - stepOf(terms)).toFixed(4));
  return next < firstQuantity(terms) ? 0 : next;
}

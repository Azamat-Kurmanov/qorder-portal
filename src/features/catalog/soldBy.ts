import type { TFunction } from 'i18next';
import type { ItemSaleTerms } from '../../api/generated';
import { quantityWithUnit } from '../../shared/units';

/**
 * Штучная ли единица. Продавец пишет единицу свободным текстом, и «шт»,
 * «шт.», «штука» и «pcs» для клиента значат одно и то же — поэтому
 * сравнение по списку написаний, а не по точной строке. Незнакомая
 * единица штучной не считается: «поштучно» про мешок было бы неправдой.
 */
const PIECE = /^(шт\.?|штук[аи]?|pcs?\.?|pieces?|дана)$/i;

export function isPieceUnit(unit: string): boolean {
  return PIECE.test(unit.trim());
}

/**
 * Как продаётся товар: «Продаётся поштучно», «Продаётся по 6 бутылок»,
 * «Продаётся в единицах «кг»». Выводится из того, что продавец уже указал
 * (единица и кратность), — отдельного поля для этого нет, и придумывать
 * его экран не вправе.
 *
 * `pill` — строка для пилюли у наличия; `value` — значение строки
 * «Продаётся» в характеристиках. Пилюля — только при кратности 1 и без
 * минимума: иначе рядом уже стоят «Заказ от…» и «Продаём по…», и третья
 * пилюля о том же спорила бы с ними («поштучно», но «от 10 шт.»).
 */
export function soldByOf(unit: string, terms: ItemSaleTerms | undefined, t: TFunction) {
  const step = terms?.quantityStep ?? 1;
  const least = terms?.minQuantity ?? 1;
  const piece = isPieceUnit(unit);
  const value = step > 1
    ? t('item.soldBy.stepValue', { amount: quantityWithUnit(step, unit) })
    : piece
      ? t('item.soldBy.pieceValue')
      : t('item.soldBy.unitValue', { unit });
  const pill = step <= 1 && least <= 1
    ? (piece ? t('item.soldBy.piece') : t('item.soldBy.unit', { unit }))
    : undefined;
  return { value, pill };
}

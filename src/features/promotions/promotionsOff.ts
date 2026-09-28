import type { PortalPromotionsDto } from '../../api/generated';

/**
 * У магазина не включена ни одна акция: нет распродажи, порогов «оптом
 * дешевле», скидки на первую заявку и подписки.
 *
 * Одно правило на экран акций и на меню: страница говорит «акций нет»
 * ровно тогда, когда раздел пропадает из меню, — иначе меню вело бы
 * на пустую страницу, а продавец в предпросмотре читал бы неправду.
 */
export function promotionsOff(data: PortalPromotionsDto): boolean {
  return !data.sale && data.volumeTiers.length === 0 && !data.firstOrder && !data.subscription;
}

import type { TFunction } from 'i18next';
import type { DeliveryOptionsDto, PortalPromotionsDto } from '../../api/generated';
import type { Currency } from '../../shared/currency';
import { money, shortDate } from '../../shared/format';

/**
 * Строки полосы объявлений (Вспышка, Лукбук, Сезон) — из настоящих условий
 * магазина, по порядку: распродажа, бесплатная доставка, скидка за объём,
 * скидка на первую заявку. Чего у магазина нет, того в полосе нет: выдуманное
 * условие — обещание от имени продавца.
 */
export function announceMessages(
  { promotions, delivery, currency }: { promotions?: PortalPromotionsDto; delivery?: DeliveryOptionsDto; currency?: Currency },
  t: TFunction,
): string[] {
  const lines: string[] = [];
  const sale = promotions?.sale;
  if (sale) {
    lines.push(sale.endsOn
      ? t('shell.announce.saleUntil', { title: sale.title, date: shortDate(sale.endsOn) })
      : t('shell.announce.sale', { title: sale.title, percent: sale.maxPercent }));
  }
  const free = (delivery?.methods ?? [])
    .map((method) => method.freeFromAmount)
    .filter((amount): amount is number => amount !== undefined && amount > 0);
  if (free.length > 0) lines.push(t('shell.announce.freeDelivery', { amount: money(Math.min(...free), currency) }));
  const tiers = promotions?.volumeTiers ?? [];
  const tier = tiers[tiers.length - 1];
  if (tier) lines.push(t('shell.announce.volume', { percent: tier.percent, amount: money(tier.from, currency) }));
  if (promotions?.firstOrder?.status === 'ELIGIBLE') {
    lines.push(t('shell.announce.firstOrder', { percent: promotions.firstOrder.percent }));
  }
  return lines;
}

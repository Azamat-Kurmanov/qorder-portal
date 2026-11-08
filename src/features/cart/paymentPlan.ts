/** Кому клиент платит отдельно, мимо продавца. */
export interface SeparatePayment {
  kind: 'carrier' | 'loaders';
  /** Имя перевозчика — из списка продавца или вписанное клиентом. */
  name?: string;
  /** Пусто — сумму назовёт перевозчик или продавец. */
  amount?: number;
}

export interface PaymentPlan {
  /** Продавцу — то, что в «Итого». */
  seller: number;
  /** Что продавец добавит к своей сумме при проверке: сейчас её не посчитать. */
  sellerLater: Array<'delivery' | 'loaders'>;
  separate: SeparatePayment[];
  /** Всего за заказ: продавцу и всем напрямую — то, что известно сейчас. */
  grand: number;
  /** Часть сумм неизвестна — «всего» не меньше `grand`. */
  approximate: boolean;
}

/**
 * Сколько и кому платить — из итогов оформления.
 * Неизвестная сумма — не ноль: она попадает в «уточнят» и делает итог приблизительным.
 */
export function paymentPlan(totals: {
  total: number;
  shipping?: number;
  direct: boolean;
  loaders?: { amount?: number; direct: boolean };
}, carrierName?: string): PaymentPlan {
  const { total, shipping, direct, loaders } = totals;
  const sellerLater: PaymentPlan['sellerLater'] = [];
  if (!direct && shipping === undefined) sellerLater.push('delivery');
  if (loaders && !loaders.direct && loaders.amount === undefined) sellerLater.push('loaders');

  const separate: SeparatePayment[] = [];
  if (direct) separate.push({ kind: 'carrier', name: carrierName || undefined, amount: shipping });
  if (loaders?.direct) separate.push({ kind: 'loaders', amount: loaders.amount });

  const grand = total + separate.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
  const approximate = sellerLater.length > 0 || separate.some((payment) => payment.amount === undefined);
  return { seller: total, sellerLater, separate, grand, approximate };
}

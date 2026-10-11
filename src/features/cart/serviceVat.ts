/** Режим НДС доставки или грузчиков — как его отдаёт способ доставки. */
export type VatMode = 'NONE' | 'ON_TOP' | 'INCLUDED';

/** Деньги — как на сервере: два знака, половина вверх. */
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * НДС доставки или грузчиков при оформлении — той же формулой, что
 * `VatMath.breakdown` на сервере: каждая услуга округляется отдельно,
 * поэтому «К оплате» совпадает с итогом заявки до тиына.
 *
 * `vat` — налог услуги (для подписи), `onTop` — сколько он прибавляет к итогу:
 * налог «внутри» уже сидит в тарифе.
 */
export function serviceVat(amount: number, rate: number | undefined, mode: VatMode | undefined) {
  if (rate === undefined || amount <= 0 || !mode || mode === 'NONE') return { vat: 0, onTop: 0 };
  if (mode === 'ON_TOP') {
    const vat = round((amount * rate) / 100);
    return { vat, onTop: vat };
  }
  return { vat: round((amount * rate) / (100 + rate)), onTop: 0 };
}

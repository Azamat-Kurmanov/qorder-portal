import { useTranslation } from 'react-i18next';
import type { CartDto } from '../../api/generated';
import { decimal, money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { isPieceUnit } from '../catalog/soldBy';
import { useCountUp } from '../../ui/motion/useCountUp';

/**
 * Подпись строки «Товары» по макету «Каталог v2».
 *
 * Штуки складываются, только когда штучные все строки: «5 мешков и 3 штуки»
 * в сумме не дают «8 шт.», и такое число врало бы о заказанном. Тогда
 * считаются строки — «3 позиции».
 */
function goodsLabel(cart: CartDto, t: ReturnType<typeof useTranslation>['t']): string {
  const lines = cart.lines;
  if (lines.length > 0 && lines.every((line) => isPieceUnit(line.unit))) {
    const pieces = lines.reduce((sum, line) => sum + line.quantity, 0);
    return t('cart.goodsPieces', { amount: decimal(pieces) });
  }
  return t('checkout.summary.goodsCount', { count: lines.length });
}

/**
 * Ставка для строки «в т.ч. НДС 16%»: только когда она у всех строк одна.
 * При разных ставках процент в подписи был бы неправдой о части товаров,
 * и строка остаётся без него — сумма всё равно верная, сервер сложил её
 * по ставкам.
 */
function commonVatRate(cart: CartDto): number | undefined {
  const rates = new Set(cart.lines.map((line) => line.vatRate ?? null));
  if (rates.size !== 1) return undefined;
  const [rate] = rates;
  return rate ?? undefined;
}

/** «Товары, 5 шт.» — сумма строк до скидки на заявку. */
export function GoodsLine({ cart, className }: { cart: CartDto; className?: string }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  // Сумма досчитывается до новой — видно, что позиция легла в заявку.
  const goods = useCountUp(cart.goodsTotal ?? cart.total);
  return (
    <div className={className ?? 'flex justify-between gap-2 text-body text-ink-muted'} data-testid="cart-goods">
      <span>{goodsLabel(cart, t)}</span>
      <span data-testid="goods-total" className="tabular-nums text-ink">
        {money(goods, currency)}
      </span>
    </div>
  );
}

/**
 * «в т.ч. НДС 16%» — налог внутри суммы к оплате за товары, как его напишет
 * счёт. Сумму считает сервер: округление и раскладка скидки по ставкам
 * должны совпасть со счётом до тиына, а второй расчёт в браузере однажды
 * разошёлся бы с ним. Нет суммы — нет и строки: «НДС 0 тенге» читалось бы
 * как нулевая ставка, а не как «поставщик ставку не ведёт».
 *
 * Продавец не плательщик — строка остаётся, но говорит «без НДС»: пустое
 * место на месте налога читалось бы как «забыли посчитать», а не как
 * «налога нет».
 */
export function VatLine({ cart }: { cart: CartDto }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  if (!cart.vatPayer) {
    return (
      <div className="flex justify-between gap-2 text-body text-ink-muted" data-testid="cart-vat">
        <span>{t('cart.noVat')}</span>
      </div>
    );
  }
  if (cart.vatAmount == null) return null;
  const rate = commonVatRate(cart);
  return (
    <div className="flex justify-between gap-2 text-body text-ink-muted" data-testid="cart-vat">
      <span>{rate === undefined ? t('cart.vat') : t('cart.vatRate', { rate: decimal(rate) })}</span>
      <span className="tabular-nums text-ink">{money(cart.vatAmount, currency)}</span>
    </div>
  );
}

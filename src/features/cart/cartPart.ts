import type { CartDto, CartLineDto } from '../../api/generated';
import type { SaleMode } from './ModeSwitch';
import { useOrderMode } from './orderMode';
import { cartOf, useCart } from './useCart';
import { useUnpicked } from './cartPick';

/**
 * В какой заявке строка — то же правило, что у сервера (`PortalOrderServiceImpl.modeOf`):
 * выбранный режим у товара «оптом и в розницу», иначе упаковки — оптовая, штуки — розничная.
 */
export function lineMode(line: CartLineDto): SaleMode {
  return line.mode ?? (line.split ? 'WHOLESALE' : 'RETAIL');
}

/** Строка корзины однозначно: у товара «оптом и в розницу» строк две — розничная и оптовая. */
export function lineKey(line: CartLineDto): string {
  return `${line.itemId}:${lineMode(line)}`;
}

/**
 * Строка позиции в заявке `mode`. У товара «оптом и в розницу» строк до двух — розничная и оптовая
 * (у них есть `mode`); у остальных одна, без режима. Режим не задан — первая строка позиции.
 */
export function lineOf(cart: CartDto | undefined, itemId: string, mode?: SaleMode): CartLineDto | undefined {
  return cart?.lines.find((line) => line.itemId === itemId && (mode === undefined || !line.mode || line.mode === mode));
}

/** Позиции, взятые в заявку `mode`: розничная строка не делает товар «взятым» в опте, и наоборот. */
export function takenIn(cart: CartDto | undefined, mode: SaleMode): Set<string> {
  return new Set((cart?.lines ?? []).filter((line) => !line.mode || line.mode === mode).map((line) => line.itemId));
}

/**
 * Корзина одной заявки: оптовая и розничная заявки раздельные («Вариант Б», решение владельца
 * 2026-11-04). Пока в корзине строки одного вида, она отдаётся как есть — со скидками и НДС
 * сервера. Когда видов два — строки выбранного, итог — их сумма.
 */
export function partOf(cart: CartDto, mode: SaleMode): CartDto {
  return subset(cart, cart.lines.filter((line) => lineMode(line) === mode));
}

/** Корзина из части строк: итог — их сумма. */
function subset(cart: CartDto, lines: CartLineDto[]): CartDto {
  // ponytail: скидка на заявку и НДС у части не пересчитываются — сервер считает их при отправке;
  // точные числа части — отдельной ручкой корзины, если клиенты начнут путаться.
  const sum = lines.reduce((total, line) => total + (line.total ?? 0), 0);
  return { ...cart, lines, goodsTotal: sum, total: sum, saleSavings: 0, discount: undefined, nextTier: undefined, vatAmount: undefined };
}

/**
 * Корзина текущей заявки, её вид и сколько строк в каждой из двух.
 *
 * `shown` — все строки открытой заявки, их список с галочками; `cart` — только отмеченные:
 * их итог и оформление. Не всё положенное клиент заказывает сейчас — остальное ждёт в корзине.
 */
export function useCartPart(active = true) {
  const full = cartOf(useCart(active).data);
  const [mode, setMode] = useOrderMode();
  const pick = useUnpicked();
  const counts = { WHOLESALE: 0, RETAIL: 0 };
  for (const line of full?.lines ?? []) counts[lineMode(line)] += 1;
  const split = counts.WHOLESALE > 0 && counts.RETAIL > 0;
  // Строки одного вида — та заявка и открыта, даже если в каталоге выбран другой способ.
  const part: SaleMode | undefined = split ? mode : counts.WHOLESALE > 0 ? 'WHOLESALE' : counts.RETAIL > 0 ? 'RETAIL' : undefined;
  const shown = full && split ? partOf(full, mode) : full;
  const picked = (shown?.lines ?? []).filter((line) => !pick.off.has(lineKey(line)));
  // Отмечено всё — корзина как есть, со скидками и НДС сервера.
  const some = shown !== undefined && picked.length < shown.lines.length;
  return {
    cart: shown && some ? subset(shown, picked) : shown,
    shown,
    /** Позиции, отмеченные галочками, — пусто, когда отмечено всё (уходит вся заявка). */
    itemIds: some ? picked.map((line) => line.itemId) : undefined,
    pick,
    part,
    split,
    counts,
    setMode,
  };
}

import type { TFunction } from 'i18next';
import type { DeliveryLoaders, SubmitOrderDelivery } from '../../api/generated';
import type { Currency } from '../../shared/currency';
import { money } from '../../shared/format';

/** Строка корзины для грузчиков: количество и вес единицы, кг. */
export interface LoadersLine {
  quantity: number;
  unitWeightKg?: number | null;
}

/** Сумма или причина, по которой её уточнит продавец. */
export interface LoadersQuote {
  amount?: number;
  unknown?: 'NEGOTIABLE' | 'FLOOR_MISSING' | 'WEIGHT_MISSING';
}

/**
 * Погрешность деления: 0.1 × 3 / 0.3 в двоичной дроби чуть больше единицы,
 * и без поправки шаг округлился бы вверх до двух.
 */
const EPSILON = 1e-9;

/**
 * Сумма грузчиков для предпросмотра — зеркало `LoadersPricing` сервера.
 *
 * Только предпросмотр: в заявку сумма попадает из расчёта сервера.
 * Неизвестная сумма — не ноль: ноль был бы обещанием грузить даром.
 */
export function loadersPrice(
  loaders: DeliveryLoaders,
  lines: LoadersLine[],
  floor: number | undefined,
  hasLift: boolean,
): LoadersQuote {
  switch (loaders.tariff) {
    case 'FREE':
      return { amount: 0 };
    case 'FIXED':
      return { amount: loaders.amount ?? 0 };
    case 'PER_FLOOR': {
      if (floor === undefined || floor === null) return { unknown: 'FLOOR_MISSING' };
      if (floor <= 1) return { amount: 0 };
      return { amount: (hasLift ? loaders.liftAmount ?? 0 : loaders.amount ?? 0) * floor };
    }
    case 'PER_UNITS': {
      const units = lines.reduce((sum, line) => sum + line.quantity, 0);
      return { amount: steps(units, loaders.step) * (loaders.amount ?? 0) };
    }
    case 'PER_WEIGHT': {
      if (lines.some((line) => line.unitWeightKg == null)) return { unknown: 'WEIGHT_MISSING' };
      const kilograms = lines.reduce((sum, line) => sum + line.quantity * (line.unitWeightKg ?? 0), 0);
      return { amount: steps(kilograms, loaders.step) * (loaders.amount ?? 0) };
    }
    default:
      return { unknown: 'NEGOTIABLE' };
  }
}

function steps(total: number, step: number | undefined): number {
  if (!step || step <= 0) return 0;
  return Math.max(0, Math.ceil(total / step - EPSILON));
}

/** Грузчики, которые клиент выбрал на оформлении: сумма и «напрямую». */
export function chosenLoaders(
  loaders: DeliveryLoaders | undefined,
  value: SubmitOrderDelivery,
  lines: LoadersLine[],
): { amount?: number; direct: boolean } | undefined {
  if (!loaders || loaders.mode !== 'ON_REQUEST' || value.loaders !== true) return undefined;
  const quote = loadersPrice(loaders, lines, value.floor, value.hasLift === true);
  return { amount: quote.amount, direct: loaders.payee === 'DIRECT' };
}

/** Условия грузчиков способа одной фразой — для «Условий доставки» и подсказки на оформлении. */
export function loadersTerms(
  loaders: DeliveryLoaders | undefined,
  t: TFunction,
  currency: Currency | undefined,
): string | null {
  if (!loaders || loaders.mode === 'NONE') return null;
  if (loaders.mode === 'INCLUDED') return t('delivery.loaders.INCLUDED');
  const text = t(`delivery.loaders.${loaders.tariff ?? 'NEGOTIABLE'}`, {
    amount: money(loaders.amount ?? 0, currency),
    lift: money(loaders.liftAmount ?? 0, currency),
    step: loaders.step ?? 0,
  });
  return loaders.payee === 'DIRECT' ? `${text}, ${t('delivery.loaders.direct')}` : text;
}

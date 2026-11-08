/** Правило количества товара: не меньше минимума и кратно шагу — то же, что проверяет корзина. */
export interface QuantityRule {
  min?: number | null;
  step?: number | null;
}

const EPSILON = 1e-9;

/** Первое количество, которое примет корзина: минимум, поднятый до кратного шагу. */
export function firstValid({ min, step }: QuantityRule): number {
  const least = Math.max(min ?? 0, step ?? 0, step ? 0 : 1);
  return step ? Math.ceil(least / step - EPSILON) * step : least;
}

/** Что не так с количеством; пусто — подходит. */
export function quantityProblem(value: number, { min, step }: QuantityRule): 'invalid' | 'min' | 'step' | null {
  if (!Number.isFinite(value) || value <= 0) return 'invalid';
  if (min && value < min - EPSILON) return 'min';
  if (step) {
    const ratio = value / step;
    if (Math.abs(ratio - Math.round(ratio)) > EPSILON) return 'step';
  }
  return null;
}

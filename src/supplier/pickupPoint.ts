import { useSyncExternalStore } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { currentSupplierId } from './supplier';

/**
 * Точка самовывоза, выбранная клиентом в шапке: по её складу витрина и корзина считают
 * наличие. Хранится в браузере отдельно для каждого продавца; без хранилища (частное окно) —
 * в памяти до перезагрузки. На сервер уходит заголовком X-Pickup-Point из api/client.
 */
const PREFIX = 'qo.portal.pickupPoint.';
const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();

function key(): string | null {
  const supplier = currentSupplierId();
  return supplier ? PREFIX + supplier : null;
}

export function currentPickupPoint(): string | null {
  const k = key();
  if (!k) return null;
  if (memory.has(k)) return memory.get(k) ?? null;
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

export function setPickupPoint(id: string | null): void {
  const k = key();
  if (!k) return;
  memory.set(k, id);
  try {
    if (id === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, id);
  } catch {
    // Хранилище недоступно: выбор живёт в памяти до перезагрузки.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Перезапрос витрины, карточки и корзины: их наличие зависит от точки. */
export function refetchStockViews(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    predicate: (query) => /^\/api\/portal\/(catalog|cart)/.test(String(query.queryKey[0] ?? '')),
  });
}

/** Выбранная точка и её смена; {@code onChange} — после смены (перезапрос наличия). */
export function usePickupPoint(onChange?: () => void): [string | null, (id: string | null) => void] {
  const value = useSyncExternalStore(subscribe, currentPickupPoint, () => null);
  return [value, (id) => {
    if (id === currentPickupPoint()) return;
    setPickupPoint(id);
    onChange?.();
  }];
}

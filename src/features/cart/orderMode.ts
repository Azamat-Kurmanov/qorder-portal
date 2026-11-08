import { useSyncExternalStore } from 'react';
import { useSupplier } from '../../supplier/useSupplier';
import type { SaleMode } from './ModeSwitch';

/**
 * Как клиент заказывает в этом магазине — «Оптом» или «В розницу» («Вариант Б», решение владельца
 * 2026-11-04): каталог, карточка и корзина живут в одном режиме, оптовая и розничная заявки
 * раздельные. Выбор помнится по магазину на этом устройстве.
 */
const KEY = 'qo.orderMode.';
const listeners = new Set<() => void>();

function read(supplierId: string | null): SaleMode {
  try {
    // По умолчанию — «В розницу», как и прежде у карточки товара.
    return localStorage.getItem(KEY + (supplierId ?? '')) === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
  } catch {
    return 'RETAIL';
  }
}

export function setOrderMode(supplierId: string | null, mode: SaleMode) {
  try {
    localStorage.setItem(KEY + (supplierId ?? ''), mode);
  } catch {
    // Без хранилища выбор живёт до перезагрузки — как и раньше жил отбор каталога.
  }
  listeners.forEach((listener) => listener());
}

export function useOrderMode(): [SaleMode, (mode: SaleMode) => void] {
  const { supplierId } = useSupplier();
  const mode = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => read(supplierId),
  );
  return [mode, (next) => setOrderMode(supplierId, next)];
}

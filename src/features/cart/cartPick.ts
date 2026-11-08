import { useSyncExternalStore } from 'react';
import { useSupplier } from '../../supplier/useSupplier';

/**
 * Какие строки корзины клиент снял галочкой: положил «на потом», а в заявку сейчас не берёт.
 * Хранятся снятые, а не отмеченные — новая позиция в корзине сразу идёт в заявку.
 * Помнится по магазину на этом устройстве, как и выбранная заявка (`orderMode`).
 */
const KEY = 'qo.cartUnpicked.';
const listeners = new Set<() => void>();

function raw(supplierId: string | null): string {
  try {
    return localStorage.getItem(KEY + (supplierId ?? '')) ?? '[]';
  } catch {
    return '[]';
  }
}

function write(supplierId: string | null, keys: string[]) {
  try {
    localStorage.setItem(KEY + (supplierId ?? ''), JSON.stringify(keys));
  } catch {
    // Без хранилища галочки живут до перезагрузки страницы.
  }
  listeners.forEach((listener) => listener());
}

/** Снятые строки (ключи `lineKey`) и как их менять. */
export function useUnpicked() {
  const { supplierId } = useSupplier();
  const json = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => raw(supplierId),
  );
  const off = new Set<string>(JSON.parse(json) as string[]);
  return {
    off,
    /** Поставить или снять галочку у строки. */
    toggle: (key: string) => {
      if (off.has(key)) off.delete(key); else off.add(key);
      write(supplierId, [...off]);
    },
    /** Отметить все строки (`keys` пусто) или снять все `keys`. */
    set: (keys: string[]) => write(supplierId, keys),
  };
}

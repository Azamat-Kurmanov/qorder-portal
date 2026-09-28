import { useSyncExternalStore } from 'react';

/**
 * Какие магазины клиент закрепил и какие открывал недавно.
 *
 * Хранится в браузере, а не на сервере: сервер знает, у кого клиент
 * покупает, но не знает, к кому он ходит чаще. Это удобство одного
 * устройства, а не сведения о клиенте, — и потерять его (приватный режим,
 * чистка данных сайта) значит увидеть список по алфавиту, а не сломать
 * кабинет.
 *
 * Состояние одно на вкладку и раздаётся подпиской: блок «Мои магазины»
 * в колонке и окно со всеми магазинами обязаны показывать одну и ту же
 * звёздочку, иначе закреплённый в окне магазин не появится в колонке.
 */

const STORAGE_KEY = 'qo.portal.shops';

/** Сколько недавних помнить: больше, чем помещается в колонку, но не весь список. */
const RECENT_LIMIT = 6;

export interface ShopMemory {
  pinned: string[];
  recent: string[];
}

const EMPTY: ShopMemory = { pinned: [], recent: [] };

let state: ShopMemory = read();
const listeners = new Set<() => void>();

function read(): ShopMemory {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ShopMemory>;
    return {
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned.filter((id) => typeof id === 'string') : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    return EMPTY;
  }
}

function write(next: ShopMemory): void {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Хранилище недоступно: память живёт до конца вкладки.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Магазин открыт — он становится первым среди недавних. */
export function rememberVisit(supplierId: string): void {
  const recent = [supplierId, ...state.recent.filter((id) => id !== supplierId)].slice(0, RECENT_LIMIT);
  write({ ...state, recent });
}

/** Закрепить или открепить: закреплённый встаёт первым. */
export function togglePin(supplierId: string): void {
  const pinned = state.pinned.includes(supplierId)
    ? state.pinned.filter((id) => id !== supplierId)
    : [supplierId, ...state.pinned];
  write({ ...state, pinned });
}

export function useShopMemory(): ShopMemory {
  return useSyncExternalStore(subscribe, () => state);
}

/** Для проверок: начать с чистой памяти. */
export function resetShopMemory(): void {
  write(EMPTY);
}

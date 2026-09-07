import { createContext } from 'react';

/** Поставщик, с которым клиент работает прямо сейчас. */
export interface SupplierContextValue {
  supplierId: string | null;
  /**
   * Сменить поставщика: кеш запросов при этом сбрасывается целиком.
   *
   * `null` — забыть выбор. Нужен он тогда, когда выбранный поставщик исчез
   * из списка: пока выбор жив, он уходит заголовком в каждом запросе, и
   * каждый получает отказ.
   */
  select: (supplierId: string | null) => void;
}

export const SupplierContext = createContext<SupplierContextValue | null>(null);

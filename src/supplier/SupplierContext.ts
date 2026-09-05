import { createContext } from 'react';

/** Поставщик, с которым клиент работает прямо сейчас. */
export interface SupplierContextValue {
  supplierId: string | null;
  /** Сменить поставщика: кеш запросов при этом сбрасывается целиком. */
  select: (supplierId: string) => void;
}

export const SupplierContext = createContext<SupplierContextValue | null>(null);

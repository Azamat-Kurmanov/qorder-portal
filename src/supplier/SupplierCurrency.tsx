import { createContext, useContext, type ReactNode } from 'react';
import { useGetPortalSuppliers } from '../api/generated';
import type { Currency } from '../shared/currency';
import { useSupplier } from './useSupplier';

/** Валюта открытого магазина; вне скоупа или до ответа списка поставщиков — `undefined`. */
export const SupplierCurrencyContext = createContext<Currency | undefined>(undefined);

/**
 * Валюта магазина — на весь кабинет.
 *
 * Список поставщиков тот же, что у оформления (`SupplierTheme.tsx`) и
 * раскладки шаблона (`useCabinetDesign`) — новых запросов нет, кеш общий.
 *
 * Пока список не пришёл или текущего поставщика в нём нет, валюта —
 * `undefined`: суммы в это время выводятся числом без знака (`money`),
 * а не тенге по умолчанию — магазин мог оказаться в любой валюте.
 */
export function SupplierCurrencyScope({ children }: { children: ReactNode }) {
  const { supplierId } = useSupplier();
  const suppliers = useGetPortalSuppliers();
  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];
  const current = list.find((supplier) => supplier.supplierId === supplierId);

  return (
    // Поставщик есть, а валюты нет — бэкенд старше валют: тогда все магазины
    // торговали в тенге, и знак не пропадает, если портал выкатят раньше.
    <SupplierCurrencyContext.Provider value={current ? (current.currency ?? 'KZT') : undefined}>
      {children}
    </SupplierCurrencyContext.Provider>
  );
}

/** Валюта ближайшего `SupplierCurrencyScope`. */
export function useSupplierCurrency(): Currency | undefined {
  return useContext(SupplierCurrencyContext);
}

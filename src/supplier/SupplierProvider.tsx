import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SupplierContext, type SupplierContextValue } from './SupplierContext';
import { currentSupplierId, setCurrentSupplierId } from './supplier';

interface SupplierProviderProps {
  children: ReactNode;
}

/**
 * Выбранный поставщик — на всё приложение.
 *
 * Смена сбрасывает кеш запросов целиком, а не сливает данные: каталог второго
 * поставщика — другой каталог, и показать объединение двух витрин значит
 * предложить заказать у одного то, что есть у другого.
 */
export function SupplierProvider({ children }: SupplierProviderProps) {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState<string | null>(currentSupplierId);

  const select = useCallback((next: string | null) => {
    setCurrentSupplierId(next);
    setSupplierId(next);
    // Именно clear, а не invalidate: данные прежнего поставщика не должны
    // мелькнуть на экране, пока грузятся новые.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<SupplierContextValue>(() => ({ supplierId, select }), [supplierId, select]);

  return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>;
}

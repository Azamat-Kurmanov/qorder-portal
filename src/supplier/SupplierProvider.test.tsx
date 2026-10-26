import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SupplierProvider } from './SupplierProvider';
import { setCurrentSupplierId } from './supplier';
import { useSupplier } from './useSupplier';

/**
 * Повторный выбор того же поставщика кеш не сбрасывает. Иначе ссылка с
 * `?supplier=` под нагрузкой крутилась без конца: сброс перезапрашивал список,
 * проверка ссылки выбирала снова, и экран висел на «Смотрим, с кем вы работаете…».
 */
describe('выбор поставщика', () => {
  afterEach(() => setCurrentSupplierId(null));

  it('тот же поставщик — без сброса кеша, другой — со сбросом', () => {
    setCurrentSupplierId('s1');
    const queryClient = new QueryClient();
    const clear = vi.spyOn(queryClient, 'clear');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}><SupplierProvider>{children}</SupplierProvider></QueryClientProvider>
    );
    const { result } = renderHook(() => useSupplier(), { wrapper });

    act(() => result.current.select('s1'));
    expect(clear).not.toHaveBeenCalled();

    act(() => result.current.select(null));
    act(() => result.current.select(null));
    expect(clear).toHaveBeenCalledTimes(1);
    expect(result.current.supplierId).toBeNull();
  });
});

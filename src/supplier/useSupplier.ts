import { useContext } from 'react';
import { SupplierContext, type SupplierContextValue } from './SupplierContext';

export function useSupplier(): SupplierContextValue {
  const value = useContext(SupplierContext);
  if (!value) throw new Error('useSupplier вызван вне SupplierProvider');
  return value;
}

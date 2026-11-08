import { createContext, useContext } from 'react';

/** Открыть окно «Мои магазины» из любого экрана оболочки — его держит `Shell`. */
export const OpenShopsContext = createContext<() => void>(() => undefined);

export function useOpenShops(): () => void {
  return useContext(OpenShopsContext);
}

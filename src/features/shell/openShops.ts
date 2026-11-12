import { createContext } from 'react';

/** Открыть окно «Мои магазины» из любого экрана оболочки — его держит `Shell`. */
export const OpenShopsContext = createContext<() => void>(() => undefined);

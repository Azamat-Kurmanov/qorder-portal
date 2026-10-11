import { createContext, useContext, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';

/** Итоговый уровень движения кабинета — атрибут `data-motion` на оболочке. */
export type MotionLevel = 'calm' | 'lively' | 'vivid';
/** Выбор продавца — как в перечислении сервера (`CabinetMotion`). */
export type MotionChoice = 'CALM' | 'LIVELY' | 'VIVID';

/** Что ограничивает движение помимо выбора продавца. */
export interface MotionEnv {
  reduce: boolean;
  saveData: boolean;
  /** Память устройства, ГБ; `undefined` — браузер не сообщает. */
  deviceMemory?: number;
  path: string;
}

const LEVELS: MotionLevel[] = ['calm', 'lively', 'vivid'];
// Корзина, оформление и заказы: там считают деньги, и яркое движение отвлекает.
const MONEY = /^\/(cart|checkout|orders)(\/|$)/;

/**
 * Меньшее из выбора продавца и ограничений: система просит меньше движения —
 * спокойно; экономия трафика, слабое устройство или страница денег — не выше «живо».
 */
export function motionLevel(choice: MotionChoice, env: MotionEnv): MotionLevel {
  if (env.reduce) return 'calm';
  let level = LEVELS.indexOf(choice.toLowerCase() as MotionLevel);
  const weak = env.saveData || (env.deviceMemory !== undefined && env.deviceMemory <= 4);
  if (weak || MONEY.test(env.path)) level = Math.min(level, 1);
  return LEVELS[level];
}

const REDUCE = '(prefers-reduced-motion: reduce)';

function subscribeReduce(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCE);
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
}

const reduceNow = () => !!window.matchMedia?.(REDUCE).matches;

type NavigatorHints = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

/** Уровень для открытой страницы; меняется, когда человек включает «уменьшить движение». */
export function useMotionLevel(choice: MotionChoice): MotionLevel {
  const reduce = useSyncExternalStore(subscribeReduce, reduceNow, () => false);
  const { pathname } = useLocation();
  const hints = navigator as NavigatorHints;
  return motionLevel(choice, {
    reduce,
    saveData: !!hints.connection?.saveData,
    deviceMemory: hints.deviceMemory,
    path: pathname,
  });
}

/** Уровень для кода, который не видит атрибута; вне оболочки — «спокойно». */
export const MotionLevelContext = createContext<MotionLevel>('calm');

export function useMotion(): MotionLevel {
  return useContext(MotionLevelContext);
}

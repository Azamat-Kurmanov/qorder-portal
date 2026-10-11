import { lazy, Suspense, useSyncExternalStore } from 'react';
import type { CabinetBackdropCode } from '../../supplier/cabinetDesign';
import type { MotionLevel } from './motionLevel';

// Частицы — свой холст и цикл кадров: грузятся, только когда их видно.
const Particles = lazy(() => import('./Particles'));

function subscribeHidden(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/**
 * Живой фон кабинета: один фиксированный слой позади содержимого. Вид и
 * скорость — в `index.css` (`.qo-backdrop`, `data-motion` оболочки);
 * анимируются только `transform` и `opacity`. Вкладка в фоне — пауза.
 */
export function Backdrop({ code, level, season = false }: {
  code: CabinetBackdropCode;
  level: MotionLevel;
  /** Сезон: перетекание полосами его цветов, а не цветом магазина. */
  season?: boolean;
}) {
  const hidden = useSyncExternalStore(subscribeHidden, () => document.hidden, () => false);
  if (code === 'NONE') return null;
  return (
    <div aria-hidden="true" className="qo-backdrop" data-backdrop={code.toLowerCase()}
      data-paused={hidden || undefined} data-season={season || undefined}>
      {code === 'PARTICLES' && level === 'vivid' ? <Suspense fallback={null}><Particles /></Suspense> : null}
    </div>
  );
}

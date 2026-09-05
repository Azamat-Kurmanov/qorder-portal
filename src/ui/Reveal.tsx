import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Появление при скролле.
 *
 * Один эффект на весь кабинет: карточка выезжает на десять точек снизу
 * и проявляется, один раз за просмотр. Разные эффекты на разных экранах
 * читаются как разные продукты.
 *
 * `useReducedMotion` — не украшение: требования велят уважать настройку
 * системы, и у человека, которого движение укачивает, карточки обязаны
 * просто появиться.
 */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

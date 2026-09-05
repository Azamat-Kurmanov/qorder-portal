import type { ComponentProps } from 'react';
import { cn } from './cn';

/**
 * Карточка: белая поверхность на кремовом основании.
 *
 * Глубина держится на волосяной линии и смене поверхности, а не на тени —
 * тень, расставленная числами по месту, через месяц перестаёт быть системой.
 * При наведении карточка чуть поднимается: `transition-all duration-300`
 * делает это движением, а не скачком.
 */
export function Card({ className, interactive = false, ...props }: ComponentProps<'div'> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-hairline bg-surface',
        interactive && 'transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_8px_24px_-12px_rgba(60,48,30,.35)]',
        className,
      )}
      {...props}
    />
  );
}

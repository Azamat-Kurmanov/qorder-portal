import { forwardRef } from 'react';
import { Sparkles, type IconProps } from '../../ui/icons';
import { cn } from '../../ui/cn';
import { useUnreadOf } from '../notifications/useReadOnOpen';

/**
 * Значок пункта «Новые поступления». Подсветку держит он сам, а не каждая
 * раскладка меню: значок рисуют все шесть, и любая получает её даром.
 * Подпись рядом красится через `:has()` (index.css).
 */
export const NewArrivalsIcon = forwardRef<SVGSVGElement, IconProps>(function NewArrivalsIcon(
  { className, ...props }, ref,
) {
  // Пока о поступлении есть непрочитанное уведомление, пункт меню зовёт.
  const hot = useUnreadOf('NEW_ARRIVALS').length > 0;
  return (
    <Sparkles ref={ref} {...props} data-hot={hot ? 'true' : undefined}
      className={cn(className, hot && 'qo-arrivals-hot')} />
  );
});

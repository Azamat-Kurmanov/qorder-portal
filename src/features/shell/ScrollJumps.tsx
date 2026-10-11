import { useEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '../../ui/cn';

/** Сколько точек нужно отлистать от края, чтобы стрелка к нему появилась. */
const GAP = 300;

const ROUND = cn(
  'fixed right-4 z-30 flex size-12 cursor-pointer items-center justify-center rounded-full border border-hairline',
  'bg-surface text-ink shadow-float hover:bg-canvas lg:right-8',
  'transition-opacity duration-200 starting:opacity-0',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
);

/**
 * Стрелки «в самый верх» (справа снизу) и «в самый низ» (справа под шапкой).
 * Прыжок сразу, без плавной прокрутки: на длинной витрине плавная тянулась бы
 * секундами. Каждая стрелка видна, только когда до своего края далеко.
 */
export function ScrollJumps({ content }: { content: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation();
  const [far, setFar] = useState({ top: false, bottom: false });

  useEffect(() => {
    const measure = () => {
      const below = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      const next = { top: window.scrollY > GAP, bottom: below > GAP };
      setFar((was) => (was.top === next.top && was.bottom === next.bottom ? was : next));
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    // Страница растёт без прокрутки — догрузились товары: стрелке «вниз» пора появиться.
    // Следим за содержимым, а не за body: у body и #root высота — ровно экран.
    const grows = typeof ResizeObserver === 'undefined' || !content.current ? null : new ResizeObserver(measure);
    if (content.current) grows?.observe(content.current);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      grows?.disconnect();
    };
  }, [content]);

  const jump = (top: number) => window.scrollTo({ top, behavior: 'instant' });

  return (
    <>
      {far.bottom ? (
        <button type="button" aria-label={t('shell.scrollDown')} title={t('shell.scrollDown')}
          className={cn(ROUND, 'top-[calc(var(--header-h)+0.75rem)]')}
          onClick={() => jump(document.documentElement.scrollHeight)}>
          <ArrowDown aria-hidden="true" className="size-6" />
        </button>
      ) : null}
      {far.top ? (
        <button type="button" aria-label={t('shell.scrollUp')} title={t('shell.scrollUp')}
          // На телефоне — над нижним меню, как подсказки оболочки.
          className={cn(ROUND, 'bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-8')}
          onClick={() => jump(0)}>
          <ArrowUp aria-hidden="true" className="size-6" />
        </button>
      ) : null}
    </>
  );
}

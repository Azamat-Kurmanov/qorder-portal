import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';
import type { useCartPart } from './cartPart';

/** Оптовая и розничная заявки раздельные («Вариант Б»): в корзине обе — выбор, какую оформлять. */
export function PartSwitch({ parts }: { parts: ReturnType<typeof useCartPart> }) {
  const { t } = useTranslation();
  if (!parts.split) return null;
  return (
    <div role="radiogroup" aria-label={t('checkout.part.label')} className="flex gap-1.5 rounded-[1.25rem] bg-night p-1.5">
      {(['WHOLESALE', 'RETAIL'] as const).map((value) => (
        <button key={value} type="button" role="radio" aria-checked={parts.part === value}
          onClick={() => parts.setMode(value)}
          className={cn(
            'flex min-h-14 flex-1 flex-col items-center justify-center rounded-[0.9375rem] px-2 leading-tight',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            parts.part === value ? 'bg-surface text-ink' : 'text-night-sub hover:text-white',
          )}>
          <span className="text-body font-extrabold">{t(`checkout.part.${value}`)}</span>
          <span className="text-2xs font-semibold opacity-85">{t('checkout.part.lines', { count: parts.counts[value] })}</span>
        </button>
      ))}
    </div>
  );
}

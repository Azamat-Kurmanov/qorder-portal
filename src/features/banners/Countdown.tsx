import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';

/** Сколько осталось до конца: дни, часы, минуты; раз в минуту. */
export function useTimeLeft(endsAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end) || end <= now) return null;
  const minutes = Math.floor((end - now) / 60_000);
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

/** С какого остатка дней баннер показывает отсчёт. */
export const COUNTDOWN_DAYS = 7;

/**
 * Отсчёт до конца акции — три ячейки, как в макете. Светлые ячейки —
 * на светлом баннере, прозрачные с каймой — на тёмном и цветном.
 */
export function Countdown({ endsAt, tone, small = false }: { endsAt?: string; tone: 'light' | 'dark'; small?: boolean }) {
  const { t } = useTranslation();
  const left = useTimeLeft(endsAt);
  // Отсчёт подгоняет, только когда конец близко: «1437 дней» читалось странно.
  if (!left || left.days > COUNTDOWN_DAYS) return null;
  const cells: [string, string][] = [
    [String(left.days), t('design.days')],
    [String(left.hours).padStart(2, '0'), t('design.hours')],
    [String(left.minutes).padStart(2, '0'), t('design.minutes')],
  ];
  return (
    <span role="timer" aria-label={t('promotions.sale.leftLabel', left)} className="flex shrink-0 gap-1.5">
      {cells.map(([value, label]) => (
        <span
          key={label}
          className={cn(
            'flex flex-col items-center rounded-[min(12px,calc(var(--radius-small)+2px))] leading-none',
            small ? 'min-w-[2.875rem] px-1 py-2' : 'min-w-[3.375rem] px-1.5 py-[9px]',
            tone === 'light'
              ? 'bg-[color-mix(in_srgb,white_88%,var(--color-shop))] text-ink'
              : 'border border-[color-mix(in_srgb,white_20%,var(--color-shop))] bg-[color-mix(in_srgb,#16171A_70%,var(--color-shop))] text-white',
          )}
        >
          <b className={cn('font-bold [font-family:inherit]', small ? 'text-xl' : 'text-2xl')}>{value}</b>
          <span className="mt-[5px] text-2xs opacity-75">{label}</span>
        </span>
      ))}
    </span>
  );
}

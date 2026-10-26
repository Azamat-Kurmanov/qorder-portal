import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../../ui/icons';
import { useWideScreen } from '../../ui/useWideScreen';
import { FestiveScene, isFestiveOccasion } from './FestiveScene';

/**
 * Праздник под шапкой: у каждого повода своя сцена (`FestiveScene`) —
 * снег и гирлянда, букет, орнамент и восход, фонари, волны, школьная
 * доска, чёрная пятница. Уходит сама вместе с праздником: её показывает
 * только `resolveDesign` в дни повода.
 *
 * Спрятать можно до конца дня: праздник длится неделями, а место под
 * шапкой нужно каждый день.
 */
export const OCCASION_HIDDEN_KEY = 'q-order.portal.occasion-hidden';

/** Местная дата: «до конца дня» — по часам покупателя, а не по Гринвичу. */
export function today(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Спрятана ли сцена этого повода сегодня. */
function hiddenToday(occasion: string): boolean {
  try {
    return window.localStorage.getItem(OCCASION_HIDDEN_KEY) === `${occasion}:${today()}`;
  } catch {
    return false;
  }
}

export function OccasionRibbon({ occasion, shop }: { occasion: string; shop?: string }) {
  const { t } = useTranslation();
  const wide = useWideScreen();
  const [hidden, setHidden] = useState(() => hiddenToday(occasion));
  if (hidden || !isFestiveOccasion(occasion)) return null;

  const hide = () => {
    try {
      window.localStorage.setItem(OCCASION_HIDDEN_KEY, `${occasion}:${today()}`);
    } catch {
      // Хранилище запрещено — спрячется до перезагрузки.
    }
    setHidden(true);
  };

  return (
    <section data-testid="occasion-ribbon" aria-label={t(`shell.occasion.${occasion}`)}>
      <FestiveScene
        occasion={occasion}
        compact={!wide}
        title={t(`shell.occasion.${occasion}`)}
        subtitle={shop ? t('shell.occasionFrom', { shop }) : undefined}
        action={(
          <button
            type="button"
            onClick={hide}
            aria-label={t('shell.occasionHide')}
            title={t('shell.occasionHide')}
            className="flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-black/15 text-current backdrop-blur-sm transition-colors hover:bg-black/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </button>
        )}
      />
    </section>
  );
}

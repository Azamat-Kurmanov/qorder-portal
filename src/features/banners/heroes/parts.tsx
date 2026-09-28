import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemThumb } from '../../catalog/ItemThumb';
import { cn } from '../../../ui/cn';

/**
 * Главный баннер витрины в характере шаблона — общие части.
 *
 * Пятнадцать баннеров (`style.hero`) повторяют предпросмотр продавца
 * (`Hero` в `front/src/features/cabinetDesign/CabinetPreview.tsx`), но на
 * настоящих данных: слайд магазина в фирменном цвете или идущая распродажа.
 * Чего у магазина нет — отсчёта, скидки, снимков, — того и на баннере нет:
 * выдуманный отсчёт до конца акции был бы обещанием от имени продавца.
 */

/** Снимок на баннере: картинка слайда или фото товара распродажи. */
export interface HeroImage {
  /** Ключ заглушки: снимка нет — градиент выбирается по нему, а не случайно. */
  id: string;
  src?: string;
}

export interface HeroData {
  /** Надпись над заголовком: «до 30.09», «Новинка». */
  badge?: string;
  title: string;
  text?: string;
  /** Скидка крупно: «−20%»; пусто — скидки на слайде нет. */
  stamp?: string;
  /** Конец акции для отсчёта; пусто — отсчёта нет. */
  endsAt?: string;
  /** Подпись кнопки. */
  button: string;
  /** Снимки: картинка слайда первой, дальше товары распродажи. */
  images: HeroImage[];
  /** Рубрики — кружки историй у баннера «истории». */
  chips: string[];
}

export interface HeroProps {
  data: HeroData;
  /** Узкая колонка: снимки уходят, заголовок мельче. */
  compact: boolean;
  onAction: () => void;
  /** Слайд не на виду: кнопка вне обхода с клавиатуры. */
  hidden?: boolean;
}

/** Тёмные чернила макета — надписи на белой и светлой кнопке. */
export const INK = '#16171A';

/** Заголовок баннера: манера шаблона, кегль по ширине. */
export function heroTitle(compact: boolean, wide = 'text-[2.375rem]', narrow = 'text-[1.625rem]'): string {
  // Кегль раньше интерлиньяжа: `cn` считает кегль и интерлиньяж спорящими
  // и оставляет последний.
  return cn('qo-heading m-0 [text-wrap:balance]', compact ? narrow : wide, 'leading-[1.04]');
}

/** Надпись над заголовком: прописными с разрядкой, по желанию — на подложке. */
export function Eyebrow({ children, className, style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  if (!children) return null;
  return (
    <span
      className={cn('self-start text-caption font-bold uppercase tracking-[0.08em]', className)}
      style={style}
    >
      {children}
    </span>
  );
}

/** Кнопка баннера — настоящая кнопка: ведёт туда, куда настроил продавец. */
export function HeroButton({
  children,
  onClick,
  hidden,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  hidden?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      tabIndex={hidden ? -1 : 0}
      onClick={onClick}
      className={cn(
        'flex h-[2.875rem] max-w-full shrink-0 cursor-pointer items-center gap-2 self-start whitespace-nowrap rounded-[var(--radius-small)] px-5 text-sm font-bold',
        'transition-transform duration-300 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Снимок на баннере: фото товара или слайда, без него — заглушка кабинета. */
export function HeroPhoto({ image, className }: { image: HeroImage | undefined; className?: string }) {
  if (!image) return null;
  return <ItemThumb itemId={image.id} src={image.src} className={cn('w-full', className)} />;
}

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

/**
 * Отсчёт до конца акции — три ячейки, как в макете. Светлые ячейки —
 * на светлом баннере, прозрачные с каймой — на тёмном и цветном.
 */
export function HeroCountdown({ endsAt, tone, small = false }: { endsAt?: string; tone: 'light' | 'dark'; small?: boolean }) {
  const { t } = useTranslation();
  const left = useTimeLeft(endsAt);
  if (!left) return null;
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

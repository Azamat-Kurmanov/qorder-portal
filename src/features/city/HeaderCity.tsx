import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';
import { MapPin } from '../../ui/icons';
import { useAccountCity } from './accountCity';

/**
 * Город клиента в шапке: видно, для какого города считаются доставка и наличие.
 * Ведёт в профиль — там город меняется. Не выбран — ничего: его спросит «Откуда вы?».
 */
/** Город «таблеткой» под заголовком экрана на телефоне — каталог, корзина, заявки. */
export const CITY_CHIP = 'h-9 border-2 border-line bg-surface px-3 text-caption [&_svg]:size-4';

export function HeaderCity({ className, labelClassName }: {
  className?: string;
  /** Для подписи: шапка монитора прячет её на узком экране, оставляя значок. */
  labelClassName?: string;
}) {
  const { t } = useTranslation();
  const { city } = useAccountCity();
  const name = city?.name;
  if (!name) return null;
  return (
    <Link to="/profile" aria-label={t('city.header', { name })} title={t('city.header', { name })}
      className={cn('inline-flex h-11 max-w-[10rem] shrink-0 items-center gap-1.5 rounded-full px-3 text-body font-bold text-ink no-underline',
        'hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', className)}>
      <MapPin aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
      <span className={cn('truncate', labelClassName)}>{name}</span>
    </Link>
  );
}

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Sparkles } from '../../ui/icons';

/** Полоса над витриной: у магазина есть новинки — ссылка в «Новые поступления». */
export function ArrivalsStrip({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  return (
    <Link to="/new-arrivals"
      className="flex items-center gap-3 rounded-[var(--radius-tile)] bg-accent px-4 py-3 text-white no-underline shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
      <Sparkles aria-hidden="true" className="size-5 shrink-0 text-white" />
      <b className="grow text-body">{t('arrivals.strip')} · {t('shell.arrivals', { count })}</b>
      <span className="text-caption font-semibold">{t('arrivals.stripAction')} →</span>
    </Link>
  );
}

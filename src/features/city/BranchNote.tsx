import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetPortalBranch } from '../../api/generated';
import { cn } from '../../ui/cn';
import { MapPin } from '../../ui/icons';

/**
 * «Филиал: Шымкент» — откуда клиент видит наличие (режим магазина «Филиалы»).
 * Ведёт в профиль: там меняется город, а с ним и филиал. Магазин без филиалов — ничего.
 */
export function BranchNote({ className }: { className?: string }) {
  const { t } = useTranslation();
  const query = useGetPortalBranch({ query: { staleTime: 60_000, retry: false } });
  const branch = query.data?.status === 200 ? query.data.data : undefined;
  const name = branch?.placeName || branch?.name;
  if (!name) return null;
  return (
    <Link to="/profile" title={t('city.branchHint')}
      className={cn('inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-ok-soft px-3 text-caption font-bold text-shop-ink no-underline',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', className)}>
      <MapPin aria-hidden="true" className="size-4" />
      {t('city.branch', { name })}
    </Link>
  );
}

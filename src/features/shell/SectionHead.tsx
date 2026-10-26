import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft } from '../../ui/icons';
import { useWideScreen } from '../../ui/useWideScreen';

/**
 * Заголовок раздела из «Ещё» — по макетам кабинета клиента: на телефоне
 * кнопка «Назад» в «Ещё», крупное имя и подпись под ним; на мониторе —
 * прежний заголовок страницы: туда ведёт строка разделов, а не «Ещё».
 */
export function SectionHead({ title, subtitle, back = '/more' }: { title: ReactNode; subtitle?: ReactNode; back?: string }) {
  const { t } = useTranslation();
  const wide = useWideScreen();
  return (
    <header className="flex items-center gap-3">
      {!wide && (
        <Link
          to={back}
          aria-label={t('catalog.back')}
          className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-surface text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ChevronLeft aria-hidden="true" className="size-[1.375rem]" />
        </Link>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <h1 className="qo-page-title max-lg:text-[1.375rem] max-lg:font-black max-lg:tracking-[-0.02em]">{title}</h1>
        {subtitle ? <p className="text-caption text-ink-subtle max-lg:text-[0.8125rem] max-lg:text-ink-muted">{subtitle}</p> : null}
      </span>
    </header>
  );
}

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft } from '../../ui/icons';
import { HOME } from '../../ui/sectionBack';
import { PageHelp } from './HelpGuide';

/**
 * Заголовок раздела из «Всех разделов» — «Вариант Б» канвы: крупная «Назад» на «Главную» (решение владельца 2026-11-05)
 * (на мониторе — с подписью, как в макетах SimplePicWeb*), крупное имя и подпись под ним.
 */
export function SectionHead({ title, subtitle, back = HOME }: { title: ReactNode; subtitle?: ReactNode; back?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3.5">
      <Link to={back} aria-label={t('catalog.back')} className={BACK}>
        <ChevronLeft aria-hidden="true" className="size-7" />
        <span aria-hidden="true" className="hidden lg:inline">{t('common.back')}</span>
      </Link>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 className="m-0 text-title font-extrabold leading-tight text-ink lg:text-display">{title}</h1>
        {subtitle ? <p className="m-0 text-caption text-ink-muted">{subtitle}</p> : null}
      </span>
      <PageHelp />
    </div>
  );
}

/** Крупная «Назад» «Варианта Б»: квадрат на телефоне, на мониторе — с подписью. */
export const BACK = 'flex size-14 shrink-0 items-center justify-center gap-1 rounded-[var(--radius-control)] border-2 border-line bg-surface text-ink text-base font-extrabold no-underline lg:w-auto lg:pl-3 lg:pr-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

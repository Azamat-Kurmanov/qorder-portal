import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from './icons';
import { BACK } from '../features/shell/SectionHead';
import { HOME } from './sectionBack';
import { PageHelp } from '../features/shell/HelpGuide';

/**
 * Заголовок экрана «Варианта Б»: крупная квадратная «Назад», имя экрана и строка под ним.
 * «Назад» у имени раздела всегда ведёт на «Главную» (решение владельца 2026-11-05).
 */
export function BackTitle({ title, subtitle, back = true, to = HOME, action }: {
  title: string;
  /** Куда ведёт «Назад»; по умолчанию — «Главная» магазина. */
  to?: string;
  subtitle?: ReactNode;
  /** Без «Назад» — у экранов из нижнего меню, куда приходят не «вглубь». */
  back?: boolean;
  /** Справа от заголовка — например, «Отбор» в каталоге. */
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3.5 pt-1">
      {back && (
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={() => navigate(to)}
          className={BACK}
        >
          <ChevronLeft aria-hidden="true" className="size-7" />
          <span aria-hidden="true" className="hidden lg:inline">{t('common.back')}</span>
        </button>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <h1 className="m-0 text-title font-extrabold leading-tight text-ink lg:text-display">{title}</h1>
        {subtitle ? <span className="text-caption text-ink-muted">{subtitle}</span> : null}
      </span>
      {action}
      <PageHelp />
    </div>
  );
}

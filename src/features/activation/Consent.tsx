import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import type { ConsentNoticeDto } from '../../api/generated';
import { ConsentNotice } from './ConsentNotice';

type NoticeQuery = {
  data?: { status: number; data: unknown };
  errorUpdateCount: number;
  isFetching: boolean;
  refetch: () => unknown;
};

/**
 * Согласие на обработку данных — одно на /join, /join-shop и активацию.
 * Годно только на языке экрана: согласие с русским текстом — не согласие с казахским.
 * Сменили язык — галочка снимается, согласие даётся заново на новом тексте.
 */
export function useConsent(query: NoticeQuery) {
  const { i18n } = useTranslation();
  const loaded = query.data?.status === 200 ? (query.data.data as ConsentNoticeDto) : undefined;
  const notice = loaded && loaded.language === i18n.resolvedLanguage ? loaded : undefined;
  // Сбой — упавший запрос или текст не на том языке; обычная перезагрузка после смены языка — не сбой.
  const failed = !notice && (query.errorUpdateCount > 0 || (!!loaded && !query.isFetching));
  const [accepted, setAccepted] = useState(false);
  const shownLanguage = useRef(i18n.resolvedLanguage);
  useEffect(() => {
    if (shownLanguage.current === i18n.resolvedLanguage) return;
    shownLanguage.current = i18n.resolvedLanguage;
    setAccepted(false);
  }, [i18n.resolvedLanguage]);
  /** Почему согласие ещё не дано — ключ текста под кнопкой, или `null`. */
  const why = !notice
    ? failed && !query.isFetching ? 'join.why.notice' : 'join.consentLoading'
    : !accepted ? 'join.why.consent' : null;
  return { query, notice, failed, accepted: accepted && !!notice, setAccepted, why };
}

/** Текст согласия, галочка и — при сбое — строка с «Повторить». */
export function ConsentBlock({ consent, titleKey = 'join.consentTitle', acceptKey = 'join.consentAccept' }: {
  consent: ReturnType<typeof useConsent>;
  titleKey?: string;
  acceptKey?: string;
}) {
  const { t } = useTranslation();
  const { notice, failed, query } = consent;
  return (
    <>
      {notice && (
        <div className="flex flex-col gap-2">
          <details className="rounded-[var(--radius-control)] border-2 border-solid border-hairline bg-surface p-3.5">
            <summary className="cursor-pointer text-body font-bold text-ink">{t(titleKey)}</summary>
            <div className="mt-3 max-h-[26rem] overflow-y-auto pr-1">
              <ConsentNotice text={notice.text} />
            </div>
          </details>
          {/* «Вариант Б»: крупная галочка — по маленькой промахиваются. */}
          <label className="flex min-h-12 cursor-pointer items-start gap-3 py-1 text-base leading-snug text-ink">
            <input
              type="checkbox"
              checked={consent.accepted}
              onChange={(event) => consent.setAccepted(event.currentTarget.checked)}
              className="size-8 shrink-0 cursor-pointer accent-[var(--color-shop)]"
            />
            <span>{t(acceptKey)}</span>
          </label>
        </div>
      )}
      {/* Повтор сбрасывает isError, пока идёт запрос, — держимся за счётчик сбоев. */}
      {failed && (
        <p role="alert" className={cn('flex flex-wrap items-center gap-2 text-sm', query.isFetching ? 'text-ink-muted' : 'text-gone')}>
          {query.isFetching ? t('join.consentLoading') : t('join.consentFailed')}
          <Button size="md" variant="outline" busy={query.isFetching} onClick={() => void query.refetch()}>{t('common.retry')}</Button>
        </p>
      )}
    </>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeclineOrderRequestReason } from '../../api/generated';
import { rules } from '../../api/rules.generated';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

const REASONS: DeclineOrderRequestReason[] = ['REPLACEMENT', 'PRICE', 'WAIT', 'BOUGHT_ELSEWHERE', 'OTHER'];

/**
 * Отказ от всей заявки — только через подтверждение с причиной (W2-05, NS-15).
 *
 * Одним касанием заявку больше не потерять: хотел отказаться от замены — а закрыл
 * всё. Главная кнопка — «Остаться», фокус на ней; опасная — «Отказаться».
 * Причину видит менеджер — вместо голого «заявка закрыта».
 */
export function DeclineDialog({ pending, failed, onStay, onDecline }: {
  pending: boolean;
  failed: boolean;
  onStay: () => void;
  onDecline: (reason: DeclineOrderRequestReason | undefined, comment: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<DeclineOrderRequestReason | undefined>(undefined);
  const [comment, setComment] = useState('');
  const stay = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const commentId = useId();
  useEffect(() => { stay.current?.focus(); }, []);

  return (
    <Card role="alertdialog" aria-labelledby={titleId} data-testid="decline-dialog" className="flex flex-col gap-3 p-4"
      onKeyDown={(event) => { if (event.key === 'Escape') onStay(); }}>
      <p id={titleId} className="m-0 font-semibold text-ink">{t('orders.declineDialog.title')}</p>
      <p className="m-0 text-sm text-ink-muted">{t('orders.declineDialog.warning')}</p>
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold text-ink">{t('orders.declineDialog.reason')}</legend>
        {REASONS.map((value) => (
          <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="radio" name="decline-reason" value={value} checked={reason === value}
              onChange={() => setReason(value)} className="size-5 accent-[var(--color-accent)]" />
            {t(`orders.declineDialog.reasons.${value}`)}
          </label>
        ))}
      </fieldset>
      {reason === 'OTHER' ? (
        <>
          <label htmlFor={commentId} className="text-sm font-semibold text-ink">{t('orders.declineDialog.comment')}</label>
          <textarea id={commentId} rows={2} maxLength={rules.DeclineOrderRequest.comment.maxLength} value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="resize-y rounded-[var(--radius-control)] border-[1.5px] border-solid border-field-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none" />
        </>
      ) : null}
      {failed ? <p role="alert" className="m-0 text-sm text-gone">{t('orders.declineDialog.failed')}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button ref={stay} size="lg" onClick={onStay}>{t('orders.declineDialog.stay')}</Button>
        <Button size="lg" variant="outline" className="text-gone" disabled={pending}
          onClick={() => onDecline(reason, comment.trim())}>
          {pending ? t('orders.sending') : t('orders.declineDialog.confirm')}
        </Button>
      </div>
    </Card>
  );
}

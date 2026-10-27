import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyPortalOrderQueryKey,
  getGetMyPortalOrdersQueryKey,
  RateOrderRequestReason,
  useRateMyPortalOrder,
  type PortalOrderDto,
} from '../../api/generated';
import { rules } from '../../api/rules.generated';
import { Button } from '../../ui/Button';
import { ThumbsUp } from '../../ui/icons';

const REASONS = Object.values(RateOrderRequestReason);

/**
 * «Как прошёл заказ?» у полученного заказа: одно касание, если всё хорошо.
 * «Были проблемы» сервер кладёт ещё и в переписку заказа — продавец увидит и ответит.
 */
export function RateOrder({ order }: { order: PortalOrderDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formId = useId();
  const [complaining, setComplaining] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState<RateOrderRequestReason | undefined>();
  const [comment, setComment] = useState('');

  const rate = useRateMyPortalOrder({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrderQueryKey(order.id) });
        setComplaining(false);
        setEditing(false);
      },
    },
  });
  const failed = rate.isError || (rate.data !== undefined && rate.data.status !== 200);
  const rated = order.rating;

  if (rated && !editing) {
    return (
      <p data-testid="order-rating" className="m-0 flex basis-full flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        <span>
          {rated.good
            ? t('orders.rating.yourGood')
            : rated.reason
              ? t('orders.rating.yourBadWith', { reason: t(`orders.rating.reason.${rated.reason}`).toLocaleLowerCase() })
              : t('orders.rating.yourBad')}
        </span>
        <button type="button" className="cursor-pointer font-semibold text-accent-ink hover:underline" onClick={() => setEditing(true)}>
          {t('orders.rating.change')}
        </button>
      </p>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (rate.isPending) return;
    rate.mutate({ id: order.id, data: { good: false, reason, comment: comment.trim() || undefined } });
  };

  return (
    <div className="flex basis-full flex-col gap-2">
      <span id={`${formId}-q`} className="text-sm font-semibold text-ink">{t('orders.rating.question')}</span>
      <div role="group" aria-labelledby={`${formId}-q`} className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={rate.isPending}
          onClick={() => rate.mutate({ id: order.id, data: { good: true } })}>
          <ThumbsUp aria-hidden="true" className="size-[18px]" />
          {t('orders.rating.good')}
        </Button>
        <Button type="button" variant="outline" aria-expanded={complaining} disabled={rate.isPending}
          onClick={() => setComplaining(true)}>
          <ThumbsUp aria-hidden="true" className="size-[18px] rotate-180" />
          {t('orders.rating.bad')}
        </Button>
      </div>

      {complaining ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-semibold text-ink">{t('orders.rating.what')}</legend>
            {REASONS.map((value) => (
              <label key={value}
                className="inline-flex h-9 cursor-pointer items-center rounded-[var(--radius-pill)] border-[1.5px] border-solid border-line px-4 text-[0.8125rem] font-semibold text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="radio" name={`${formId}-reason`} value={value} checked={reason === value}
                  onChange={() => setReason(value)} className="sr-only" />
                {t(`orders.rating.reason.${value}`)}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            {t('orders.rating.comment')}
            <textarea rows={2} value={comment} maxLength={rules.RateOrderRequest.comment.maxLength}
              onChange={(event) => setComment(event.target.value)}
              className="resize-y rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface px-3 py-2 text-sm font-normal text-ink focus:border-accent focus:outline-none" />
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="accent" disabled={rate.isPending}>
              {rate.isPending ? t('orders.sending') : t('orders.rating.send')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setComplaining(false)}>{t('orders.v2.askCancel')}</Button>
          </div>
        </form>
      ) : null}
      {failed ? <p role="alert" className="m-0 text-sm text-gone">{t('orders.v2.askFailed')}</p> : null}
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Switch } from '../../ui/Switch';
import { Bell, ChevronDown } from '../../ui/icons';
import { useSupplier } from '../../supplier/useSupplier';
import {
  getGetPortalPushPreferencesQueryKey,
  useGetPortalPushPreferences,
  useSavePortalPushPreferences,
  type PushPreferencesDto,
  type PushPreferencesDtoMutedItem,
} from '../../api/generated';

type Kind = PushPreferencesDtoMutedItem;

/** Поводы клиента (у продавца свои) — тремя группами, словами колокольчика (`notifications.reasons.*`). */
const GROUPS: { key: string; kinds: Kind[] }[] = [
  { key: 'orders', kinds: ['ACCEPTED', 'RENEGOTIATION', 'PRICE_NAMED', 'DEADLINE_SOON', 'ORDER_ANSWERED', 'QUESTION_ANSWERED', 'TEMPLATE_READY', 'REORDER_DUE'] },
  { key: 'delivery', kinds: ['INVOICE_SENT', 'TRANSPORT_RECEIPT_SENT', 'TRANSPORT_PAYMENT_REJECTED', 'ORDER_ON_ROUTE', 'ORDER_DELIVERED',
    'DEBT_PAYMENT_CONFIRMED', 'DEBT_PAYMENT_REJECTED', 'DEBT_PAYMENT_RECEIVED', 'DEBT_PAYMENT_DUE'] },
  { key: 'promo', kinds: ['NEW_ARRIVALS', 'PROMO_STARTED', 'BACK_IN_STOCK'] },
];

const FIELD = 'h-11 rounded-[var(--radius-control)] border-0 bg-sunk px-3 text-body text-ink focus:outline-none focus:ring-2 focus:ring-accent';

/**
 * Уведомления на телефон (backend.md §18.28, п. 4): о чём не присылать push и тихие часы,
 * когда push приходит без звука. Колокольчик в кабинете показывает всё при любом выборе.
 * Настроек нет — всё включено. Свернуто: заходят сюда редко.
 */
export function PushBlock() {
  const { t } = useTranslation();
  const { supplierId } = useSupplier();
  const query = useGetPortalPushPreferences({ query: { enabled: supplierId !== null } });
  const prefs = query.data?.status === 200 ? query.data.data : undefined;
  if (!prefs) return null;
  return (
    <Card className="p-0">
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
            <Bell className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="text-body font-bold text-ink">{t('profile.push.title')}</b>
            <span className="text-xs text-ink-subtle">{summaryOf(prefs, t)}</span>
          </span>
          <ChevronDown className="size-5 shrink-0 text-home-icon transition-transform group-open:rotate-180" />
        </summary>
        <PushForm prefs={prefs} />
      </details>
    </Card>
  );
}

function summaryOf(prefs: PushPreferencesDto, t: (key: string, options?: Record<string, unknown>) => string): string {
  const off = GROUPS.flatMap((group) => group.kinds).filter((kind) => prefs.muted.includes(kind)).length;
  const parts = [off ? t('profile.push.someOff', { count: off }) : t('profile.push.allOn')];
  if (prefs.quietFrom && prefs.quietTo) parts.push(t('profile.push.quietShort', { from: prefs.quietFrom.slice(0, 5), to: prefs.quietTo.slice(0, 5) }));
  return parts.join(' · ');
}

function PushForm({ prefs }: { prefs: PushPreferencesDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [from, setFrom] = useState(prefs.quietFrom?.slice(0, 5) ?? '');
  const [to, setTo] = useState(prefs.quietTo?.slice(0, 5) ?? '');
  const save = useSavePortalPushPreferences({
    mutation: {
      onSuccess: (response) => {
        setFailed(false);
        if (response.status === 200) queryClient.setQueryData(getGetPortalPushPreferencesQueryKey(), response);
      },
      onError: () => setFailed(true),
    },
  });
  const send = (data: PushPreferencesDto) => save.mutate({ data });
  const toggle = (kind: Kind) => {
    const muted = prefs.muted.includes(kind) ? prefs.muted.filter((one) => one !== kind) : [...prefs.muted, kind];
    send({ ...prefs, muted });
  };
  // Тихие часы — оба края или ни одного: половину сервер не примет.
  const quietReady = (from === '') === (to === '');
  const quietChanged = from !== (prefs.quietFrom?.slice(0, 5) ?? '') || to !== (prefs.quietTo?.slice(0, 5) ?? '');

  return (
    <div className="flex flex-col gap-5 border-t border-hairline p-4">
      <p className="text-sm text-ink-muted">{t('profile.push.lead')}</p>

      {GROUPS.map((group) => (
        <section key={group.key} aria-labelledby={`push-${group.key}`} className="flex flex-col">
          <h3 id={`push-${group.key}`} className="pb-1 text-caption font-bold uppercase tracking-wide text-ink-subtle">
            {t(`profile.push.groups.${group.key}`)}
          </h3>
          {group.kinds.map((kind) => (
            <div key={kind} className="flex items-center justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0">
              <span id={`push-${kind}`} className="text-body text-ink">{t(`notifications.reasons.${kind}`)}</span>
              <Switch on={!prefs.muted.includes(kind)} labelledBy={`push-${kind}`} disabled={save.isPending} onToggle={() => toggle(kind)} />
            </div>
          ))}
        </section>
      ))}

      <form
        className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-sunk/60 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (quietReady) send({ ...prefs, quietFrom: from || undefined, quietTo: to || undefined });
        }}
      >
        <div className="flex flex-col gap-0.5">
          <b className="text-body font-bold text-ink">{t('profile.push.quiet')}</b>
          <span className="text-caption text-ink-subtle">{t('profile.push.quietNote')}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {t('profile.push.from')}
            <input type="time" value={from} onChange={(event) => setFrom(event.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {t('profile.push.to')}
            <input type="time" value={to} onChange={(event) => setTo(event.target.value)} className={FIELD} />
          </label>
        </div>
        {!quietReady ? <p role="alert" className="text-sm text-gone">{t('profile.push.quietBoth')}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!quietReady || !quietChanged || save.isPending}>{t('profile.push.save')}</Button>
          {prefs.quietFrom ? (
            <Button type="button" variant="ghost" disabled={save.isPending}
              onClick={() => { setFrom(''); setTo(''); send({ ...prefs, quietFrom: undefined, quietTo: undefined }); }}>
              {t('profile.push.noQuiet')}
            </Button>
          ) : null}
        </div>
      </form>

      {failed ? <p role="alert" className="text-sm text-gone">{t('profile.push.failed')}</p> : null}
    </div>
  );
}

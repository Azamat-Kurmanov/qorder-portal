import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalPromotionsQueryKey,
  setPortalPromoSubscription,
  useGetPortalPromotions,
} from '../../api/generated';
import { Card } from '../../ui/Card';
import { Switch } from '../../ui/Switch';
import { Bell } from '../../ui/icons';

/**
 * «Сообщать о новинках и акциях» — в профиле и в «Акциях и скидках». Подписка включена по умолчанию
 * (сервер так и отдаёт), здесь от неё можно отказаться и вернуть. Продавец,
 * который подписку не предлагает, присылает `subscription: null` — тогда
 * переключателя нет.
 */
export function PromoSubscription() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const promotions = useGetPortalPromotions();
  const [busy, setBusy] = useState(false);
  const subscription = promotions.data?.status === 200 ? promotions.data.data.subscription : undefined;
  if (!subscription) return null;
  const subscribed = subscription.subscribed;

  async function toggle() {
    setBusy(true);
    try {
      const response = await setPortalPromoSubscription({ subscribed: !subscribed });
      if (response.status === 200) queryClient.setQueryData(getGetPortalPromotionsQueryKey(), response);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex items-center gap-3 p-4">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ok-soft text-ok-ink">
        <Bell className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b id="promo-subscription" className="text-body font-bold text-ink">{t('promotions.subscription.off')}</b>
        <span className="text-xs text-ink-subtle">{t('promotions.v2.sub.where')}</span>
      </span>
      <Switch on={subscribed} labelledBy="promo-subscription" disabled={busy} onToggle={() => void toggle()} />
    </Card>
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getGetPortalRestockSubscriptionsQueryKey,
  useGetPortalRestockSubscriptions,
  useSubscribePortalRestock,
  useUnsubscribePortalRestock,
} from '../../api/generated';
import { Bell, Check } from '../../ui/icons';
import { cn } from '../../ui/cn';

/**
 * «Сообщить о поступлении» у позиции, которой нет.
 *
 * Состояние — со списка подписок на сервере, а не из памяти экрана: подписка
 * гаснет сама, когда товар пришёл, и экран узнаёт об этом только оттуда.
 */
export function RestockButton({ itemId }: { itemId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const list = useGetPortalRestockSubscriptions();
  const subscribed = list.data?.status === 200 && list.data.data.includes(itemId);
  const refresh = { mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPortalRestockSubscriptionsQueryKey() }) } };
  const subscribe = useSubscribePortalRestock(refresh);
  const unsubscribe = useUnsubscribePortalRestock(refresh);
  const busy = list.isPending || subscribe.isPending || unsubscribe.isPending;

  return (
    <button
      type="button"
      aria-pressed={subscribed}
      disabled={busy}
      onClick={() => (subscribed ? unsubscribe : subscribe).mutate({ itemId })}
      className={cn(
        'inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] px-3 text-caption font-semibold',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default',
        subscribed ? 'bg-sage-soft text-accent-ink' : 'bg-accent-soft text-accent-ink hover:brightness-[0.97]',
      )}
    >
      {subscribed
        ? <Check aria-hidden="true" className="size-4" />
        : <Bell aria-hidden="true" className="size-4" />}
      {subscribed ? t('catalog.restock.waiting') : t('catalog.restock.notify')}
    </button>
  );
}

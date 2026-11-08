import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getGetPortalNotificationsQueryKey,
  getGetPortalSuppliersQueryKey,
  getGetPortalUnreadSummaryQueryKey,
  useBreakUpWithPortalSupplier,
  useHidePortalSupplier,
  useShowPortalSupplier,
  type PortalSupplierDto,
} from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { togglePin } from '../../supplier/shopMemory';
import { cn } from '../../ui/cn';
import { MoreHorizontal } from '../../ui/icons';

const ACTION = cn(
  'flex min-h-13 w-full items-center rounded-[var(--radius-control)] px-4 text-left text-base font-semibold text-ink',
  'hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60',
);

/**
 * «⋯» у строки магазина (решение владельца 2026-10-30): закрепить, скрыть или вернуть и удалить.
 *
 * Листом, а не выпадающим меню: на телефоне его легче попасть пальцем, а удаление — второй шаг
 * того же листа с предупреждением, что действие необратимо и общие данные будут стёрты навсегда.
 */
export function ShopActions({ supplier, pinned, others }: {
  supplier: PortalSupplierDto;
  pinned: boolean;
  /** Остальные магазины — куда перейти, если удалили тот, в котором клиент сейчас. */
  others: PortalSupplierDto[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { supplierId, select } = useSupplier();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const hidden = !!supplier.hidden;

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetPortalSuppliersQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetPortalUnreadSummaryQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() }),
  ]);
  const close = () => {
    setOpen(false);
    setConfirming(false);
    setFailed(null);
  };
  const hide = useHidePortalSupplier({ mutation: { onSuccess: () => { close(); void refresh(); } } });
  const show = useShowPortalSupplier({ mutation: { onSuccess: () => { close(); void refresh(); } } });
  const breakUp = useBreakUpWithPortalSupplier({
    mutation: {
      onMutate: () => setFailed(null),
      // Отказ (долг, заявка в работе) сервер уже перевёл и назвал причину — показываем его.
      onError: (error) => {
        const detail = (error as { info?: { detail?: unknown } } | null)?.info?.detail;
        setFailed(typeof detail === 'string' && detail ? detail : t('shops.actions.failed'));
      },
      onSuccess: () => {
        close();
        if (supplier.supplierId === supplierId) select(others[0]?.supplierId ?? null);
        void refresh();
      },
    },
  });

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Dialog.Trigger
        aria-label={t('shops.actions.open', { name: supplier.name })}
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-canvas hover:text-ink',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-[60] bg-ink/45 dark:bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'qo-dialog fixed inset-x-0 bottom-0 z-[60] flex flex-col gap-1 rounded-t-[1.5rem] bg-surface p-3',
            'pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-float',
            'lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[26rem] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[1.5rem]',
          )}
        >
          <Dialog.Title className="truncate px-4 pb-1 pt-2 text-lg font-extrabold text-ink">{supplier.name}</Dialog.Title>
          {confirming ? (
            <div className="flex flex-col gap-3 px-4 pb-1">
              <p className="text-base font-bold text-sale-text">{t('shops.actions.warningTitle')}</p>
              <p className="text-sm leading-normal text-ink-muted">{t('shops.actions.warning')}</p>
              {failed && <p role="alert" className="text-sm font-semibold text-sale-text">{failed}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setConfirming(false)}
                  className="h-12 flex-1 rounded-[var(--radius-control)] bg-canvas text-base font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  {t('shops.actions.cancel')}
                </button>
                <button type="button" disabled={breakUp.isPending}
                  onClick={() => breakUp.mutate({ supplierId: supplier.supplierId, params: { confirm: true } })}
                  className="h-12 flex-1 rounded-[var(--radius-control)] bg-sale text-base font-extrabold text-on-sale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sale disabled:opacity-60">
                  {t('shops.actions.deleteForever')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" className={ACTION} onClick={() => { togglePin(supplier.supplierId); close(); }}>
                {t(pinned ? 'shops.actions.unpin' : 'shops.actions.pin')}
              </button>
              <button type="button" className={ACTION} disabled={hide.isPending || show.isPending}
                onClick={() => (hidden ? show : hide).mutate({ supplierId: supplier.supplierId })}>
                {t(hidden ? 'shops.actions.show' : 'shops.actions.hide')}
              </button>
              <p className="px-4 pb-1 text-caption text-ink-subtle">
                {t(hidden ? 'shops.actions.showNote' : 'shops.actions.hideNote')}
              </p>
              <button type="button" className={cn(ACTION, 'text-sale-text')} onClick={() => setConfirming(true)}>
                {t('shops.actions.delete')}
              </button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

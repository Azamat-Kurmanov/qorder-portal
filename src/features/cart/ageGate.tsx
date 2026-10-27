import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalCartQueryKey,
  useConfirmPortalAge,
  type ItemSaleTerms,
  type ShowcaseWholesaleDto,
} from '../../api/generated';
import type { SaleMode } from './ModeSwitch';
import { toPieces } from './wholesale';
import { cartOf, useCart, useSetCartLine } from './useCart';
import { firstQuantity } from './saleTerms';
import { announceAdded } from './cartDrawer';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

/**
 * Вопрос «Вам уже есть 21 год?» — одно окно на весь кабинет.
 *
 * Товар 21+ кладут из витрины, карточки и быстрого ввода, и окно в каждом
 * из этих мест значило бы три разных вопроса об одном и том же. Поэтому
 * вопрос живёт здесь: место, где нажали «В корзину», только спрашивает,
 * а окно рисует оболочка.
 *
 * Спрашивается один раз у магазина: ответ сервер помнит (`ageConfirmed`
 * в корзине), и повторять вопрос на каждой бутылке — значит приучить
 * отвечать «да» не читая.
 */
type Pending = { name: string; resolve: (adult: boolean) => void } | null;

let pending: Pending = null;
const listeners = new Set<() => void>();

function set(next: Pending) {
  pending = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Спросить возраст: ответ приходит обещанием — «да» только после записи на сервере. */
function askAge(name: string): Promise<boolean> {
  pending?.resolve(false);
  return new Promise((resolve) => set({ name, resolve }));
}

/** Окно вопроса. Рисуется один раз — в оболочке. */
export function AgeGateDialog() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const current = useSyncExternalStore(subscribe, () => pending);
  const confirm = useConfirmPortalAge({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        queryClient.setQueryData(getGetPortalCartQueryKey(), response);
      },
    },
  });

  function answer(adult: boolean) {
    const asked = pending;
    if (!asked) return;
    if (!adult) {
      set(null);
      asked.resolve(false);
      return;
    }
    confirm.mutate(undefined, {
      onSuccess: (response) => {
        set(null);
        asked.resolve(response.status === 200);
      },
      onError: () => {
        set(null);
        asked.resolve(false);
      },
    });
  }

  return (
    <Dialog.Root open={current !== null} onOpenChange={(open) => { if (!open) answer(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/45 dark:bg-black/60" />
        <Dialog.Content
          aria-describedby="age-gate-text"
          className={cn(
            'qo-dialog fixed left-1/2 top-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'flex-col gap-4 rounded-[calc(var(--radius-gallery)*7/6)] bg-surface p-6 shadow-float',
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-full bg-adult text-lg font-extrabold text-white"
          >
            21+
          </span>
          <Dialog.Title className="text-[1.5rem] font-extrabold tracking-[-0.02em] text-ink">
            {t('catalog.age.title')}
          </Dialog.Title>
          <p id="age-gate-text" className="text-base leading-normal text-ink-muted">
            {t('catalog.age.text', { name: current?.name ?? '' })}
          </p>
          <div className="flex flex-col gap-2">
            <Button size="lg" variant="accent" disabled={confirm.isPending} onClick={() => answer(true)}>
              {t('catalog.age.yes')}
            </Button>
            <Button size="lg" variant="outline" disabled={confirm.isPending} onClick={() => answer(false)}>
              {t('catalog.age.no')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Положить позицию с учётом её условий: 21+ — после вопроса о возрасте,
 * минимум и кратность — сразу допустимым количеством.
 *
 * @returns `false`, если покупатель ответил «нет» и ничего не положено
 */
export function useAddToCart() {
  const cart = cartOf(useCart().data);
  const setLine = useSetCartLine();

  async function add(
    item: { id: string; name: string; terms?: ItemSaleTerms; wholesale?: ShowcaseWholesaleDto },
    quantity?: number,
    mode?: SaleMode,
  ) {
    if (item.terms?.ageRestricted && !cart?.ageConfirmed) {
      const adult = await askAge(item.name);
      if (!adult) return false;
    }
    setLine.mutate(
      { itemId: item.id, data: { quantity: toPieces(item, quantity ?? firstQuantity(item.terms)), mode } },
      // Корзины рядом с витриной больше нет — положенное называется
      // уведомлением с кнопкой «Открыть корзину».
      { onSuccess: (response) => { if (response.status === 200) announceAdded(item.name); } },
    );
    return true;
  }

  return { add, isPending: setLine.isPending };
}

import { useOrderMode } from '../cart/orderMode';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { ChevronRight, RotateCcw } from '../../ui/icons';
import { useTranslation } from 'react-i18next';
import { useRepeatLastPortalOrder } from '../../api/generated';
import { NothingAdded, useStayIfEmpty } from './stayIfEmpty';

/**
 * «Повторить прошлый заказ» — одно касание вместо десяти.
 *
 * Ради этого кабинет и строился: закупки повторяются, и набирать тот же
 * список каждую неделю руками человек не станет — он вернётся в переписку,
 * где достаточно написать «как в прошлый раз».
 *
 * Корзина не отправляется сразу: цены с прошлого раза могли измениться,
 * а позиции — исчезнуть. Клиент попадает в корзину и видит, что получилось.
 *
 * Вид задаётся снаружи, а слова — нет: в списке заявок кнопка стоит
 * спокойной обводкой рядом с составом, в шаблонах — заметной, потому что
 * там она главное действие экрана. Название при этом одно на оба места:
 * повторяется прошлый заказ клиента, а не та карточка, у которой нажали.
 */
export function RepeatOrderButton({ variant = 'soft', className, row = false }: {
  variant?: 'soft' | 'outline';
  className?: string;
  /** Строкой-карточкой со значком, как в макете «Шаблоны» (К2.13). */
  row?: boolean;
}) {
  const { t } = useTranslation();

  // Товар «оптом и в розницу» ложится в заявку, в которой клиент сейчас (решение владельца 2026-11-06).
  const [orderMode] = useOrderMode();
  // Ответ — уже собранная корзина; пустая — остаёмся здесь и называем причину.
  const { done, nothing, start } = useStayIfEmpty();
  const repeat = useRepeatLastPortalOrder({ mutation: { onSuccess: done } });

  if (row) {
    return (
      <>
      <button
        type="button"
        disabled={repeat.isPending}
        onClick={() => { start(); repeat.mutate({ params: { mode: orderMode } }); }}
        className={cn(
          'flex w-full items-center gap-3 rounded-[1.25rem] bg-surface px-4 py-3.5 text-left',
          'transition-colors hover:bg-surface/80 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          className,
        )}
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          <RotateCcw className="size-5" />
        </span>
        <span className="flex-1 text-body font-bold text-ink">
          {repeat.isPending ? t('orders.collecting') : t('orders.repeat')}
        </span>
        <ChevronRight aria-hidden="true" className="size-[18px] text-ink-faint" />
      </button>
      <NothingAdded skipped={nothing} />
      </>
    );
  }

  return (
    <>
    <Button
      variant={variant}
      className={className}
      disabled={repeat.isPending}
      onClick={() => { start(); repeat.mutate({ params: { mode: orderMode } }); }}
    >
      {repeat.isPending ? t('orders.collecting') : t('orders.repeat')}
    </Button>
    <NothingAdded skipped={nothing} />
    </>
  );
}

import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { ChevronRight, RotateCcw } from '../../ui/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPortalCartQueryKey, useRepeatLastPortalOrder } from '../../api/generated';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const repeat = useRepeatLastPortalOrder({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        // Ответ — уже собранная корзина: кладём её целиком, вместе со статусом,
        // как это делает изменение количества.
        queryClient.setQueryData(getGetPortalCartQueryKey(), response);
        navigate('/checkout');
      },
    },
  });

  if (row) {
    return (
      <button
        type="button"
        disabled={repeat.isPending}
        onClick={() => repeat.mutate()}
        className={cn(
          'flex w-full items-center gap-3 rounded-[1.25rem] bg-surface px-4 py-3.5 text-left',
          'transition-colors hover:bg-surface/80 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          className,
        )}
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          <RotateCcw className="size-5" />
        </span>
        <span className="flex-1 text-[0.9375rem] font-bold text-ink">
          {repeat.isPending ? t('orders.collecting') : t('orders.repeat')}
        </span>
        <ChevronRight aria-hidden="true" className="size-[18px] text-ink-faint" />
      </button>
    );
  }

  return (
    <Button
      variant={variant}
      className={className}
      disabled={repeat.isPending}
      onClick={() => repeat.mutate()}
    >
      {repeat.isPending ? t('orders.collecting') : t('orders.repeat')}
    </Button>
  );
}

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyPortalOrderQueryKey,
  getGetMyPortalOrdersQueryKey,
  useCancelMyPortalOrder,
  useConfirmMyPortalOrder,
  useDeclineMyPortalOrder,
  useGetMyPortalOrder,
  type PortalOrderDto,
  type SnapshotLineDto,
} from '../../api/generated';
import { OrderStateBadge } from './OrderStateBadge';
import { RevisionDiff } from './RevisionDiff';
import { money, tenge } from '../../shared/format';
import { orderDay } from './orderText';

/**
 * Заявка целиком: что отправлено, что предлагает поставщик и что с этим делать.
 *
 * Две редакции показываются рядом, а не одна поверх другой: подтверждать
 * вслепую — значит соглашаться на цену, которой не видел. Ответ здесь кнопкой,
 * и разбирать слова клиента незачем: в кабинете он нажимает, а не пишет.
 */
export function OrderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [answered, setAnswered] = useState(false);

  const response = useGetMyPortalOrder(id);
  const order: PortalOrderDto | undefined =
    response.data?.status === 200 ? response.data.data : undefined;

  const refresh = {
    onSuccess: () => {
      setAnswered(true);
      void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrderQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() });
    },
  };
  const confirm = useConfirmMyPortalOrder({ mutation: refresh });
  const decline = useDeclineMyPortalOrder({ mutation: refresh });
  const cancel = useCancelMyPortalOrder({ mutation: refresh });

  if (response.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-8 w-56 animate-pulse rounded-[var(--radius-control)] bg-sunk" />
        <div className="h-40 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk" />
      </div>
    );
  }

  if (!order) {
    return (
      <p
        role="alert"
        className="rounded-[var(--radius-card)] border border-gone/30 bg-gone/8 p-4 text-ink"
      >
        Заявка не найдена.
      </p>
    );
  }

  const busy = confirm.isPending || decline.isPending || cancel.isPending;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Заявка от {orderDay(order.createdAt)}
        </h1>
        <OrderStateBadge state={order.state} />
      </div>

      {order.needsAnswer && (
        <div
          role="alert"
          className="rounded-[var(--radius-card)] border border-accent/30 bg-accent-soft p-4"
        >
          <p className="font-medium text-ink">Поставщик предлагает изменения</p>
          <p className="mt-1 text-sm text-ink-muted">
            Посмотрите, что изменилось, и ответьте: подтверждение относится
            к предложенному составу.
          </p>
          <RevisionDiff diff={order.diff} />
        </div>
      )}

      <Revision
        title={order.proposed ? 'Вы отправляли' : 'Состав заявки'}
        lines={order.submitted}
        total={order.total}
        testId="submitted"
      />

      {order.proposed && (
        <Revision
          title="Поставщик предлагает"
          lines={order.proposed}
          total={order.proposedTotal ?? 0}
          testId="proposed"
        />
      )}

      {answered && <p className="text-sm text-ink-subtle">Ответ отправлен поставщику.</p>}

      {order.needsAnswer && (
        // Две кнопки одной ширины: согласие и отказ равноправны, и более
        // крупная кнопка читалась бы как подсказка, что выбрать. Слова те же,
        // что в списке заявок: одно действие, названное на двух экранах
        // по-разному, читается как два разных.
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            aria-label={`Согласен с изменениями в заявке от ${orderDay(order.createdAt)}`}
            disabled={busy}
            onClick={() => confirm.mutate({ id })}
          >
            {confirm.isPending ? 'Отправляем…' : 'Согласен'}
          </Button>
          <Button
            size="lg"
            variant="outline"
            aria-label={`Отменить заявку от ${orderDay(order.createdAt)}`}
            disabled={busy}
            onClick={() => decline.mutate({ id })}
          >
            {decline.isPending ? 'Отправляем…' : 'Отменить'}
          </Button>
        </div>
      )}

      {order.cancellable && !order.needsAnswer && (
        <Button variant="ghost" disabled={busy} onClick={() => cancel.mutate({ id })}>
          {cancel.isPending ? 'Отменяем…' : 'Отменить заявку'}
        </Button>
      )}

      <Button variant="ghost" onClick={() => navigate('/orders')}>Ко всем заявкам</Button>
    </div>
  );
}

/** Одна редакция состава: то, что предъявлено, и её итог. */
function Revision({ title, lines, total, testId }: {
  title: string;
  lines: SnapshotLineDto[];
  total: number;
  testId: string;
}) {
  return (
    <Card className="p-4" data-testid={testId}>
      <p className="mb-2 font-semibold text-ink">{title}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-sm">
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${line.name}-${index}`} className="border-b border-hairline last:border-0">
                <td className="py-2 pr-2 text-ink">{line.name}</td>
                <td className="py-2 pr-2 text-right tabular-nums text-ink-muted">
                  {money(line.quantity)} {line.unit ?? ''}
                </td>
                <td className="py-2 text-right tabular-nums text-ink">
                  {line.price === undefined ? '' : tenge(line.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="my-2 h-px bg-hairline" />
      <div className="flex justify-between font-semibold text-ink">
        <span>Итого</span>
        <span className="tabular-nums">{tenge(total)}</span>
      </div>
    </Card>
  );
}

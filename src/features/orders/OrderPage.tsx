import { useState } from 'react';
import { PackContents, packMembers } from '../catalog/PackContents';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useQueryClient } from '@tanstack/react-query';
import {
  downloadMyInvoice,
  getGetMyPortalOrderQueryKey,
  getGetMyPortalOrdersQueryKey,
  useCancelMyPortalOrder,
  useConfirmMyPortalOrder,
  useDeclineMyPortalOrder,
  useGetMyPortalOrder,
  type PortalOrderDto,
  type SnapshotLineDto,
} from '../../api/generated';
import { OrderMessages } from './OrderMessages';
import { OrderStateBadge } from './OrderStateBadge';
import { PickupCode } from './PickupCode';
import { RevisionDiff } from './RevisionDiff';
import { OrderDelivery } from './OrderDelivery';
import { TransportPayment } from './TransportPayment';
import { OrderTotals, type OrderBreakdown } from './OrderTotals';
import type { Currency } from '../../shared/currency';
import { LinkedLineThumb } from '../cart/LineThumb';
import { fileNameFrom, saveFile } from '../../shared/download';
import { decimal, money } from '../../shared/format';
import { quantityWithUnit } from '../../shared/units';
import { orderDay, packNote } from './orderText';

/**
 * Заявка целиком: что отправлено, что предлагает поставщик и что с этим делать.
 *
 * Две редакции показываются рядом, а не одна поверх другой: подтверждать
 * вслепую — значит соглашаться на цену, которой не видел. Ответ здесь кнопкой,
 * и разбирать слова клиента незачем: в кабинете он нажимает, а не пишет.
 */
export function OrderPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [answered, setAnswered] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceFailed, setInvoiceFailed] = useState(false);

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

  /*
   * Счёт скачивается вызовом, а не ссылкой на его адрес: переход по адресу
   * не несёт ни токена, ни выбранного поставщика — вместо документа человек
   * получил бы отказ. Отдаёт файл общий `shared/download.ts`, тот же, что
   * отдаёт PDF согласия: второй способ разошёлся бы с первым в имени файла
   * или в освобождении ссылки.
   */
  async function downloadInvoice() {
    setInvoiceBusy(true);
    setInvoiceFailed(false);
    try {
      const invoice = await downloadMyInvoice(id);
      if (invoice.status !== 200) {
        setInvoiceFailed(true);
        return;
      }
      await saveFile(invoice.data, fileNameFrom(invoice.headers, `invoice-${id}.pdf`));
    } catch {
      // Молчаливая кнопка хуже отказа: человек нажимает второй раз и решает,
      // что кабинет сломан.
      setInvoiceFailed(true);
    } finally {
      setInvoiceBusy(false);
    }
  }

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
        {t('orders.notFound')}
      </p>
    );
  }

  const busy = confirm.isPending || decline.isPending || cancel.isPending;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex items-center justify-between gap-3">
        <h1 className="qo-page-title">
          {t('orders.orderFrom', { day: orderDay(order.createdAt) })}
        </h1>
        <OrderStateBadge state={order.state} />
      </div>

      {order.pickupCode ? <PickupCode code={order.pickupCode} className="self-start" /> : null}

      {order.needsAnswer && (
        <div
          role="alert"
          className="rounded-[var(--radius-card)] border border-accent/30 bg-accent-soft p-4"
        >
          <p className="font-medium text-ink">{t('orders.changesTitle')}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {t('orders.changesNote')}
          </p>
          <RevisionDiff diff={order.diff} currency={order.currency} />
        </div>
      )}

      {/*
        Переписка — здесь, а не в мессенджере: в кабинет приходят те, кто
        в переписке не сидит, и другого места прочитать её у них нет.
        Заявки, поданные до ленты, хранят только `sellerAnswer` — для них
        показывается прежняя карточка одним ответом.
      */}
      {(order.messages ?? []).length > 0 ? (
        <OrderMessages messages={order.messages} />
      ) : order.sellerAnswer ? (
        <Card className="border-l-2 border-l-accent p-4">
          <p className="text-sm font-medium text-ink-muted">
            {t('orders.sellerAnswer')}
            {order.answeredAt ? ` · ${orderDay(order.answeredAt)}` : ''}
          </p>
          <p className="mt-1 whitespace-pre-line text-body leading-relaxed text-ink">
            {order.sellerAnswer}
          </p>
        </Card>
      ) : null}

      {order.delivery ? (
        <Card className="p-4">
          <OrderDelivery delivery={order.delivery} />
        </Card>
      ) : null}

      {order.transportPayment ? (
        <Card className="p-4">
          <TransportPayment orderId={order.id} payment={order.transportPayment} currency={order.currency} />
        </Card>
      ) : null}

      <Revision
        title={order.proposed ? t('orders.youSent') : t('orders.contents')}
        lines={order.submitted}
        total={order.total}
        testId="submitted"
        breakdown={order}
        currency={order.currency}
      />

      {order.proposed && (
        <Revision
          title={t('orders.supplierOffers')}
          lines={order.proposed}
          total={order.proposedTotal ?? 0}
          testId="proposed"
          currency={order.currency}
        />
      )}

      {answered && <p className="text-sm text-ink-subtle">{t('orders.answerSent')}</p>}

      {order.needsAnswer && (
        // Две кнопки одной ширины: согласие и отказ равноправны, и более
        // крупная кнопка читалась бы как подсказка, что выбрать. Слова те же,
        // что в списке заявок: одно действие, названное на двух экранах
        // по-разному, читается как два разных.
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            aria-label={t('orders.agreeAria', { day: orderDay(order.createdAt) })}
            disabled={busy}
            onClick={() => confirm.mutate({ id })}
          >
            {confirm.isPending ? t('orders.sending') : t('orders.agree')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            aria-label={t('orders.cancelAria', { day: orderDay(order.createdAt) })}
            disabled={busy}
            onClick={() => decline.mutate({ id })}
          >
            {decline.isPending ? t('orders.sending') : t('orders.decline')}
          </Button>
        </div>
      )}

      {/*
        Счёт — только когда он выписан. Кнопка, ведущая в пустоту, хуже её
        отсутствия: сервер ответил бы отказом, а человек решил бы, что счёт
        потерялся. Стоит она ниже состава и выше отмены: документ относится
        ко всей заявке, а не к одной её редакции.
      */}
      {order.invoiceAvailable && (
        <Button
          variant="outline"
          data-testid="order-invoice"
          aria-label={t('orders.invoiceAria', { day: orderDay(order.createdAt) })}
          disabled={invoiceBusy}
          onClick={() => void downloadInvoice()}
        >
          {invoiceBusy ? t('orders.invoicePreparing') : t('orders.invoice')}
        </Button>
      )}

      {invoiceFailed && (
        <p role="alert" className="text-sm text-gone">
          {t('orders.invoiceFailed')}
        </p>
      )}

      {order.cancellable && !order.needsAnswer && (
        <Button variant="ghost" disabled={busy} onClick={() => cancel.mutate({ id })}>
          {cancel.isPending ? t('orders.cancelling') : t('orders.cancel')}
        </Button>
      )}

      <Button variant="ghost" onClick={() => navigate('/orders')}>{t('orders.toAll')}</Button>
    </div>
  );
}

/** Одна редакция состава: то, что предъявлено, и её итог. */
function Revision({ title, lines, total, testId, breakdown, currency }: {
  title: string;
  lines: SnapshotLineDto[];
  total: number;
  testId: string;
  /** Разбивка итога — только у отправленной редакции. */
  breakdown?: OrderBreakdown;
  /** Валюта заявки, а не открытого магазина. */
  currency: Currency | undefined;
}) {
  const { t } = useTranslation();
  return (
    <Card className="p-4" data-testid={testId}>
      <p className="mb-2 font-semibold text-ink">{title}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-sm">
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${line.name}-${index}`} className="border-b border-hairline last:border-0">
                <td className="py-2 pr-2 text-ink">
                  <span className="flex items-center gap-3">
                    <LinkedLineThumb
                      itemId={line.itemId}
                      seed={line.itemId ?? line.name}
                      src={line.imageUrl}
                      label={t('orders.openItem', { name: line.name })}
                      className="size-11"
                    />
                    <span className="flex min-w-0 flex-col">
                      {line.name}
                      {line.pack ? <PackContents label={t('pack.inPress')} members={packMembers(line.pack)} /> : null}
                    </span>
                  </span>
                </td>
                <td className="py-2 pr-2 text-right tabular-nums text-ink-muted">
                  {line.unit ? quantityWithUnit(line.quantity, line.unit) : decimal(line.quantity)}{packNote(line, t)}
                </td>
                <td className="py-2 text-right tabular-nums text-ink">
                  {line.price === undefined ? '' : money(line.price, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="my-2 h-px bg-hairline" />
      <OrderTotals total={total} breakdown={breakdown} currency={currency} />
    </Card>
  );
}

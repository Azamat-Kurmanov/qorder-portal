import { useState } from 'react';
import { PackContents, packMembers } from '../catalog/PackContents';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useQueryClient } from '@tanstack/react-query';
import {
  downloadMyInvoice,
  downloadMyVatInvoice,
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
import { RateOrder } from './RateOrder';
import { ReportProblem } from './ReportProblem';
import { OrderStateBadge } from './OrderStateBadge';
import { PickupCode } from './PickupCode';
import { RevisionDiff } from './RevisionDiff';
import { OrderDelivery } from './OrderDelivery';
import { OrderReturns } from './OrderReturns';
import { TransportPayment } from './TransportPayment';
import { OrderTotals, type OrderBreakdown } from './OrderTotals';
import type { Currency } from '../../shared/currency';
import { LinkedLineThumb } from '../cart/LineThumb';
import { fileNameFrom, saveFile } from '../../shared/download';
import { dayMonth, decimal, money } from '../../shared/format';
import { quantityWithUnit } from '../../shared/units';
import { answerExpectedText, orderDay, packNote } from './orderText';
import { ReferralCard } from '../referral/ReferralCard';
import { ChevronLeft, MapPin } from '../../ui/icons';
import { MapViewButton } from '../maps/MapViewButton';
import { pointOf } from '../maps/mapProvider';
import { cn } from '../../ui/cn';
import { useWideScreen } from '../../ui/useWideScreen';
import { useCurrentShop } from '../shell/Shops';
import { OrderStages } from './OrderStages';
import { kindOf } from './myOrdersModel';

/** Поставщик принял заявку: дальше она только движется к выдаче. */
const CONFIRMED = new Set<string>(['ACCEPTED', 'READY', 'ISSUED']);

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
  const [vatBusy, setVatBusy] = useState(false);
  const [vatFailed, setVatFailed] = useState<'requisites' | 'failed' | null>(null);
  // Телефон — по макету «Заявка»: «Назад» к заявкам, номер, магазин и способ, шкала этапов.
  const wide = useWideScreen();
  const shop = useCurrentShop();

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

  /** Счёт-фактура — на реквизиты компании из профиля; их нет — подсказка, где заполнить. */
  async function downloadVatInvoice() {
    setVatBusy(true);
    setVatFailed(null);
    try {
      const file = await downloadMyVatInvoice(id);
      if (file.status !== 200) {
        setVatFailed('failed');
        return;
      }
      await saveFile(file.data, fileNameFrom(file.headers, `vat-invoice-${id}.pdf`));
    } catch (error) {
      const code = (error as { info?: { code?: unknown } } | null)?.info?.code;
      setVatFailed(code === 'VAT_INVOICE_NO_REQUISITES' ? 'requisites' : 'failed');
    } finally {
      setVatBusy(false);
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
        {wide ? (
          <h1 className="qo-page-title">
            {t('orders.orderFrom', { day: orderDay(order.createdAt) })}
          </h1>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/orders"
              aria-label={t('orders.toAll')}
              className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-surface text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeft aria-hidden="true" className="size-[1.375rem]" />
            </Link>
            <span className="flex min-w-0 flex-col gap-0.5">
              <h1 className="truncate text-[1.25rem] font-black tracking-[-0.02em] text-ink">
                {t('orders.v2.title', { number: order.orderNumber })}
              </h1>
              <span className="truncate text-[0.8125rem] text-ink-muted">
                {[shop?.name, t(order.pickup === false ? 'orders.way.delivery' : 'orders.way.pickup')].filter(Boolean).join(' · ')}
              </span>
              {/* Состояние — строкой под именем: справа плашка отнимала место у номера. */}
              <span className="self-start"><OrderStateBadge state={order.state} /></span>
            </span>
          </div>
        )}
        {wide ? <OrderStateBadge state={order.state} /> : null}
      </div>

      {wide ? null : <OrderStages kind={kindOf(order)} delivery={order.pickup === false} />}

      {order.answerExpectedBy ? (
        <p data-testid="order-answer-by" className="m-0 text-sm text-ink-muted">{answerExpectedText(order.answerExpectedBy, t)}</p>
      ) : null}
      {/* Имя без фамилии и без личного номера: звонят на общий номер магазина. */}
      {order.managerName ? (
        <p data-testid="order-manager" className="m-0 text-sm text-ink-muted">{t('orders.manager', { name: order.managerName })}</p>
      ) : null}

      {order.pickupCode ? <PickupCode code={order.pickupCode} className="self-start" /> : null}

      {/* Куда идти за самовывозом — с картой (макет К2.11): код без места мало что даёт. */}
      {order.pickup !== false && order.pickupPoint ? (
        <Card className="flex flex-col gap-2 p-4" data-testid="order-pickup-point">
          <span className="flex items-start gap-2.5">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-ink" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-[0.9375rem] font-bold text-ink">{order.pickupPoint.name}</b>
              <span className="text-[0.8125rem] text-ink-muted">
                {[order.pickupPoint.address, order.pickupPoint.workingHours].filter(Boolean).join(' · ')}
              </span>
            </span>
          </span>
          <MapViewButton title={order.pickupPoint.name} address={order.pickupPoint.address}
            point={pointOf(order.pickupPoint.latitude, order.pickupPoint.longitude)} />
        </Card>
      ) : null}

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

      {order.issuedAt && order.id ? <OrderReturns orderId={order.id} currency={order.currency} /> : null}

      {/* Недовоз, брак, пересорт — в переписку заявки, где продавец и так отвечает. */}
      {order.state === 'ISSUED' ? <RateOrder order={order} /> : null}
      {order.state === 'ISSUED' ? <ReportProblem order={order} /> : null}

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

      {/* Заявка подтверждена — лучший момент позвать сюда остальных поставщиков. */}
      <ReferralCard confirmed={CONFIRMED.has(order.state)} />

      {order.needsAnswer && (
        // Две кнопки одной ширины: согласие и отказ равноправны, и более
        // крупная кнопка читалась бы как подсказка, что выбрать. Слова те же,
        // что в списке заявок: одно действие, названное на двух экранах
        // по-разному, читается как два разных.
        <div
          className={cn(
            'grid grid-cols-2 gap-2',
            // На телефоне ответ — панелью над нижним меню, как в макете: его не надо искать под составом.
            'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-lg:z-20',
            'max-lg:bg-surface max-lg:px-4 max-lg:py-3 max-lg:shadow-[0_-6px_20px_rgba(58,48,30,.1)]',
          )}
        >
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

      {/*
        Счёт-фактура — компании-покупателю: выписывается на реквизиты из профиля.
        Если её выписывает 1С продавца, кнопки нет — документ продавца виден строкой реализации ниже.
      */}
      {order.invoiceAvailable && order.vatInvoiceAvailable && (
        <Button
          variant="outline"
          data-testid="order-vat-invoice"
          disabled={vatBusy}
          onClick={() => void downloadVatInvoice()}
        >
          {vatBusy ? t('orders.invoicePreparing') : t('orders.vatInvoice')}
        </Button>
      )}

      {vatFailed === 'requisites' && (
        <p role="alert" className="text-sm text-ink">
          {t('orders.vatInvoiceNoRequisites')}{' '}
          <Link to="/profile" className="font-semibold text-accent-ink underline">{t('orders.vatInvoiceFill')}</Link>
        </p>
      )}
      {vatFailed === 'failed' && (
        <p role="alert" className="text-sm text-gone">{t('orders.invoiceFailed')}</p>
      )}

      {order.realization1c?.status === 'EXPORTED' && (
        <p data-testid="order-realization" className="text-sm text-ink">
          {order.realization1c.documentNumber
            ? t('orders.realization1c', { number: order.realization1c.documentNumber, day: orderDay(order.realization1c.at) })
            : t('orders.realization1cNoNumber', { day: orderDay(order.realization1c.at) })}
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

      {/* Строкой, а не таблицей (макеты «Кабинет клиента 2.0»): на узком телефоне
          колонки таблицы рвали «2 шт.» и сумму на две строки. */}
      <ul className="flex flex-col divide-y divide-hairline">
        {lines.map((line, index) => {
          const amount = line.amount ?? (line.price === undefined ? undefined : line.price * line.quantity);
          return (
            <li key={`${line.name}-${index}`} data-testid="order-line" className="flex items-center gap-3 py-2.5 text-sm">
              <LinkedLineThumb
                itemId={line.itemId}
                seed={line.itemId ?? line.name}
                src={line.imageUrl}
                label={t('orders.openItem', { name: line.name })}
                className="size-11"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-ink">{line.name}</span>
                {line.pack ? <PackContents label={t('pack.inPress')} members={packMembers(line.pack)} /> : null}
                <span className="tabular-nums text-ink-muted">
                  {line.unit ? quantityWithUnit(line.quantity, line.unit) : decimal(line.quantity)}{packNote(line, t)}
                  {line.price === undefined ? null : <> × {money(line.price, currency)}</>}
                </span>
                {/* Сейчас нет, но продавец ждёт к дате склада — клиент соглашается ждать или отказывается. */}
                {line.expectedOn ? (
                  <span data-testid="order-line-expected" className="text-xs font-semibold text-sale-ink">
                    {t('orders.expectedOn', {
                      date: dayMonth(line.expectedOn),
                    })}
                  </span>
                ) : null}
              </span>
              {amount === undefined ? null : (
                <b className="shrink-0 whitespace-nowrap font-bold tabular-nums text-ink">{money(amount, currency)}</b>
              )}
            </li>
          );
        })}
      </ul>

      <div className="my-2 h-px bg-hairline" />
      <OrderTotals total={total} breakdown={breakdown} currency={currency} />
    </Card>
  );
}

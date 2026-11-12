import { useOrderMode } from '../cart/orderMode';
import { NothingAdded, useStayIfEmpty } from './stayIfEmpty';
import { SaveAsTemplate } from './SaveAsTemplate';
import { useEffect, useState } from 'react';
import { PackContents, packMembers } from '../catalog/PackContents';
import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useQueryClient } from '@tanstack/react-query';
import {
  downloadMyInvoice,
  downloadMyVatInvoice,
  getGetMyPortalOrderQueryKey,
  getGetMyPortalOrdersQueryKey,
  getGetPortalNotificationsQueryKey,
  useFillPortalCartFromOrder,
  useGetPortalNotifications,
  useReadPortalNotification,
  useCancelMyPortalOrder,
  useDeclineMyPortalOrder,
  useGetMyPortalOrder,
  type PortalOrderDto,
  type SnapshotDiffDto,
  type SnapshotLineDto,
  type PortalLineStockDto,
} from '../../api/generated';
import { AskForm, OrderMessages, quoteOf } from './OrderMessages';
import { RateOrder } from './RateOrder';
import { ReportProblem } from './ReportProblem';
import { OrderStateBadge } from './OrderStateBadge';
import { PickupCode } from './PickupCode';
import { BACK } from '../shell/SectionHead';
import { LineAnswers } from './LineAnswers';
import { DeclineDialog } from './DeclineDialog';
import { OrderDelivery } from './OrderDelivery';
import { OrderReturns } from './OrderReturns';
import { OrderTotals, type OrderBreakdown } from './OrderTotals';
import type { Currency } from '../../shared/currency';
import { LinkedLineThumb } from '../cart/LineThumb';
import { StockNote } from '../catalog/StockNote';
import { fileNameFrom, saveFile } from '../../shared/download';
import { dayMonth, decimal, money } from '../../shared/format';
import { quantityWithUnit } from '../../shared/units';
import { answerExpectedText, orderDay, packNote } from './orderText';
import { ReferralCard } from '../referral/ReferralCard';
import { ChevronLeft, MapPin, MessageCircle, MessageCircleQuestion, RotateCcw } from '../../ui/icons';
import { PhoneLine } from '../shell/PhoneLine';
import { MapViewButton } from '../maps/MapViewButton';
import { pointOf } from '../maps/mapProvider';
import { useCurrentShop } from '../shell/Shops';
import { OrderStages } from './OrderStages';
import { kindOf } from './myOrdersModel';
import { isAboutOrder } from '../shell/messageCounts';

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
  // Вопрос продавцу прямо на странице заявки; с цитатой — ответ на конкретный его ответ.
  const [asking, setAsking] = useState<false | { quote?: string }>(false);
  // Отказ от всей заявки — только через окно подтверждения с причиной (W2-05).
  const [declining, setDeclining] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceFailed, setInvoiceFailed] = useState(false);
  const [vatBusy, setVatBusy] = useState(false);
  const [vatFailed, setVatFailed] = useState<'requisites' | 'failed' | null>(null);
  // Телефон — по макету «Заявка»: «Назад» к заявкам, номер, магазин и способ, шкала этапов.
  const shop = useCurrentShop();

  const response = useGetMyPortalOrder(id);
  // Открыл заявку — прочитал её новости: счётчики «Сообщений» и «Моих заявок» уменьшаются.
  // На телефоне список ведёт сюда ссылкой, и гасить их больше негде.
  const notifications = useGetPortalNotifications();
  const read = useReadPortalNotification({
    mutation: { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() }) },
  });
  const unreadHere = (notifications.data?.status === 200 ? notifications.data.data : [])
    .filter((notification) => isAboutOrder(notification, id)).map((notification) => notification.id);
  const opened = response.data?.status === 200;
  useEffect(() => {
    if (opened) unreadHere.forEach((notificationId) => read.mutate({ id: notificationId }));
    // Гасится по составу непрочитанного, а не на каждый рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, unreadHere.join(',')]);
  const order: PortalOrderDto | undefined =
    response.data?.status === 200 ? response.data.data : undefined;

  const refresh = {
    onSuccess: () => {
      setAnswered(true);
      setDeclining(false);
      void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrderQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() });
    },
  };
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

  const busy = decline.isPending || cancel.isPending;
  const declineFailed = decline.isError || cancel.isError
    || (decline.data !== undefined && decline.data.status !== 200)
    || (cancel.data !== undefined && cancel.data.status !== 200);

  return (
    // На мониторе справа — колонка «Есть вопрос?», как в макете SimplePicWebOrder (решение владельца 2026-11-05).
    <div className="lg:flex lg:items-start lg:gap-8">
    <div className="flex min-w-0 flex-1 flex-col gap-4 pb-28">
      {/* Шапка «Варианта Б»: крупная «Назад» к списку, номер, день и магазин, состояние. */}
      <div className="flex min-w-0 items-center gap-3.5 pt-1">
        <Link
          to="/orders"
          aria-label={t('orders.toAll')}
          className={BACK}
        >
          <ChevronLeft aria-hidden="true" className="size-7" />
          <span aria-hidden="true" className="hidden lg:inline">{t('common.back')}</span>
        </Link>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="m-0 truncate text-title font-extrabold leading-tight text-ink lg:text-display">
            {t('orders.v2.title', { number: order.orderNumber })}
          </h1>
          <span className="truncate text-body text-ink-muted">
            {/* Способ — только известный: пусто значит «ещё не определён», а не «самовывоз». */}
            {[t('orders.orderFrom', { day: orderDay(order.createdAt) }), shop?.name,
              order.pickup == null ? null : t(order.pickup ? 'orders.way.pickup' : 'orders.way.delivery')]
              .filter(Boolean).join(' · ')}
          </span>
          <span className="mt-0.5 self-start"><OrderStateBadge state={order.state} /></span>
        </span>
      </div>

      <OrderStages kind={kindOf(order)} delivery={order.pickup === false} />

      {order.answerExpectedBy ? (
        <p data-testid="order-answer-by" className="m-0 text-sm text-ink-muted">{answerExpectedText(order.answerExpectedBy, t)}</p>
      ) : null}
      {/* Имя без фамилии и без личного номера: звонят на общий номер магазина. */}
      {order.managerName ? (
        <p data-testid="order-manager" className="m-0 text-sm text-ink-muted">{t('orders.manager', { name: order.managerName })}</p>
      ) : null}
      {/* Оптовая или розничная — заявки уходят раздельно (решение владельца 2026-11-06). */}
      {order.saleMode ? (
        <p data-testid="order-sale-mode" className={cn('m-0 text-sm font-bold', order.saleMode === 'WHOLESALE' ? 'text-wholesale' : 'text-ink')}>
          {t(`orders.saleMode.${order.saleMode}`)}
        </p>
      ) : null}
      {/* Просил в долг — ждёт решения продавца или уже знает его. */}
      {order.creditRequest ? (
        <p data-testid="order-credit" className={order.creditRequest === 'DECLINED'
          ? 'm-0 text-sm font-semibold text-sale-ink' : 'm-0 text-sm font-semibold text-ink'}>
          {t(`orders.credit.${order.creditRequest}`)}
        </p>
      ) : null}

      {order.pickupCode ? <PickupCode code={order.pickupCode} big /> : null}

      {/* Куда идти за самовывозом — с картой (макет К2.11): код без места мало что даёт. */}
      {order.pickup !== false && order.pickupPoint ? (
        <Card className="flex flex-col gap-2 p-4" data-testid="order-pickup-point">
          <span className="flex items-start gap-2.5">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-ink" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-body font-bold text-ink">{order.pickupPoint.name}</b>
              <span className="text-caption text-ink-muted">
                {[order.pickupPoint.address, order.pickupPoint.workingHours].filter(Boolean).join(' · ')}
              </span>
            </span>
          </span>
          <MapViewButton title={order.pickupPoint.name} address={order.pickupPoint.address}
            point={pointOf(order.pickupPoint.latitude, order.pickupPoint.longitude)} />
        </Card>
      ) : null}

      {order.needsAnswer && (
        <LineAnswers order={order} busy={busy} onAnswered={() => setAnswered(true)}
          onAsk={(quote) => setAsking({ quote })} onDecline={() => setDeclining(true)} />
      )}

      {declining ? (
        <DeclineDialog pending={busy} failed={declineFailed} onStay={() => setDeclining(false)}
          onDecline={(reason, comment) => {
            const data = { reason, comment: comment || undefined };
            if (order.needsAnswer) decline.mutate({ id, data });
            else cancel.mutate({ id, data });
          }} />
      ) : null}

      {/*
        Переписка — здесь, а не в мессенджере: в кабинет приходят те, кто
        в переписке не сидит, и другого места прочитать её у них нет.
        Заявки, поданные до ленты, хранят только `sellerAnswer` — для них
        показывается прежняя карточка одним ответом.
      */}
      {(order.messages ?? []).length > 0 ? (
        <OrderMessages messages={order.messages} onReply={(quote) => setAsking({ quote })} />
      ) : order.sellerAnswer ? (
        <Card className="border-l-2 border-l-accent p-4">
          <p className="text-sm font-medium text-ink-muted">
            {t('orders.sellerAnswer')}
            {order.answeredAt ? ` · ${orderDay(order.answeredAt)}` : ''}
          </p>
          <p className="mt-1 whitespace-pre-line text-body leading-relaxed text-ink">
            {order.sellerAnswer}
          </p>
          <button type="button" onClick={() => setAsking({ quote: quoteOf(order.sellerAnswer ?? '') })}
            className="mt-2 inline-flex cursor-pointer items-center gap-1 text-caption font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <MessageCircle aria-hidden="true" className="size-4" />
            {t('orders.v2.reply')}
          </button>
        </Card>
      ) : null}

      {asking ? (
        <Card className="p-4">
          <AskForm key={asking.quote ?? ''} order={order} quote={asking.quote} onDone={() => setAsking(false)} />
        </Card>
      ) : kindOf(order) === 'done' || kindOf(order) === 'cancelled' ? null : (
        <Button variant="outline" className="self-start" onClick={() => setAsking({})}>
          <MessageCircleQuestion aria-hidden="true" className="size-[18px]" />
          {t('orders.ask')}
        </Button>
      )}

      {order.delivery ? (
        <Card className="p-4">
          <OrderDelivery delivery={order.delivery} />
        </Card>
      ) : null}

      {order.issuedAt && order.id ? <OrderReturns orderId={order.id} currency={order.currency} /> : null}

      {/* Недовоз, брак, пересорт — в переписку заявки, где продавец и так отвечает. */}
      {order.state === 'ISSUED' ? <RateOrder order={order} /> : null}
      {order.state === 'ISSUED' ? <ReportProblem order={order} /> : null}

      <Revision
        title={order.proposed ? t('orders.youSent') : t('orders.contents')}
        lines={order.submitted}
        total={order.total}
        testId="submitted"
        stock={order.stock}
        breakdown={order}
        currency={order.currency}
      />

      {order.proposed && (
        <Revision
          title={t('orders.supplierOffers')}
          lines={order.proposed}
          total={order.proposedTotal ?? 0}
          testId="proposed"
          stock={order.stock}
          currency={order.currency}
          diff={order.diff}
        />
      )}

      {answered && <p className="text-sm text-ink-subtle">{t('orders.answerSent')}</p>}

      {/* Заявка подтверждена — лучший момент позвать сюда остальных поставщиков. */}
      <ReferralCard confirmed={CONFIRMED.has(order.state)} />

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
          {/* «Обмен с сайтом» (путь А) заводит в 1С заказ клиента, наша обработка — реализацию: подпись говорит, что именно. */}
          {order.realization1c.documentKind === 'ORDER'
            ? order.realization1c.documentNumber
              ? t('orders.order1c', { number: order.realization1c.documentNumber, day: orderDay(order.realization1c.at) })
              : t('orders.order1cNoNumber', { day: orderDay(order.realization1c.at) })
            : order.realization1c.documentNumber
              ? t('orders.realization1c', { number: order.realization1c.documentNumber, day: orderDay(order.realization1c.at) })
              : t('orders.realization1cNoNumber', { day: orderDay(order.realization1c.at) })}
        </p>
      )}

      {order.cancellable && !order.needsAnswer && !declining && (
        <Button variant="ghost" disabled={busy} onClick={() => setDeclining(true)}>
          {t('orders.cancel')}
        </Button>
      )}

      {/* На телефоне правой колонки нет — «Сохранить шаблоном» здесь, под заявкой. */}
      <SaveAsTemplate order={order} className="lg:hidden" />
      <Button variant="ghost" onClick={() => navigate('/orders')}>{t('orders.toAll')}</Button>
    </div>
    <OrderHelp order={order} phone={shop?.phone} onAsk={() => setAsking({})} />
    </div>
  );
}

/**
 * Правая колонка заявки на мониторе (макет SimplePicWebOrder): телефон продавца, «Написать продавцу»
 * (форма вопроса по заявке) и «Заказать то же ещё раз». На телефоне её нет — там это есть в самой странице.
 */
function OrderHelp({ order, phone, onAsk }: { order: PortalOrderDto; phone?: string; onAsk: () => void }) {
  const { t } = useTranslation();
  // Товар «оптом и в розницу» ложится в заявку, в которой клиент сейчас (решение владельца 2026-11-06).
  const [orderMode] = useOrderMode();
  const { done, nothing, start } = useStayIfEmpty();
  const repeat = useFillPortalCartFromOrder({ mutation: { onSuccess: done } });
  const ROW = cn('flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface p-4 text-left',
    'transition-colors hover:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-60');
  const ICON = 'flex size-12 shrink-0 items-center justify-center rounded-[0.875rem]';
  const closed = kindOf(order) === 'done' || kindOf(order) === 'cancelled';
  return (
    <aside aria-label={t('orders.help.title')} className="hidden lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:flex lg:w-[22rem] lg:shrink-0 lg:flex-col lg:gap-3">
      <h2 className="m-0 text-title font-extrabold lg:text-display text-ink">{t('orders.help.title')}</h2>
      {phone ? (
        <Card className="p-3.5"><PhoneLine phone={phone} label={t('orders.help.seller')} /></Card>
      ) : null}
      {closed ? null : (
        <button type="button" onClick={onAsk} className={ROW}>
          <span aria-hidden="true" className={cn(ICON, 'bg-ok-soft text-shop-ink')}><MessageCircle className="size-6" /></span>
          <span className="flex min-w-0 flex-col">
            <b className="text-lead font-extrabold text-ink">{t('orders.help.write')}</b>
            <span className="text-caption text-ink-muted">{t('orders.help.writeHint')}</span>
          </span>
        </button>
      )}
      {order.submitted.length > 0 ? (
        <button type="button" disabled={repeat.isPending} onClick={() => { start(); repeat.mutate({ orderId: order.id, params: { mode: orderMode } }); }} className={ROW}>
          <span aria-hidden="true" className={cn(ICON, 'bg-hit-soft text-hit-ink')}><RotateCcw className="size-6" /></span>
          <span className="flex min-w-0 flex-col">
            <b className="text-lead font-extrabold text-ink">{repeat.isPending ? t('orders.collecting') : t('orders.again')}</b>
            <span className="text-caption text-ink-muted">
              {t('orders.help.lines', { count: order.submitted.length, sum: money(order.total, order.currency) })}
            </span>
          </span>
        </button>
      ) : null}
      <NothingAdded skipped={nothing} />
      <SaveAsTemplate order={order} />
    </aside>
  );
}

/** Одна редакция состава: то, что предъявлено, и её итог. */
function Revision({ title, lines, total, testId, breakdown, currency, diff = [], stock = [] }: {
  title: string;
  /** Наличие позиций сейчас — сервер присылает только у открытой заявки. */
  stock?: PortalLineStockDto[];
  /** Отличия предложения: замены и добавленное продавцом выделены оттенком (просьба владельца 2026-11-05). */
  diff?: SnapshotDiffDto[];
  lines: SnapshotLineDto[];
  total: number;
  testId: string;
  /** Разбивка итога — только у отправленной редакции. */
  breakdown?: OrderBreakdown;
  /** Валюта заявки, а не открытого магазина. */
  currency: Currency | undefined;
}) {
  const { t } = useTranslation();
  // Замена и добавление узнаются по позиции каталога, а без неё — по названию.
  const changeOf = (line: SnapshotLineDto) => diff.find((change) =>
    (change.kind === 'LINE_REPLACED' || change.kind === 'LINE_ADDED')
    && (change.itemId && line.itemId ? change.itemId === line.itemId : change.name === line.name));
  return (
    <Card className="p-4" data-testid={testId}>
      <p className="mb-2 font-semibold text-ink">{title}</p>

      {/* Строкой, а не таблицей (макеты «Кабинет клиента 2.0»): на узком телефоне
          колонки таблицы рвали «2 шт.» и сумму на две строки. */}
      <ul className="flex flex-col divide-y divide-hairline">
        {lines.map((line, index) => {
          const amount = line.amount ?? (line.price === undefined ? undefined : line.price * line.quantity);
          const change = changeOf(line);
          return (
            <li key={`${line.name}-${index}`} data-testid="order-line" data-offered={change ? change.kind : undefined}
              className={cn('flex items-center gap-3 py-2.5 text-sm',
                change && '-mx-2 my-0.5 rounded-[var(--radius-control)] border-0 bg-accent-soft px-2')}>
              <LinkedLineThumb
                itemId={line.itemId}
                seed={line.itemId ?? line.name}
                src={line.imageUrl}
                label={t('orders.openItem', { name: line.name })}
                className="size-11"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-ink">{line.name}</span>
                {change ? (
                  <span className="self-start rounded-full bg-accent-ink/10 px-2 py-0.5 text-xs font-extrabold text-accent-ink">
                    {change.kind === 'LINE_REPLACED' && change.replacedName
                      ? t('orders.offeredInstead', { name: change.replacedName })
                      : t('orders.offeredAdded')}
                  </span>
                ) : null}
                {line.pack ? <PackContents label={t('pack.inPress')} members={packMembers(line.pack)} /> : null}
                <span className="tabular-nums text-ink-muted">
                  {line.unit ? quantityWithUnit(line.quantity, line.unit) : decimal(line.quantity)}{packNote(line, t)}
                  {line.price === undefined ? null : <> × {money(line.price, currency)}</>}
                </span>
                <LineStock line={line} stock={stock} />
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

/**
 * Наличие строки открытой заявки — тем же правилом, что в корзине: «уточняется» не пишется,
 * число жёлтое, когда свободного меньше, чем в строке. Строка «будет к дате» уже сказала своё.
 */
function LineStock({ line, stock }: { line: SnapshotLineDto; stock: PortalLineStockDto[] }) {
  const found = line.itemId && !line.expectedOn ? stock.find((s) => s.itemId === line.itemId) : undefined;
  if (!found || (found.available == null && (found.stock == null || found.stock === 'UNKNOWN'))) return null;
  return (
    <StockNote stock={found.stock} available={found.available} needed={line.quantity * (line.packQty ?? 1)}
      short className="mt-0 text-xs" />
  );
}

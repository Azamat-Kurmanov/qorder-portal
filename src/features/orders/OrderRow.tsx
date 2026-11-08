import { useOrderMode } from '../cart/orderMode';
import { NothingAdded, useStayIfEmpty } from './stayIfEmpty';
import { SaveAsTemplate } from './SaveAsTemplate';
import { useId, useState, type ReactNode } from 'react';
import { PhoneLine } from '../shell/PhoneLine';
import { LineAnswers } from './LineAnswers';
import { DeclineDialog } from './DeclineDialog';
import { PackContents, packMembers } from '../catalog/PackContents';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronRight, MessageCircleQuestion, RotateCcw, Star } from '../../ui/icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyPortalOrdersQueryKey,
  useDeclineMyPortalOrder,
  useFillPortalCartFromOrder,
  type PortalOrderDto,
} from '../../api/generated';
import { intlLocale } from '../../i18n';
import { decimal, money } from '../../shared/format';
import { quantityWithUnit } from '../../shared/units';
import { cn } from '../../ui/cn';
import { AskForm, OrderMessages } from './OrderMessages';
import { OrderStages } from './OrderStages';
import { PickupCode } from './PickupCode';
import { useCurrentShop } from '../shell/Shops';
import { telLink } from '../shell/shopHours';
import { OrderDelivery } from './OrderDelivery';
import { MapViewButton } from '../maps/MapViewButton';
import { pointOf } from '../maps/mapProvider';
import { OrderTotals } from './OrderTotals';
import { RateOrder } from './RateOrder';
import { ReportProblem } from './ReportProblem';
import { LineThumb, LinkedLineThumb } from '../cart/LineThumb';
import { answerExpectedText, orderDay, packNote } from './orderText';
import { answerText, kindOf, namedPriceOf, linesOf, totalOf, type OrderKind, type Unread } from './myOrdersModel';

/**
 * Цвет вида заявки: полоса слева и пилюля. Палитра — светлая, кабинета
 * клиента; из макета взята раскладка, а не тёмные цвета.
 */
const TONE: Record<OrderKind, { stripe: string; badge: string; todo: string }> = {
  answer: { stripe: 'bg-sale', badge: 'bg-sale-soft text-sale-ink', todo: 'text-sale-ink' },
  ready: { stripe: 'bg-in-stock', badge: 'bg-ok-soft text-ok-ink', todo: 'text-ok-ink' },
  // Решение владельца 2026-10-30: проверяет — жёлтым, принята — синим, получена — зелёным, отменена — красным.
  review: { stripe: 'bg-hit-ink', badge: 'bg-hit-soft text-hit-ink', todo: 'text-ink-muted' },
  accepted: { stripe: 'bg-wholesale-ink', badge: 'bg-wholesale-soft text-wholesale-ink', todo: 'text-ink-muted' },
  done: { stripe: 'bg-ok-ink', badge: 'bg-ok-soft text-ok-ink', todo: 'text-ink-muted' },
  cancelled: { stripe: 'bg-gone/50', badge: 'bg-sunk text-gone', todo: 'text-ink-muted' },
};


/**
 * Строка, которой назван вид заявки: у собранной с доставкой — своя,
 * забирать её в магазине не нужно.
 */
function variantKey(order: PortalOrderDto, kind: OrderKind): string {
  return kind === 'ready' && order.pickup === false ? 'readyDelivery' : kind;
}

/**
/**
 * Строка списка слева на мониторе («Вариант Б»): снимок, номер и день, вид заявки, сумма.
 * Нажатием открывает заявку в панели справа.
 */
export function OrderPick({ order, unread, selected, onPick }: {
  order: PortalOrderDto;
  unread?: Unread;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="order-row"
      aria-pressed={selected}
      onClick={onPick}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-card)] border-solid bg-surface px-3.5 py-3 text-left',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected ? 'border-[3px] border-shop bg-ok-soft/40' : 'border-2 border-hairline hover:border-line',
      )}
    >
      <PickLines order={order} unread={unread} />
    </button>
  );
}

/**
 * Заявка карточкой на телефоне (макет SimplePicOrders): у ждущей ответа — что случилось
 * и «Посмотреть и ответить», у собранной — код для получения; остальные — короткой строкой.
 * Всё о заявке — на её экране, а не раскрытием в списке.
 */
export function OrderLink({ order, unread }: { order: PortalOrderDto; unread?: Unread }) {
  const { t } = useTranslation();
  const kind = kindOf(order);
  if (kind === 'answer' || (kind === 'ready' && order.pickupCode)) {
    const answer = kind === 'answer';
    return (
      <article
        data-testid="order-row"
        aria-label={t('orders.v2.title', { number: order.orderNumber })}
        className={cn('flex flex-col gap-2.5 rounded-[var(--radius-card)] border-[3px] border-solid bg-surface p-4', answer ? 'border-sale' : 'border-shop')}
      >
        <span className="flex items-center justify-between gap-2">
          <Pill kind={kind} big />
          <b className="whitespace-nowrap text-lead font-extrabold tabular-nums text-ink">{money(totalOf(order), order.currency)}</b>
        </span>
        {answer ? <p className="m-0 text-lead font-extrabold text-ink">{answerText(order, t)}</p> : null}
        {!answer && order.pickupCode ? <PickupCode code={order.pickupCode} /> : null}
        <p className="m-0 flex items-center gap-2 text-caption text-ink-muted">
          {unread ? <span role="img" aria-label={t('orders.v2.new')} className="size-2.5 shrink-0 rounded-full bg-sale" /> : null}
          {t('orders.v2.title', { number: order.orderNumber })} · {orderDay(order.createdAt)} · {t('orders.v2.goods', { count: linesOf(order).length })}
        </p>
        <Link to={`/orders/${order.id}`} className={answer ? BIG_PRIMARY : BIG_SECONDARY}>
          {t(answer ? 'orders.v2.viewAnswer' : 'orders.v2.open')}
          <ChevronRight aria-hidden="true" className="size-6" />
        </Link>
      </article>
    );
  }
  return (
    <Link
      to={`/orders/${order.id}`}
      data-testid="order-row"
      className="flex items-center gap-3 rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface px-3.5 py-3 text-ink no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <PickLines order={order} unread={unread} />
    </Link>
  );
}

/** Пилюля вида заявки — цвета макета: ответ — тёплым, забрать — зелёным, проверка — жёлтым. */
function Pill({ kind, big = false }: { kind: OrderKind; big?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-extrabold',
      big ? 'h-8 px-3.5 text-caption' : 'mt-1 h-7 px-3 text-caption', TONE[kind].badge)}>
      {kind === 'done' ? <Check aria-hidden="true" className="size-3.5" /> : null}
      {t(`orders.v2.kind.${kind}`)}
    </span>
  );
}

function PickLines({ order, unread }: { order: PortalOrderDto; unread?: Unread }) {
  const { t } = useTranslation();
  const kind = kindOf(order);
  const first = linesOf(order)[0];
  return (
    <>
      <LineThumb seed={first?.itemId ?? first?.name ?? order.id} src={first?.imageUrl} className="size-14 rounded-[0.875rem]" />
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span className="flex max-w-full items-center gap-2 text-body font-extrabold text-ink">
          <span className="truncate">{t('orders.v2.title', { number: order.orderNumber })} · {orderDay(order.createdAt)}</span>
          {unread ? <span role="img" aria-label={t('orders.v2.new')} className="size-2.5 shrink-0 rounded-full bg-sale" /> : null}
        </span>
        <Pill kind={kind} />
      </span>
      <b className="whitespace-nowrap text-body font-extrabold tabular-nums text-ink">{money(totalOf(order), order.currency)}</b>
    </>
  );
}

const BIG_PRIMARY = cn(
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-[var(--radius-control)] border-2 border-solid border-shop bg-shop px-4',
  'text-base font-extrabold text-on-shop no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
);
const BIG_SECONDARY = cn(
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-[var(--radius-control)] border-2 border-solid border-shop bg-surface px-4',
  'text-base font-extrabold text-shop-ink no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

/** Заявка панелью справа на мониторе (макет ПК-К5): заголовок, сумма и всё о ней — без раскрытия. */
export function OrderPane({ order }: { order: PortalOrderDto }) {
  const { t } = useTranslation();
  const kind = kindOf(order);
  return (
    <article
      data-testid="order-pane"
      aria-label={t('orders.v2.title', { number: order.orderNumber })}
      className="overflow-hidden rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface"
    >
      <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-display font-black tracking-[-0.02em] text-ink">{t('orders.v2.title', { number: order.orderNumber })}</h2>
          <span className={cn('text-sm font-semibold', TONE[kind].todo)}>{t(`orders.v2.todo.${variantKey(order, kind)}`)}</span>
        </div>
        <span className="flex shrink-0 flex-col items-end">
          <span className="whitespace-nowrap text-2xl font-black tabular-nums text-ink">{money(totalOf(order), order.currency)}</span>
          <span className="text-2xs text-ink-subtle">{t('orders.v2.payOnPickup')}</span>
        </span>
      </div>
      <OrderDetails order={order} kind={kind} variant={variantKey(order, kind)} />
    </article>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-2xs font-bold uppercase tracking-[0.06em] text-ink-subtle">{children}</span>;
}

function OrderDetails({ order, kind, variant }: { order: PortalOrderDto; kind: OrderKind; variant: string }) {
  const { t } = useTranslation();
  const lines = linesOf(order);
  // Открыта ли форма вопроса и на какой ответ продавца он отвечает.
  const [asking, setAsking] = useState<false | { quote?: string }>(false);
  const finished = kind === 'done' || kind === 'cancelled';
  // Звонок — магазину, у которого заявка: кабинет открыт на нём.
  const shop = useCurrentShop();
  const tel = telLink(shop?.phone);
  const placed = new Date(order.createdAt);
  const placedText = Number.isNaN(placed.getTime()) ? order.createdAt
    : `${orderDay(order.createdAt)}, ${new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(placed)}`;
  const whereText = kind === 'cancelled' && order.closedBy
    ? t(`orders.v2.event.${order.closedBy}`)
    : kind === 'answer' ? answerText(order, t) : t(`orders.v2.whereText.${variant}`);

  return (
    <div className="flex flex-col border-0 border-t border-solid border-hairline">
      <div className="grid gap-4 bg-sunk px-5 py-4 sm:grid-cols-[1fr_1.5fr_auto]">
        <div className="flex flex-col gap-1">
          <Label>{t('orders.v2.where')}</Label>
          <span className="text-sm font-semibold text-ink">{whereText}</span>
          {order.answerExpectedBy ? (
            <span data-testid="order-answer-by" className="text-sm text-ink-muted">{answerExpectedText(order.answerExpectedBy, t)}</span>
          ) : null}
          {order.managerName ? (
            <span data-testid="order-manager" className="text-sm text-ink-muted">{t('orders.manager', { name: order.managerName })}</span>
          ) : null}
          {order.saleMode ? (
            <span data-testid="order-sale-mode" className={cn('text-sm font-bold', order.saleMode === 'WHOLESALE' ? 'text-wholesale' : 'text-ink')}>
              {t(`orders.saleMode.${order.saleMode}`)}
            </span>
          ) : null}
          {order.creditRequest ? (
            <span data-testid="order-credit" className={cn('text-sm font-semibold', order.creditRequest === 'DECLINED' ? 'text-sale-ink' : 'text-ink')}>
              {t(`orders.credit.${order.creditRequest}`)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t('orders.v2.todoTitle')}</Label>
          <span className={cn('text-sm font-semibold', kind === 'answer' || kind === 'ready' ? TONE[kind].todo : 'text-ink')}>
            {kind === 'answer' && namedPriceOf(order) ? t('orders.v2.doText.priceNamed') : t(`orders.v2.doText.${variant}`)}
          </span>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <Label>{t('orders.v2.placed')}</Label>
          <span className="text-sm text-ink">{placedText}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <OrderStages kind={kind} delivery={variant === 'readyDelivery' || order.pickup === false} />

        {order.cancelReason ? (
          <p className="m-0 rounded-[var(--radius-control)] bg-sunk px-4 py-3 text-sm text-ink">
            <b className="font-semibold">{t('orders.v2.reason')}:</b> {order.cancelReason}
          </p>
        ) : null}

        <section className="flex flex-col gap-2" aria-label={t('orders.v2.ordered')}>
          <Label>{t('orders.v2.ordered')}</Label>
          <ul className="m-0 flex list-none flex-col p-0">
            {lines.map((line, index) => (
              <li key={`${line.name}-${index}`} className="flex items-center gap-3 border-0 border-b border-solid border-hairline py-2 text-sm">
                {/* Снимок — чтобы узнать товар с одного взгляда; нажатием открывает его карточку. */}
                <LinkedLineThumb
                  itemId={line.itemId}
                  seed={line.itemId ?? line.name}
                  src={line.imageUrl}
                  label={t('orders.openItem', { name: line.name })}
                  className="size-11"
                />
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="flex min-w-0 basis-full flex-col text-ink sm:basis-0 sm:flex-1">
                    {line.name}
                    {line.pack ? <PackContents label={t('pack.inPress')} members={packMembers(line.pack)} /> : null}
                  </span>
                  <span className="shrink-0 text-caption tabular-nums text-ink-subtle">
                    {line.unit ? quantityWithUnit(line.quantity, line.unit) : decimal(line.quantity)}{line.price !== undefined ? ` × ${money(line.price, order.currency)}` : ''}{packNote(line, t)}
                  </span>
                  <span className="ml-auto shrink-0 text-right font-bold tabular-nums text-ink sm:ml-0 sm:w-28">
                    {line.amount !== undefined ? money(line.amount, order.currency) : '—'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {order.delivery ? <OrderDelivery delivery={order.delivery} /> : null}
          {/* Разбивка — у отправленного состава; предложенный продавцом идёт одним итогом. */}
          <OrderTotals
            total={totalOf(order)}
            breakdown={lines === order.submitted ? order : undefined}
            currency={order.currency}
            className="pt-1"
          />
        </section>

        {kind === 'answer' ? <Changes order={order} onAsk={(quote) => setAsking({ quote })} /> : null}

        {kind === 'ready' && (order.pickupPoint || order.pickupCode) ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {order.pickupPoint ? (
              <div className="flex flex-col gap-1 rounded-[var(--radius-control)] bg-ok-soft px-4 py-3">
                <Label>{t('orders.v2.pickupAt')}</Label>
                <span className="text-sm font-semibold text-ink">
                  {[order.pickupPoint.name, order.pickupPoint.address, order.pickupPoint.workingHours].filter(Boolean).join(' · ')}
                </span>
                <MapViewButton title={order.pickupPoint.name} address={order.pickupPoint.address}
                  point={pointOf(order.pickupPoint.latitude, order.pickupPoint.longitude)} className="mt-1.5" />
              </div>
            ) : null}
            {order.pickupCode ? <PickupCode code={order.pickupCode} /> : null}
          </div>
        ) : null}

        <OrderMessages messages={order.messages} onReply={(quote) => setAsking({ quote })} />

        {asking ? <AskForm key={asking.quote ?? ''} order={order} quote={asking.quote} onDone={() => setAsking(false)} /> : null}

        <div className="flex flex-wrap gap-2">
          {kind === 'done' ? <RateItems order={order} /> : null}
          {kind === 'done' ? <RateOrder order={order} /> : null}
          {kind === 'done' ? <ReportProblem order={order} /> : null}
          {/* Как в макете: у идущей заявки — вопрос продавцу, у завершённой — повтор. */}
          {!finished && !asking ? (
            <button type="button" className={SECONDARY} onClick={() => setAsking({})}>
              <MessageCircleQuestion aria-hidden="true" className="size-[18px]" />
              {t('orders.ask')}
            </button>
          ) : null}
          {!finished && tel ? (
            <PhoneLine phone={shop?.phone} callLabel={t('orders.callSeller')} className="px-1" />
          ) : null}
          {finished ? <RepeatThis order={order} /> : null}
          {finished ? <SaveAsTemplate order={order} /> : null}
          <Link to={`/orders/${order.id}`} className={SECONDARY}>{t('orders.v2.open')}</Link>
        </div>
      </div>
    </div>
  );
}

/**
 * «Оценить товар» у полученной заявки — к отзывам в карточке товара.
 *
 * Один товар — сразу ссылка на его отзывы. Несколько — кнопка раскрывает
 * список товаров заявки, и клиент выбирает, какой оценить. Снятый с продажи
 * (без `itemId`) назван, но без ссылки: карточки у него больше нет.
 * Если оценить нечего совсем, кнопки нет.
 */
function RateItems({ order }: { order: PortalOrderDto }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const reviews = useCurrentShop()?.reviews;
  const lines = linesOf(order);
  // Отзывы выключены у магазина (R-17) — оценивать товар негде.
  if (!reviews || !lines.some((line) => line.itemId)) return null;

  if (lines.length === 1) {
    return (
      <Link to={`/catalog/${lines[0].itemId}#reviews`} className={PRIMARY}>
        <Star aria-hidden="true" className="size-[18px]" />
        {t('orders.v2.rate')}
      </Link>
    );
  }

  return (
    <div className="flex basis-full flex-col gap-2">
      <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((value) => !value)}
        className={cn(PRIMARY, 'self-start border-0')}>
        <Star aria-hidden="true" className="size-[18px]" />
        {t('orders.v2.rate')}
        <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <ul id={listId} hidden={!open} aria-label={t('orders.v2.rateWhich')}
        className="m-0 flex list-none flex-col gap-1 p-0">
        {lines.map((line, index) => (
          <li key={`${line.name}-${index}`}>
            {line.itemId ? (
              <Link to={`/catalog/${line.itemId}#reviews`} aria-label={t('orders.v2.rateItem', { name: line.name })}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-2 py-1 text-sm text-ink no-underline',
                  'transition-colors duration-200 hover:bg-sunk',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}>
                <LinkedLineThumb linked={false} seed={line.itemId} src={line.imageUrl} className="size-9" />
                <span className="min-w-0 flex-1">{line.name}</span>
                <Star aria-hidden="true" className="size-4 shrink-0 text-accent-ink" />
              </Link>
            ) : (
              <span className="flex min-h-11 items-center gap-3 px-2 py-1 text-sm text-ink-subtle">
                <LinkedLineThumb seed={line.name} src={line.imageUrl} className="size-9" />
                <span className="min-w-0 flex-1">{line.name}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Главное действие: заливка акцентом, 44 точки в высоту. */
const PRIMARY = cn(
  'inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] bg-accent px-4',
  'text-sm font-bold text-on-accent no-underline transition-colors duration-200 hover:bg-accent-hover',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
);

/** Вторичное действие: обводка, 44 точки в высоту. */
const SECONDARY = cn(
  'inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface px-4',
  'text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

/**
 * «Поставщик предлагает изменения» — тот же ответ по строкам, что на экране заявки
 * (замена названа заменой, у неё карточка товара), и отказ только через окно с причиной.
 * Раньше здесь была фраза и «Согласен» — замену из неё было не понять.
 */
function Changes({ order, onAsk }: { order: PortalOrderDto; onAsk: (quote: string) => void }) {
  const queryClient = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const decline = useDeclineMyPortalOrder({
    mutation: {
      onSuccess: () => {
        setDeclining(false);
        void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() });
      },
    },
  });
  const failed = decline.isError || (decline.data !== undefined && decline.data.status !== 200);
  return (
    <div className="flex flex-col gap-3">
      <LineAnswers order={order} busy={decline.isPending} onAsk={onAsk}
        onDecline={() => setDeclining(true)} onAnswered={() => {}} />
      {declining ? (
        <DeclineDialog pending={decline.isPending} failed={failed} onStay={() => setDeclining(false)}
          onDecline={(reason, comment) => decline.mutate({ id: order.id, data: { reason, comment: comment || undefined } })} />
      ) : null}
    </div>
  );
}

/**
 * «Заказать то же ещё раз» — состав ЭТОЙ заявки в корзину и сразу к оформлению.
 * Пропавшее из продажи приходит в корзине списком «не добавлено».
 */
function RepeatThis({ order }: { order: PortalOrderDto }) {
  const { t } = useTranslation();
  // Товар «оптом и в розницу» ложится в заявку, в которой клиент сейчас (решение владельца 2026-11-06).
  const [orderMode] = useOrderMode();
  const { done, nothing, start } = useStayIfEmpty();
  const repeat = useFillPortalCartFromOrder({ mutation: { onSuccess: done } });
  return (
    <>
      <button
        type="button"
        className={SECONDARY}
        disabled={repeat.isPending}
        aria-label={`${t('orders.again')}: ${t('orders.v2.title', { number: order.orderNumber })}`}
        onClick={() => { start(); repeat.mutate({ orderId: order.id, params: { mode: orderMode } }); }}
      >
        <RotateCcw aria-hidden="true" className="size-[18px]" />
        {repeat.isPending ? t('orders.collecting') : t('orders.again')}
      </button>
      <NothingAdded skipped={nothing} />
    </>
  );
}

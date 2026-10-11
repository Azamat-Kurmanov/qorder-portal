import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { PackContents, packMembers } from '../catalog/PackContents';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, MessageCircle, MessageCircleQuestion, Phone, RotateCcw, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyPortalOrdersQueryKey,
  getGetPortalCartQueryKey,
  useAskAboutMyPortalOrder,
  useConfirmMyPortalOrder,
  useDeclineMyPortalOrder,
  useFillPortalCartFromOrder,
  type PortalOrderDto,
} from '../../api/generated';
import { rules } from '../../api/rules.generated';
import { intlLocale } from '../../i18n';
import { decimal, money } from '../../shared/format';
import { quantityWithUnit } from '../../shared/units';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { sendOnEnter } from '../../ui/sendOnEnter';
import { OrderMessages } from './OrderMessages';
import { OrderStages } from './OrderStages';
import { PickupCode } from './PickupCode';
import { useCurrentShop } from '../shell/Shops';
import { telLink } from '../shell/shopHours';
import { RevisionDiff } from './RevisionDiff';
import { OrderDelivery } from './OrderDelivery';
import { MapViewButton } from '../maps/MapViewButton';
import { pointOf } from '../maps/mapProvider';
import { TransportPayment } from './TransportPayment';
import { OrderTotals } from './OrderTotals';
import { LinkedLineThumb } from '../cart/LineThumb';
import { orderDay, packNote } from './orderText';
import { kindOf, lastMessage, linesOf, pieces, totalOf, type OrderKind, type Unread } from './myOrdersModel';

/**
 * Цвет вида заявки: полоса слева и пилюля. Палитра — светлая, кабинета
 * клиента; из макета взята раскладка, а не тёмные цвета.
 */
const TONE: Record<OrderKind, { stripe: string; badge: string; todo: string }> = {
  answer: { stripe: 'bg-accent', badge: 'bg-accent-soft text-accent-ink', todo: 'text-accent-ink' },
  ready: { stripe: 'bg-in-stock', badge: 'bg-ok-soft text-ok-ink', todo: 'text-ok-ink' },
  review: { stripe: 'bg-brand', badge: 'bg-brand-soft text-brand', todo: 'text-ink-muted' },
  accepted: { stripe: 'bg-ok-ink/50', badge: 'bg-sage-soft text-ok-ink', todo: 'text-ink-muted' },
  done: { stripe: 'bg-ink-faint', badge: 'bg-sunk text-ink-muted', todo: 'text-ink-muted' },
  cancelled: { stripe: 'bg-gone/50', badge: 'bg-sunk text-gone', todo: 'text-ink-muted' },
};

/** Время сообщения: «сегодня, 11:40» или «21 сентября, 10:05». */
function when(iso: string, t: (key: string) => string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(date);
  const today = new Date().toDateString() === date.toDateString();
  return `${today ? t('orders.v2.today') : orderDay(iso)}, ${time}`;
}

/**
 * Строка, которой назван вид заявки: у собранной с доставкой — своя,
 * забирать её в магазине не нужно.
 */
function variantKey(order: PortalOrderDto, kind: OrderKind): string {
  return kind === 'ready' && order.pickup === false ? 'readyDelivery' : kind;
}

/**
 * Заявка в списке: свёрнутая строка и раскрытые подробности.
 *
 * Заголовок — кнопка раскрытия целиком, а не маленькая стрелка: по строке
 * списка попадают пальцем, и цель должна быть большой. Кнопки подробностей
 * лежат ниже, вне заголовка, — кнопка в кнопке недопустима.
 */
export function OrderRow({ order, unread, open, onToggle }: {
  order: PortalOrderDto;
  unread?: Unread;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const kind = kindOf(order);
  const tone = TONE[kind];
  const variant = variantKey(order, kind);
  const last = lastMessage(order, unread);
  const lines = linesOf(order);
  const detailsId = useId();
  const eventText = kind === 'cancelled'
    ? t(`orders.v2.event.${order.closedBy ?? 'cancelled'}`)
    : t(`orders.v2.event.${variant}`);

  return (
    <article
      data-testid="order-row"
      aria-label={t('orders.v2.title', { number: order.orderNumber })}
      className={cn(
        'overflow-hidden rounded-[var(--radius-card)] shadow-[0_0_0_1px_var(--color-hairline)]',
        // Где ход за клиентом, рамка цвета вида; новое — чуть тёплым фоном.
        unread ? 'bg-accent-soft/40' : 'bg-surface',
        kind === 'answer' && 'shadow-[0_0_0_1.5px_var(--color-accent)]',
        kind === 'ready' && 'shadow-[0_0_0_1.5px_var(--color-in-stock)]',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        aria-label={t('orders.v2.details', { number: order.orderNumber })}
        onClick={onToggle}
        className={cn(
          'flex w-full cursor-pointer items-stretch gap-4 bg-transparent p-4 text-left lg:px-5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        )}
      >
        <span aria-hidden="true" className={cn('w-1.5 shrink-0 rounded-full', tone.stripe)} />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className={cn('inline-flex h-6 items-center rounded-md px-2 text-xs font-bold', tone.badge)}>
              {t(`orders.v2.kind.${kind}`)}
            </span>
            <span className="text-base font-extrabold text-ink">{t('orders.v2.title', { number: order.orderNumber })}</span>
            <span className="text-caption text-ink-subtle">
              {t('orders.v2.meta', {
                day: orderDay(order.createdAt),
                goods: t('orders.v2.goods', { count: lines.length }),
                pieces: decimal(pieces(order)),
              })}
            </span>
          </span>
          <span className={cn('text-sm font-semibold', tone.todo)}>{t(`orders.v2.todo.${variant}`)}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-caption sm:flex-nowrap">
            {unread ? (
              <span className="inline-flex h-5 shrink-0 items-center rounded bg-accent px-1.5 text-[0.6562rem] font-extrabold uppercase tracking-[0.04em] text-on-accent">
                {t('orders.v2.new')}
              </span>
            ) : null}
            <MessageCircle aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
            <span className={cn('min-w-0 sm:truncate', unread ? 'font-semibold text-ink' : 'text-ink-muted')}>
              {last.text ? (last.fromCustomer ? `${t('orders.v2.you')} ${last.text}` : last.text) : eventText}
            </span>
            <span className="shrink-0 text-ink-faint">· {when(last.at, t)}</span>
          </span>
          {/* На узком экране сумма уходит под текст: справа ей не хватает места. */}
          <span className="flex items-baseline gap-2 sm:hidden">
            <span className="text-lg font-extrabold tabular-nums text-ink">{money(totalOf(order), order.currency)}</span>
            <span className="text-[0.7188rem] text-ink-subtle">{t('orders.v2.payOnPickup')}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-start gap-3">
          <span className="hidden flex-col items-end sm:flex">
            <span className="text-xl font-extrabold tabular-nums tracking-[-0.01em] text-ink">{money(totalOf(order), order.currency)}</span>
            <span className="text-[0.7188rem] text-ink-subtle">{t('orders.v2.payOnPickup')}</span>
          </span>
          <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] shadow-[0_0_0_1px_var(--color-line)]">
            <ChevronDown className={cn('size-4 text-ink transition-transform duration-200', open && 'rotate-180')} />
          </span>
        </span>
      </button>

      <div id={detailsId} hidden={!open}>
        {open ? <OrderDetails order={order} kind={kind} variant={variant} /> : null}
      </div>
    </article>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-2xs font-bold uppercase tracking-[0.06em] text-ink-subtle">{children}</span>;
}

function OrderDetails({ order, kind, variant }: { order: PortalOrderDto; kind: OrderKind; variant: string }) {
  const { t } = useTranslation();
  const lines = linesOf(order);
  const [asking, setAsking] = useState(false);
  const finished = kind === 'done' || kind === 'cancelled';
  // Звонок — магазину, у которого заявка: кабинет открыт на нём.
  const tel = telLink(useCurrentShop()?.phone);
  const placed = new Date(order.createdAt);
  const placedText = Number.isNaN(placed.getTime()) ? order.createdAt
    : `${orderDay(order.createdAt)}, ${new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(placed)}`;
  const whereText = kind === 'cancelled' && order.closedBy
    ? t(`orders.v2.event.${order.closedBy}`)
    : t(`orders.v2.whereText.${variant}`);

  return (
    <div className="flex flex-col border-0 border-t border-solid border-hairline">
      <div className="grid gap-4 bg-sunk px-5 py-4 sm:grid-cols-[1fr_1.5fr_auto]">
        <div className="flex flex-col gap-1">
          <Label>{t('orders.v2.where')}</Label>
          <span className="text-sm font-semibold text-ink">{whereText}</span>
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t('orders.v2.todoTitle')}</Label>
          <span className={cn('text-sm font-semibold', kind === 'answer' || kind === 'ready' ? TONE[kind].todo : 'text-ink')}>
            {t(`orders.v2.doText.${variant}`)}
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
          {order.transportPayment ? (
            <TransportPayment orderId={order.id} payment={order.transportPayment} currency={order.currency} />
          ) : null}
          {/* Разбивка — у отправленного состава; предложенный продавцом идёт одним итогом. */}
          <OrderTotals
            total={totalOf(order)}
            breakdown={lines === order.submitted ? order : undefined}
            currency={order.currency}
            className="pt-1"
          />
        </section>

        {kind === 'answer' ? <Changes order={order} /> : null}

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

        <OrderMessages messages={order.messages} />

        {asking ? <AskForm order={order} onDone={() => setAsking(false)} /> : null}

        <div className="flex flex-wrap gap-2">
          {kind === 'done' ? <RateItems order={order} /> : null}
          {/* Как в макете: у идущей заявки — вопрос продавцу, у завершённой — повтор. */}
          {!finished && !asking ? (
            <button type="button" className={SECONDARY} onClick={() => setAsking(true)}>
              <MessageCircleQuestion aria-hidden="true" className="size-[18px]" />
              {t('orders.ask')}
            </button>
          ) : null}
          {!finished && tel ? (
            // Обычная ссылка, а не `<Link>`: у `tel:` своя схема адреса.
            <a href={tel} className={SECONDARY}>
              <Phone aria-hidden="true" className="size-[18px]" />
              {t('orders.callSeller')}
            </a>
          ) : null}
          {finished ? <RepeatThis order={order} /> : null}
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
  const lines = linesOf(order);
  if (!lines.some((line) => line.itemId)) return null;

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
 * «Что изменил продавец» и ответ на это.
 *
 * Оба действия необратимы, поэтому названы вместе с заявкой: «Согласен»
 * само по себе не отличить от соседнего ни на слух, ни в перечне диктора.
 */
function Changes({ order }: { order: PortalOrderDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const day = orderDay(order.createdAt);
  const refresh = {
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() }),
  };
  const confirm = useConfirmMyPortalOrder({ mutation: refresh });
  const decline = useDeclineMyPortalOrder({ mutation: refresh });
  const busy = confirm.isPending || decline.isPending;
  const changedTotal = order.proposedTotal !== undefined && order.proposedTotal !== order.total;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-control)] bg-accent-soft px-4 py-3">
      <div className="flex min-w-0 basis-full flex-col gap-1 sm:basis-0 sm:flex-1">
        <Label>{t('orders.v2.changed')}</Label>
        <RevisionDiff diff={order.diff} variant="sentence" currency={order.currency} />
        {changedTotal ? (
          <span className="text-sm text-ink">
            {t('orders.v2.sum')}{' '}
            <s className="text-ink-faint">{money(order.total, order.currency)}</s>
            {' → '}
            <b className="font-extrabold">{money(order.proposedTotal as number, order.currency)}</b>
          </span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button variant="accent" aria-label={t('orders.agreeAria', { day })} disabled={busy}
          onClick={() => confirm.mutate({ id: order.id })}>
          {confirm.isPending ? t('orders.sending') : t('orders.agree')}
        </Button>
        <Button variant="outline" aria-label={t('orders.cancelAria', { day })} disabled={busy}
          onClick={() => decline.mutate({ id: order.id })}>
          {decline.isPending ? t('orders.sending') : t('orders.decline')}
        </Button>
      </div>
    </div>
  );
}

/** Вопрос продавцу по этой заявке: уходит в её переписку. */
function AskForm({ order, onDone }: { order: PortalOrderDto; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const fieldId = useId();
  const ask = useAskAboutMyPortalOrder({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() });
        onDone();
      },
    },
  });
  const failed = ask.isError || (ask.data !== undefined && ask.data.status !== 200);

  const send = () => {
    if (!text.trim() || ask.isPending) return;
    ask.mutate({ id: order.id, data: { text: text.trim() } });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-semibold text-ink">{t('orders.v2.askLabel')}</label>
      <textarea
        id={fieldId}
        rows={3}
        maxLength={rules.AskAboutOrderRequest.text.maxLength}
        autoFocus
        value={text}
        placeholder={t('orders.v2.askPlaceholder')}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={sendOnEnter(send)}
        className="resize-y rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
      />
      {failed ? <p role="alert" className="m-0 text-sm text-gone">{t('orders.v2.askFailed')}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="accent" disabled={!text.trim() || ask.isPending}>
          {ask.isPending ? t('orders.sending') : t('orders.v2.send')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>{t('orders.v2.askCancel')}</Button>
      </div>
    </form>
  );
}

/**
 * «Заказать то же ещё раз» — состав ЭТОЙ заявки в корзину и сразу к оформлению.
 * Пропавшее из продажи приходит в корзине списком «не добавлено».
 */
function RepeatThis({ order }: { order: PortalOrderDto }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const repeat = useFillPortalCartFromOrder({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        queryClient.setQueryData(getGetPortalCartQueryKey(), response);
        navigate('/checkout');
      },
    },
  });
  return (
    <button
      type="button"
      className={SECONDARY}
      disabled={repeat.isPending}
      aria-label={`${t('orders.again')}: ${t('orders.v2.title', { number: order.orderNumber })}`}
      onClick={() => repeat.mutate({ orderId: order.id })}
    >
      <RotateCcw aria-hidden="true" className="size-[18px]" />
      {repeat.isPending ? t('orders.collecting') : t('orders.again')}
    </button>
  );
}

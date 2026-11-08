import { SectionHead } from '../shell/SectionHead';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalDebtQueryKey,
  useClaimPortalDebtPayment,
  useGetPortalDebt,
  type CustomerDebtDto,
  type CustomerDebtLine,
  type DebtClaimDto,
  DebtClaimRequestBankTarget,
  type DebtClaimRequestMethod,
} from '../../api/generated';
import { rules } from '../../api/rules.generated';
import { money, shortDate } from '../../shared/format';
import { sizedPhoto } from '../../ui/sizedPhoto';
import { CHIP_ROW } from '../../ui/chipRow';

/** Сумма одним куском: знак валюты не уходит на следующую строку один. */
const whole = (text: string) => text.replace(/ /g, '\u00a0');
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { LoadFailed } from '../../ui/LoadFailed';
import { LineThumb } from '../cart/LineThumb';
import { Bank, Check, Clock, CreditCard, Send, Wallet } from '../../ui/icons';

const INPUT = 'h-10 rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-sm text-ink';
const BANK_TARGETS = Object.values(DebtClaimRequestBankTarget);
const STATUS_LOOK: Record<DebtClaimDto['status'], string> = {
  PENDING: 'bg-sunk text-ink-muted',
  CONFIRMED: 'bg-accent-soft text-accent-ink',
  REJECTED: 'bg-sale-soft text-sale-ink',
};

/** Название банка по коду — из справочника платформы (со скрытыми): им названы и прошлые оплаты. */
const bankName = (banks: CustomerDebtDto['banks'], code: string) => banks.find((one) => one.code === code)?.name ?? code;

/** Сколько ещё можно заявить за строку: остаток минус уже сообщённое и не подтверждённое. */
const open = (line: CustomerDebtLine) => Math.max(0, line.debt - line.pending);

/**
 * «Долг»: что клиент взял в долг или под реализацию, что вернул и оплатил и сколько осталось —
 * по заказам и товарам. «Я оплатил» — за выбранные товары; долг уменьшается, только когда
 * продавец подтвердит, а до того сумма видна «на подтверждении»: обе стороны ведут один счёт.
 */
export function DebtPage() {
  const { t, i18n } = useTranslation();
  const currency = useSupplierCurrency();
  const response = useGetPortalDebt();
  const [paying, setPaying] = useState(false);
  const debt = response.data?.status === 200 ? response.data.data : undefined;

  if (response.isError) {
    return (
      <div className="flex flex-col gap-3">
        <SectionHead title={t('debt.title')} />
        <LoadFailed onRetry={() => void response.refetch()} />
      </div>
    );
  }
  if (!debt) return <SectionHead title={t('debt.title')} />;
  if (debt.orders.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <SectionHead title={t('debt.title')} />
        <p className="text-base text-ink-muted">{t('debt.empty')}</p>
      </div>
    );
  }

  const sum = (value: number) => money(value, currency);
  const nextPlan = debt.plan.find((item) => item.left > 0);
  const longDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' });
  const openClaims = debt.claims.filter((claim) => claim.status !== 'CONFIRMED');
  // Все выплаты по всем заказам, свежие сверху: когда, сколько, чем и за какие товары.
  const payments = debt.orders
    .flatMap((order) => order.payments.map((payment) => ({ payment, orderNumber: order.orderNumber })))
    .sort((a, b) => b.payment.createdAt.localeCompare(a.payment.createdAt));
  return (
    <div className="flex flex-col gap-4 pb-20">
      <SectionHead title={t('debt.title')} />

      {/* Как в макете SimplePicDebt: остаток крупно, полоса оплаченного, «было» и «оплачено». */}
      <section aria-label={t('debt.left')}
        className={cn('flex flex-col gap-1 rounded-[var(--radius-card)] border-[3px] border-solid bg-surface p-[1.1rem]',
          debt.debt > 0 ? 'border-sale' : 'border-shop')}>
        {debt.debt > 0 ? (
          <>
            <span className="text-base text-ink-muted">{t('debt.left')}</span>
            <span data-testid="debt-left" className="text-hero font-extrabold leading-tight tracking-[-0.02em] tabular-nums text-ink">{sum(debt.debt)}</span>
          </>
        ) : (
          // Всё оплачено — словами, а не «Осталось вернуть 0»: человеку сразу ясно, что долгов нет.
          <p data-testid="debt-left" className="m-0 text-title font-extrabold text-ok-ink">{t('debt.settled')}</p>
        )}
        <div aria-hidden="true" className="mt-2 h-3.5 overflow-hidden rounded-full bg-sale-soft">
          <div className="h-full bg-shop" style={{ width: `${debt.total > 0 ? Math.min(100, Math.round(((debt.total - debt.debt) / debt.total) * 100)) : 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between gap-3 text-caption font-semibold text-ink-muted">
          <span className="text-shop-ink">{t('debt.paidSum', { amount: sum(debt.paid) })}</span>
          <span>{t('debt.was', { amount: sum(debt.total) })}</span>
        </div>
        {debt.returned > 0 && <Total label={t('debt.returned')} value={sum(debt.returned)} />}
      </section>

      {nextPlan ? (
        <p className="m-0 flex items-center gap-3 rounded-[1.25rem] bg-sale-soft px-4 py-3.5 text-body font-bold text-sale-ink">
          <Wallet aria-hidden="true" className="size-7 shrink-0" />
          <span>{t('debt.next', { date: longDay(nextPlan.dueDate), amount: whole(sum(nextPlan.left)) })}</span>
        </p>
      ) : null}

      {debt.pending > 0 ? (
        <p className="m-0 flex items-center gap-3 rounded-[1.25rem] bg-hit-soft px-4 py-3 text-body font-semibold text-ink">
          <Clock aria-hidden="true" className="size-6 shrink-0 text-hit-ink" />
          <span>{t('debt.waiting', { amount: whole(sum(debt.pending)) })}</span>
        </p>
      ) : null}

      {debt.debt - debt.pending > 0 && !paying && (
        <Button type="button" variant="accent" className="h-16 w-full rounded-[1.375rem] text-lead font-extrabold lg:w-auto lg:self-start lg:px-10" onClick={() => setPaying(true)}>
          <Check aria-hidden="true" className="size-6" />
          {t('debt.iPaid')}
        </Button>
      )}

      {paying && <PayForm debt={debt} onDone={() => setPaying(false)} />}

      {/* График платежей — если продавец его задал: когда и сколько платить, что уже закрыто. */}
      {debt.plan.length > 0 && <PlanCard plan={debt.plan} />}

      {debt.orders.map((order) => (
        <Card key={order.orderId} className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-ink">
              {t('debt.order', { number: order.orderNumber })}
              {order.issuedAt && <span className="font-medium text-ink-muted"> · {t('debt.issued', { date: shortDate(order.issuedAt) })}</span>}
            </h2>
            {order.debt > 0
              ? <span className="text-sm font-bold tabular-nums text-ink">{t('debt.orderLeft', { amount: sum(order.debt) })}</span>
              : <span className="rounded-[var(--radius-pill)] bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-ink">{t('debt.closed')}</span>}
          </div>
          {order.overdueDays ? (
            <p className="m-0 text-sm font-semibold text-sale-ink">{t('debt.overdue', { count: order.overdueDays })}</p>
          ) : null}
          <ul className="m-0 flex list-none flex-col divide-y divide-hairline p-0">
            {order.lines.map((line) => (
              <li key={line.orderLineId} className="flex items-start gap-3 py-2">
                <LineThumb seed={line.orderLineId} src={line.photo ? sizedPhoto(line.photo, 88) : undefined} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-ink">{line.name}</span>
                  <span className={cn('shrink-0 font-bold tabular-nums', line.debt > 0 ? 'text-ink' : 'text-accent-ink')}>
                    {line.debt > 0 ? sum(line.debt) : t('debt.linePaid')}
                  </span>
                </div>
                <span className="text-sm text-ink-muted tabular-nums">
                  {t('debt.took', { qty: line.quantity, unit: line.unit ?? '', price: line.price === undefined ? '' : sum(line.price), amount: sum(line.amount) })}
                  {line.returnedQuantity > 0 && ` · ${t('debt.lineReturned', { qty: line.returnedQuantity })}`}
                  {line.paid > 0 && ` · ${t('debt.linePaidSum', { amount: sum(line.paid) })}`}
                </span>
                {line.description && <span className="line-clamp-2 text-sm text-ink-muted">{line.description}</span>}
                {line.pending > 0 && (
                  <span className="text-sm font-semibold text-ink-muted">{t('debt.linePending', { amount: sum(line.pending) })}</span>
                )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {/* Подтверждённые сообщения уже есть в истории выплат — здесь только то, что ждёт продавца или отклонено. */}
      {openClaims.length > 0 && (
        <section aria-label={t('debt.claimsTitle')} className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">{t('debt.claimsTitle')}</h2>
          {openClaims.map((claim) => (
            <Card key={claim.id} className="flex flex-col gap-1.5 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold tabular-nums text-ink">
                  {sum(claim.amount)}
                  <span className="font-medium text-ink-muted"> · {shortDate(claim.createdAt)}{claim.method && ` · ${t(`debt.method.${claim.method}`)}`}{claim.bank && `, ${bankName(debt.banks, claim.bank)}`}{claim.bank && claim.bankTarget && `, ${t(`debt.targetShort.${claim.bankTarget}`)}`}</span>
                </span>
                <span className={cn('rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-bold', STATUS_LOOK[claim.status])}>
                  {t(`debt.status.${claim.status}`)}
                </span>
              </div>
              {claim.status === 'PENDING' ? <PendingClaim claim={claim} debt={debt} /> : (
                <span className="text-sm text-ink-muted">
                  {claim.lines.map((line) => `${line.name} — ${sum(line.amount)}`).join(', ')}
                </span>
              )}
              {claim.comment && <span className="text-sm text-ink-muted">{claim.comment}</span>}
              {claim.status === 'REJECTED' && claim.rejectReason && (
                <span className="text-sm font-semibold text-sale-ink">{t('debt.rejected', { reason: claim.rejectReason })}</span>
              )}
            </Card>
          ))}
        </section>
      )}

      {payments.length > 0 && (
        <section aria-label={t('debt.history')} className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">{t('debt.history')}</h2>
          {payments.map(({ payment, orderNumber }) => (
            <Card key={payment.id} className="flex flex-col gap-2 p-4">
              <span className="font-bold tabular-nums text-ink">
                {sum(payment.amount)}
                <span className="font-medium text-ink-muted"> · {shortDate(payment.createdAt)}{payment.method && ` · ${t(`debt.method.${payment.method}`)}`}</span>
              </span>
              <span className="text-sm text-ink-muted">
                {t('debt.order', { number: orderNumber })}
                {payment.createdByName && ` · ${t('debt.acceptedBy', { name: payment.createdByName })}`}
                {payment.fromClient && ` · ${t('debt.youReported')}`}
              </span>
              <span className="text-sm text-ink-muted">{t('debt.paidFor')}{payment.linesByOrder && ` ${t('debt.byOrder')}`}</span>
              <ul aria-label={t('debt.paidFor')} className="m-0 flex list-none flex-col gap-2 p-0">
                {payment.lines.map((line) => (
                  <li key={line.orderLineId} className="flex items-center gap-3">
                    <LineThumb seed={line.orderLineId} src={line.photo ? sizedPhoto(line.photo, 88) : undefined} />
                    <span className="min-w-0 flex-1 font-semibold text-ink">
                      {line.name}
                      {line.quantity !== undefined && <span className="font-medium text-ink-muted"> · {line.quantity} {line.unit ?? ''}</span>}
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums text-ink">
                      <b>{whole(sum(line.amount))}</b>
                      {line.total !== undefined && <span className="block text-ink-muted">{t('debt.ofTotal', { amount: whole(sum(line.total)) })}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

/**
 * Сообщение, которое ждёт продавца: полностью ли оно закрывает долг, сколько останется после подтверждения
 * и по каждому товару — целиком или частично. Считается от текущего остатка.
 */
function PendingClaim({ claim, debt }: { claim: DebtClaimDto; debt: CustomerDebtDto }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const lines = new Map(debt.orders.flatMap((order) => order.lines).map((line) => [line.orderLineId, line]));
  const left = Math.max(0, debt.debt - claim.amount);
  return (
    <>
      <span className="self-start rounded-[var(--radius-pill)] bg-sunk px-2 py-0.5 text-xs font-bold text-ink">
        {left === 0 ? t('debt.claimFull') : t('debt.claimPartial', { amount: whole(money(left, currency)) })}
      </span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        {claim.lines.map((line) => {
          const own = lines.get(line.orderLineId);
          const rest = own ? Math.max(0, own.debt - line.amount) : null;
          return (
            <li key={line.orderLineId} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-ink">
                {line.name} <span className="whitespace-nowrap text-ink-muted">· №{line.orderNumber}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="font-semibold tabular-nums text-ink">{money(line.amount, currency)}</span>
                {rest !== null && (
                  <span className="block text-xs text-ink-muted">
                    {rest === 0 ? t('debt.lineFull') : t('debt.linePartial', { amount: whole(money(rest, currency)) })}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

type Line = { line: CustomerDebtLine; orderNumber: string };
type Chosen = { orderLineId: string; amount: number; max: number };

/** Общую сумму раскладываем по товарам по порядку: сначала закрывается первый, остаток — на следующий. */
export function spread(lines: Line[], total: number): Chosen[] {
  let rest = Math.round(total * 100);
  return lines.flatMap(({ line }) => {
    const max = Math.round(open(line) * 100);
    const take = Math.min(max, rest);
    rest -= take;
    return take > 0 ? [{ orderLineId: line.orderLineId, amount: take / 100, max: open(line) }] : [];
  });
}

/** Плитка-выбор в стиле Б: радиокнопка спрятана, выбранная — с зелёной рамкой. */
function Tile({ name, checked, onChange, children, className }: {
  name: string; checked: boolean; onChange: () => void; children: ReactNode; className?: string;
}) {
  return (
    <label className={cn(
      'flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-[1.25rem] border-[3px] border-solid px-3 py-2 text-center text-body font-extrabold leading-tight',
      'focus-within:ring-2 focus-within:ring-accent',
      checked ? 'border-shop bg-ok-soft text-ok-ink' : 'border-line bg-surface text-ink', className,
    )}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

const LEGEND = 'mb-2.5 p-0 text-lead font-extrabold text-ink';

/**
 * «Я оплатил» по макету Б: сколько (весь долг, часть суммой или за определённые товары), как
 * (наличными, картой, переводом) и банк карты или перевода. Сервер принимает оплату по товарам —
 * сумму «весь долг»/«часть» раскладываем по товарам сами (spread). Больше остатка не пускаем.
 */
function PayForm({ debt, onDone }: { debt: CustomerDebtDto; onDone: () => void }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const queryClient = useQueryClient();
  const id = useId();
  const lines: Line[] = debt.orders.flatMap((order) => order.lines.filter((line) => open(line) > 0)
    .map((line) => ({ line, orderNumber: order.orderNumber })));
  const left = lines.reduce((all, { line }) => all + open(line), 0);
  const [how, setHow] = useState<'all' | 'part' | 'items'>('all');
  const [part, setPart] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<DebtClaimRequestMethod | ''>('');
  const [bank, setBank] = useState('');
  const [bankTarget, setBankTarget] = useState<DebtClaimRequestBankTarget | ''>('');
  const [comment, setComment] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const send = useClaimPortalDebtPayment({
    mutation: {
      onMutate: () => setFailed(null),
      // Текст отказа сервер уже перевёл и назвал причину — показываем его.
      onError: (error) => {
        const detail = (error as { info?: { detail?: unknown } } | null)?.info?.detail;
        setFailed(typeof detail === 'string' && detail ? detail : t('debt.failed'));
      },
      onSuccess: (result) => {
        queryClient.setQueryData(getGetPortalDebtQueryKey(), result);
        onDone();
      },
    },
  });

  const partSum = Number(part.replace(/\s/g, '').replace(',', '.'));
  const chosen: Chosen[] = how === 'all' ? spread(lines, left)
    : how === 'part' ? (partSum > 0 && partSum <= left ? spread(lines, partSum) : [])
    : lines.flatMap(({ line }) => {
      const raw = amounts[line.orderLineId];
      if (raw === undefined) return [];
      return [{ orderLineId: line.orderLineId, amount: Number(raw.replace(',', '.')), max: open(line) }];
    });
  const valid = chosen.length > 0 && chosen.every((one) => one.amount > 0 && one.amount <= one.max);
  const total = chosen.reduce((all, one) => all + (Number.isFinite(one.amount) ? one.amount : 0), 0);
  const withBank = method === 'KASPI' || method === 'TRANSFER';

  return (
    <Card className="flex flex-col gap-4 p-4">
      <h2 className="m-0 text-title font-extrabold text-ink">{t('debt.iPaid')}</h2>
      {how === 'items' ? (
        <fieldset className="m-0 border-0 p-0">
          <legend className={LEGEND}>{t('debt.payTitle')}</legend>
          <p className="m-0 mb-2 text-sm text-ink-muted">{t('debt.payHint')}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {lines.map(({ line, orderNumber }) => {
              const on = amounts[line.orderLineId] !== undefined;
              return (
                <li key={line.orderLineId} className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-base text-ink">
                    <input type="checkbox" className="size-6" checked={on} onChange={() => setAmounts((all) => {
                      const next = { ...all };
                      if (on) delete next[line.orderLineId];
                      else next[line.orderLineId] = String(open(line));
                      return next;
                    })} />
                    <span className="min-w-0">
                      <span className="font-semibold">{line.name}</span>
                      <span className="text-ink-muted"> · <span className="whitespace-nowrap">№{orderNumber}</span> · {t('debt.upTo', { amount: whole(money(open(line), currency)) })}</span>
                    </span>
                  </label>
                  {on && (
                    <input type="number" inputMode="decimal" min={0} max={open(line)} step="0.01"
                      aria-label={t('debt.amountFor', { name: line.name })}
                      value={amounts[line.orderLineId]}
                      onChange={(event) => setAmounts((all) => ({ ...all, [line.orderLineId]: event.target.value }))}
                      className={cn(INPUT, 'w-32 tabular-nums')} />
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setHow('all')}
            className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-base font-bold text-shop-ink underline">
            {t('debt.byAmount')}
          </button>
        </fieldset>
      ) : (
        <fieldset className="m-0 border-0 p-0">
          <legend className={LEGEND}>{t('debt.howMuch')}</legend>
          <div className="grid grid-cols-2 gap-2">
            <Tile name={`${id}-sum`} checked={how === 'all'} onChange={() => setHow('all')}>
              {t('debt.wholeDebt')}
              <span className="text-lead">{whole(money(left, currency))}</span>
            </Tile>
            <Tile name={`${id}-sum`} checked={how === 'part'} onChange={() => setHow('part')}>{t('debt.part')}</Tile>
          </div>
          {how === 'part' && (
            <label className="mt-2 flex h-16 items-center gap-2 rounded-[1.125rem] border-[3px] border-solid border-shop bg-surface px-4">
              <span className="sr-only">{t('debt.partAmount')}</span>
              <input inputMode="decimal" value={part} onChange={(event) => setPart(event.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-title font-extrabold text-ink outline-none" />
            </label>
          )}
          {valid && (
            <p className="m-0 mt-1.5 text-sm text-ink-muted">
              {total >= debt.debt ? t('debt.payFull') : t('debt.leftAfter', { amount: whole(money(Math.max(0, debt.debt - total), currency)) })}
            </p>
          )}
          <button type="button" onClick={() => setHow('items')}
            className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-base font-bold text-shop-ink underline">
            {t('debt.byItems')}
          </button>
        </fieldset>
      )}
      {how === 'items' && valid && (
        <p className="m-0 text-sm font-semibold text-ink">
          {total >= debt.debt ? t('debt.payFull') : t('debt.payPartial', { amount: whole(money(Math.max(0, debt.debt - total), currency)) })}
        </p>
      )}

      <fieldset className="m-0 border-0 p-0">
        <legend className={LEGEND}>{t('debt.howPaid')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['CASH', 'KASPI', 'TRANSFER'] as const).map((one) => (
            <Tile key={one} name={`${id}-how`} checked={method === one} onChange={() => setMethod(one)} className="min-h-20">
              {one === 'CASH' ? <Wallet aria-hidden="true" className="size-7" /> : one === 'KASPI' ? <CreditCard aria-hidden="true" className="size-7" /> : <Bank aria-hidden="true" className="size-7" />}
              {t(`debt.methodTile.${one}`)}
            </Tile>
          ))}
        </div>
      </fieldset>

      {/* Банк карты или перевода — продавцу проще найти деньги у себя. */}
      {withBank && (
        <fieldset className="m-0 border-0 p-0">
          <legend className={LEGEND}>{t(method === 'KASPI' ? 'debt.cardBank' : 'debt.bankLabel')}</legend>
          <div role="radiogroup" aria-label={t('debt.bankGroup')} className={cn(CHIP_ROW, 'gap-2')}>
            {debt.banks.filter((one) => one.visible).map((one) => (
              <Tile key={one.code} name={`${id}-bank`} checked={bank === one.code} onChange={() => setBank(one.code)} className="min-w-27">
                {one.name}
              </Tile>
            ))}
          </div>
        </fieldset>
      )}
      {/* Куда в банке — по желанию и только у перевода (решение владельца 2026-10-30). */}
      {method === 'TRANSFER' && bank && (
        <fieldset className="m-0 border-0 p-0">
          <legend className={LEGEND}>{t('debt.targetLabel')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {BANK_TARGETS.map((one) => (
              <Tile key={one} name={`${id}-target`} checked={bankTarget === one} onChange={() => setBankTarget(one)}>
                {t(`debt.target.${one}`)}
              </Tile>
            ))}
          </div>
        </fieldset>
      )}

      <label htmlFor={`${id}-comment`} className="flex flex-col gap-1 text-base font-bold text-ink">
        {t('debt.comment')}
        <input id={`${id}-comment`} value={comment} maxLength={rules.DebtClaimRequest.comment.maxLength}
          onChange={(event) => setComment(event.target.value)} className={cn(INPUT, 'h-12 text-base')} />
      </label>
      {failed && <p role="alert" className="m-0 text-sm font-semibold text-sale-ink">{failed}</p>}
      <div className="flex flex-col gap-2">
        <Button type="button" variant="accent" size="lg" disabled={!valid || send.isPending}
          onClick={() => send.mutate({ data: {
            lines: chosen.map(({ orderLineId, amount }) => ({ orderLineId, amount })),
            method: method || undefined,
            bank: withBank && bank ? bank : undefined,
            bankTarget: method === 'TRANSFER' && bank && bankTarget ? bankTarget : undefined,
            comment: comment.trim() || undefined,
          } })}>
          <Send aria-hidden="true" className="size-6" />
          {send.isPending ? t('debt.sending') : t('debt.send', { amount: whole(money(total, currency)) })}
        </Button>
        <p className="m-0 text-center text-sm text-ink-muted">{t('debt.afterConfirm')}</p>
        <Button type="button" variant="outline" onClick={onDone}>{t('debt.cancel')}</Button>
      </div>
    </Card>
  );
}

/** График платежей от продавца: дата, сумма и что с платежом — оплачен, сколько осталось, просрочен. */
function PlanCard({ plan }: { plan: CustomerDebtDto['plan'] }) {
  const { t, i18n } = useTranslation();
  const currency = useSupplierCurrency();
  const today = new Date().toISOString().slice(0, 10);
  const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' });
  return (
    <Card className="flex flex-col gap-2 p-4">
      <h2 className="text-base font-bold text-ink">{t('debt.planTitle')}</h2>
      <ul aria-label={t('debt.planTitle')} className="m-0 flex list-none flex-col divide-y divide-hairline p-0">
        {plan.map((item) => {
          const closed = item.left <= 0;
          const late = !closed && item.dueDate < today;
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2">
              <span className={cn('font-semibold', closed ? 'text-ink-muted line-through' : 'text-ink')}>{day(item.dueDate)}</span>
              <span className="flex flex-col items-end">
                <span className="font-bold tabular-nums text-ink">{whole(money(item.amount, currency))}</span>
                <span className={cn('text-sm font-semibold', closed ? 'text-accent-ink' : late ? 'text-sale-ink' : 'text-ink-muted')}>
                  {closed ? t('debt.planPaid')
                    : late ? `${t('debt.planLate')} · ${whole(money(item.left, currency))}`
                      : item.left < item.amount ? `${t('debt.planLeft')} ${whole(money(item.left, currency))}` : t('debt.planWaiting')}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-sm text-ink-muted">{t('debt.planHint')}</p>
    </Card>
  );
}

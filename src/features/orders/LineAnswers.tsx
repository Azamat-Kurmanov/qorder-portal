import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyPortalOrderQueryKey,
  getGetMyPortalOrdersQueryKey,
  useAnswerMyPortalOrder,
  useConfirmMyPortalOrder,
  type LineDecisionDtoDecision,
  type PortalOrderDto,
  type SnapshotDiffDto,
} from '../../api/generated';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { dayMonth, decimal, money } from '../../shared/format';
import { RevisionDiff } from './RevisionDiff';
import { namedPriceOf } from './myOrdersModel';
import { Link } from 'react-router-dom';
import { LinkedLineThumb } from '../cart/LineThumb';

type Decision = LineDecisionDtoDecision;

/**
 * «Поставщик предлагает изменения» — по строкам, с ответом прямо в строке (W2-04, W2-05).
 *
 * Замена показана как замена: «X → вместо него Y» с причиной склада и словами
 * продавца. Клиент отвечает по каждой строке — «беру», «убрать», «подожду» — и одним
 * «Отправить ответ»; «Согласен со всем» — прежнее подтверждение. Отличия доставки
 * строки не имеют и остаются текстом над строками.
 */
export function LineAnswers({ order, onAsk, onDecline, onAnswered, busy }: {
  order: PortalOrderDto;
  /** Ответ ушёл — страница скажет «ответ отправлен». */
  onAnswered: () => void;
  /** «Спросить» — вопрос с цитатой строки уходит в переписку заявки. */
  onAsk: (quote: string) => void;
  /** «Отказаться от заявки…» — только через окно подтверждения. */
  onDecline: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const refresh = {
    onSuccess: () => {
      onAnswered();
      void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrderQueryKey(order.id) });
    },
  };
  const answer = useAnswerMyPortalOrder({ mutation: refresh });
  const confirm = useConfirmMyPortalOrder({ mutation: refresh });
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  // У строки бывает два отличия (цена и количество) — ответ на строку один.
  const lines = new Map<string, SnapshotDiffDto>();
  for (const change of order.diff) {
    if (change.lineId && !lines.has(change.lineId)) lines.set(change.lineId, change);
  }
  const other = order.diff.filter((change) => !change.lineId);
  const rows = [...lines.values()];
  const complete = rows.every((row) => decisions[row.lineId!] !== undefined);
  const pending = busy || answer.isPending || confirm.isPending;
  const failed = answer.isError || confirm.isError
    || (answer.data !== undefined && answer.data.status !== 200)
    || (confirm.data !== undefined && confirm.data.status !== 200);

  // Итог по выбранному: позиции «убрать» и «подожду» в этот заказ не входят.
  // Оценка по строкам предложения — доставку и скидку пересчитает продавец.
  const dropped = rows
    .filter((row) => decisions[row.lineId!] === 'REMOVE' || decisions[row.lineId!] === 'WAIT')
    .reduce((sum, row) => sum + (order.proposed?.find((line) => line.name === row.name)?.amount ?? 0), 0);
  const total = (order.proposedTotal ?? 0) - dropped;

  const send = () => {
    if (!complete || pending) return;
    answer.mutate({
      id: order.id,
      data: { lines: rows.map((row) => ({ lineId: row.lineId!, decision: decisions[row.lineId!] })) },
    });
  };

  return (
    <div role="region" aria-label={t('orders.changesTitle')} data-testid="line-answers"
      className="rounded-[var(--radius-card)] border border-accent/30 bg-accent-soft p-4">
      <p className="font-medium text-ink">{namedPriceOf(order) ? t('orders.priceNamedTitle') : t('orders.changesTitle')}</p>
      <RevisionDiff diff={other} currency={order.currency} />

      <ul className="mt-3 flex list-none flex-col gap-2 p-0">
        {rows.map((row) => {
          const chosen = decisions[row.lineId!];
          const choose = (decision: Decision) => setDecisions((now) => ({ ...now, [row.lineId!]: decision }));
          return (
            <li key={row.lineId} data-testid="line-answer" className="rounded-[var(--radius-control)] bg-surface p-3">
              {row.kind === 'LINE_REPLACED' ? (
                // Замена названа заменой: без этого «X — закончились» и «→ Y» читались как две несвязанные правки.
                <span data-testid="replacement-badge"
                  className="mb-1 inline-flex rounded-[var(--radius-pill)] bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent-ink">
                  {t('orders.lines.replacementBadge')}
                </span>
              ) : null}
              <p className="m-0 text-body font-semibold text-ink">
                {row.kind === 'LINE_REPLACED' ? t('orders.lines.youChose', { what: headline(row, t) }) : headline(row, t)}
              </p>
              {row.kind === 'LINE_REPLACED' ? (
                // Что предлагают вместо — с фото и ссылкой на полную карточку товара (описание, снимки):
                // решать «беру замену» по одному названию клиенту не по чему.
                <div className="mt-2 flex items-start gap-3">
                  <LinkedLineThumb itemId={row.itemId} seed={row.name} src={row.imageUrl} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="m-0 text-sm text-ink">{replacement(row, order, t)}</p>
                    {row.itemId ? (
                      <Link to={`/catalog/${row.itemId}`} data-testid="replacement-card"
                        className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent-ink underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        {t('orders.lines.viewItem')}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {row.note ? <p className="m-0 mt-1 text-sm italic text-ink-muted">«{row.note}»</p> : null}
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={row.name}>
                <Choice active={chosen === 'ACCEPT'} onClick={() => choose('ACCEPT')}>{acceptLabel(row, t)}</Choice>
                {row.kind === 'LINE_REMOVED' ? null : (
                  <Choice active={chosen === 'REMOVE'} onClick={() => choose('REMOVE')}>{t('orders.lines.remove')}</Choice>
                )}
                {row.expectedOn ? (
                  <Choice active={chosen === 'WAIT'} onClick={() => choose('WAIT')}>
                    {row.kind === 'QUANTITY_CHANGED' && row.was != null
                      ? t('orders.lines.waitAll', { count: decimal(row.was) })
                      : t('orders.lines.wait')}
                  </Choice>
                ) : null}
                <Choice active={false} onClick={() => onAsk(quote(row, order, t))}>{t('orders.lines.ask')}</Choice>
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length > 0 ? (
        <p data-testid="line-answers-total" className="m-0 mt-3 text-sm text-ink">
          {t('orders.lines.total', { total: money(total, order.currency) })}
        </p>
      ) : null}
      {failed ? <p role="alert" className="m-0 mt-2 text-sm text-gone">{t('orders.lines.failed')}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {rows.length > 0 ? (
          <Button size="lg" disabled={!complete || pending} onClick={send}>
            {answer.isPending ? t('orders.sending') : t('orders.lines.send')}
          </Button>
        ) : null}
        <Button size="lg" variant={rows.length > 0 ? 'outline' : 'primary'} disabled={pending}
          onClick={() => confirm.mutate({ id: order.id })}>
          {confirm.isPending ? t('orders.sending') : t('orders.lines.agreeAll')}
        </Button>
      </div>
      <button type="button" disabled={pending} onClick={onDecline}
        className="mt-3 min-h-11 cursor-pointer text-sm font-semibold text-ink-muted underline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default">
        {t('orders.lines.declineAll')}
      </button>
    </div>
  );
}

/** Кнопка решения: выбранная залита, остальные контуром; высота не ниже 44 px. */
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="md" variant={active ? 'primary' : 'outline'} aria-pressed={active}
      className={cn('min-h-11')} onClick={onClick}>
      {children}
    </Button>
  );
}

/** Что со строкой, словами клиента: позиция и что сказал склад. */
function headline(row: SnapshotDiffDto, t: TFunction): string {
  const name = row.kind === 'LINE_REPLACED' ? row.replacedName ?? row.name : row.name;
  const why = stockReason(row, t);
  if (row.kind === 'QUANTITY_CHANGED' && row.was != null && row.now != null) {
    return t('orders.lines.partial', { name, now: decimal(row.now), was: decimal(row.was) })
      + (why ? `, ${why}` : '');
  }
  if (row.kind === 'PRICE_CHANGED') {
    return t('orders.lines.price', { name, was: decimal(row.was ?? 0), now: decimal(row.now ?? 0) });
  }
  if (row.kind === 'LINE_ADDED') return t('orders.lines.added', { name });
  if (row.kind === 'LINE_REMOVED' && !why) return t('orders.lines.removed', { name });
  return why ? `${name} — ${why}` : name;
}

/** «→ вместо: чинос City, 31 990 (+7 000)» — суммы в валюте заявки. */
function replacement(row: SnapshotDiffDto, order: PortalOrderDto, t: TFunction): string {
  const price = row.now == null ? '' : `, ${money(row.now, order.currency)}`;
  const delta = row.now != null && row.was != null && row.now !== row.was
    ? ` (${row.now > row.was ? '+' : '−'}${money(Math.abs(row.now - row.was), order.currency)})`
    : '';
  return t('orders.lines.instead', { name: row.name }) + price + delta;
}

/** Причина склада: «больше не будет», «будет завтра», «будет к 10 ноября». */
function stockReason(row: SnapshotDiffDto, t: TFunction): string | null {
  if (row.restock === 'NEVER') return t('orders.lines.never');
  if (row.expectedOn) return t('orders.lines.until', { date: dayMonth(row.expectedOn) });
  if (row.restock === 'TOMORROW') return t('orders.lines.tomorrow');
  return null;
}

function acceptLabel(row: SnapshotDiffDto, t: TFunction): string {
  if (row.kind === 'LINE_REPLACED') return t('orders.lines.takeReplacement');
  if (row.kind === 'QUANTITY_CHANGED' && row.now != null) return t('orders.lines.take', { count: decimal(row.now) });
  if (row.kind === 'LINE_REMOVED') return t('orders.lines.ok');
  return t('orders.lines.accept');
}

/** Цитата строки для вопроса — то, что клиент видел. */
function quote(row: SnapshotDiffDto, order: PortalOrderDto, t: TFunction): string {
  return row.kind === 'LINE_REPLACED' ? `${headline(row, t)} ${replacement(row, order, t)}` : headline(row, t);
}

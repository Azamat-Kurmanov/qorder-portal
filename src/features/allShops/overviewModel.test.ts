import { describe, expect, it } from 'vitest';
import type { PortalNotificationDto, PortalOverviewDto } from '../../api/generated';
import { buildOverview } from './overviewModel';

const note = (id: string, kind: string, createdAt = '2026-11-07T08:00:00Z'): PortalNotificationDto =>
  ({ id, draftId: `d-${id}`, kind, createdAt } as PortalNotificationDto);

const row = (supplierId: string, notifications: PortalNotificationDto[], debt?: PortalOverviewDto['debt']): PortalOverviewDto =>
  ({ supplierId, notifications, debt });

describe('«Все магазины»: дела и сообщения', () => {
  it('счёт, решение и ответ продавца — дела; принятая заявка и акция — сообщения', () => {
    const overview = buildOverview([
      row('a', [note('1', 'INVOICE_SENT'), note('2', 'ACCEPTED'), note('3', 'QUESTION_ANSWERED')]),
      row('b', [note('4', 'RENEGOTIATION'), note('5', 'PROMO_STARTED')]),
    ], '2026-11-07');

    expect(overview.groups.map((g) => g.key)).toEqual(['invoices', 'decisions', 'answers']);
    expect(overview.open).toHaveLength(3);
    expect(overview.messages.map((m) => [m.supplierId, m.items.map((n) => n.id)])).toEqual([['a', ['2']], ['b', ['5']]]);
  });

  it('платежи на сегодня и завтра — одна группа; позже — не дело; просроченное — первым', () => {
    const overview = buildOverview([
      row('a', [note('r', 'DEBT_PAYMENT_DUE')], { debt: 90000, overdue: 0, nextDue: '2026-11-08', nextDueLeft: 30000, pending: 0 }),
      row('b', [], { debt: 48200, overdue: 0, nextDue: '2026-11-07', nextDueLeft: 48200, pending: 48200 }),
      row('c', [], { debt: 640000, overdue: 0, nextDue: '2026-11-30', nextDueLeft: 100000, pending: 0 }),
      row('d', [], { debt: 12000, overdue: 12000, pending: 0 }),
    ], '2026-11-07');

    expect(overview.groups.map((g) => g.key)).toEqual(['overdue', 'dueSoon']);
    const due = overview.groups[1].tasks;
    // Сообщённая оплата — внизу и в счёт дел не входит.
    expect(due.map((t) => [t.supplierId, t.sent])).toEqual([['a', false], ['b', true]]);
    expect(due[0].read).toEqual(['r']);
    expect(overview.open.map((t) => t.supplierId)).toEqual(['d', 'a']);
    // Напоминание о сроке не становится сообщением: оно уже в строке платежа.
    expect(overview.messages).toEqual([]);
    expect(overview.debts.map((d) => d.supplierId)).toEqual(['d', 'b', 'a', 'c']);
  });
});

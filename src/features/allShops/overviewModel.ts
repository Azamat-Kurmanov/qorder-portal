import type { PortalNotificationDto, PortalOverviewDto } from '../../api/generated';
import { destinationOf } from '../notifications/NotificationsBell';

/**
 * «Все магазины» — модель «дела и сообщения» (решение владельца 2026-11-07, ряд 17 канвы).
 *
 * Дело ждёт действия клиента и не исчезает, пока его не сделали; сообщение — к сведению.
 * Однотипные дела сливаются в группу: «Завтра 3 платежа» — одна строка, а не три.
 */
export type GroupKey = 'overdue' | 'dueSoon' | 'invoices' | 'decisions' | 'answers';

export const GROUP_ORDER: GroupKey[] = ['overdue', 'dueSoon', 'invoices', 'decisions', 'answers'];

const TASK_KINDS: Record<string, GroupKey> = {
  INVOICE_SENT: 'invoices',
  RENEGOTIATION: 'decisions',
  PRICE_NAMED: 'decisions',
  DEADLINE_SOON: 'decisions',
  TRANSPORT_RECEIPT_SENT: 'decisions',
  TRANSPORT_PAYMENT_REJECTED: 'decisions',
  DEBT_PAYMENT_REJECTED: 'decisions',
  TEMPLATE_READY: 'decisions',
  // Ответ продавца — тоже дело (решение владельца 2026-11-07): закрывается, когда клиент его прочитал.
  QUESTION_ANSWERED: 'answers',
  ORDER_ANSWERED: 'answers',
};

/** Напоминание о сроке долга — уже строка «платёж» из графика: отдельной строкой не дублируется. */
const DEBT_REMINDER = 'DEBT_PAYMENT_DUE';

export type Task = {
  key: string;
  group: GroupKey;
  supplierId: string;
  /** Куда ведёт дело внутри магазина. */
  to: string;
  /** Плашки, которые гасятся вместе с делом. */
  read: string[];
  notification?: PortalNotificationDto;
  amount?: number;
  due?: string;
  /** Клиент уже сообщил об оплате — ждёт подтверждения продавца; в счёт дел не входит. */
  sent?: boolean;
};

export type Message = { supplierId: string; items: PortalNotificationDto[] };

export type Overview = {
  groups: { key: GroupKey; tasks: Task[] }[];
  /** Дела, которые ждут клиента (без уже оплаченных и ждущих подтверждения). */
  open: Task[];
  messages: Message[];
  debts: { supplierId: string; debt: number; overdue: number; nextDue?: string; nextDueLeft?: number; pending: number }[];
};

/** Дата `day` наступит не позже завтрашнего дня относительно `today` (обе — YYYY-MM-DD). */
function soon(day: string, today: string): boolean {
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return day <= tomorrow.toISOString().slice(0, 10);
}

export function buildOverview(rows: PortalOverviewDto[], today: string): Overview {
  const byGroup = new Map<GroupKey, Task[]>(GROUP_ORDER.map((key) => [key, []]));
  const messages: Message[] = [];
  const debts: Overview['debts'] = [];

  for (const row of rows) {
    const reminders = row.notifications.filter((n) => n.kind === DEBT_REMINDER).map((n) => n.id);
    const debt = row.debt;
    if (debt && debt.debt > 0) {
      debts.push({ supplierId: row.supplierId, ...debt });
      if (debt.overdue > 0) {
        byGroup.get('overdue')!.push({ key: `overdue:${row.supplierId}`, group: 'overdue', supplierId: row.supplierId,
          to: '/debt', read: reminders, amount: debt.overdue, sent: debt.pending >= debt.overdue });
      } else if (debt.nextDue && debt.nextDueLeft && soon(debt.nextDue, today)) {
        byGroup.get('dueSoon')!.push({ key: `due:${row.supplierId}`, group: 'dueSoon', supplierId: row.supplierId,
          to: '/debt', read: reminders, amount: debt.nextDueLeft, due: debt.nextDue, sent: debt.pending >= debt.nextDueLeft });
      }
    }
    const info: PortalNotificationDto[] = [];
    for (const n of row.notifications) {
      const group = TASK_KINDS[n.kind];
      if (group) {
        byGroup.get(group)!.push({ key: n.id, group, supplierId: row.supplierId,
          to: destinationOf(n.kind, n.draftId), read: [n.id], notification: n });
      } else if (n.kind !== DEBT_REMINDER) {
        info.push(n);
      }
    }
    if (info.length > 0) messages.push({ supplierId: row.supplierId, items: info });
  }

  const groups = GROUP_ORDER
    .map((key) => ({ key, tasks: byGroup.get(key)!.sort(order) }))
    .filter((group) => group.tasks.length > 0);
  // Сначала больше нового, затем свежее.
  messages.sort((a, b) => b.items.length - a.items.length || latest(b).localeCompare(latest(a)));
  debts.sort((a, b) => b.overdue - a.overdue || (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999') || b.debt - a.debt);
  return { groups, open: groups.flatMap((group) => group.tasks).filter((task) => !task.sent), messages, debts };
}

/** Ждущие подтверждения — вниз; дальше — по сроку, затем крупные суммы, затем свежие плашки. */
function order(a: Task, b: Task): number {
  return Number(a.sent ?? false) - Number(b.sent ?? false)
    || (a.due ?? '').localeCompare(b.due ?? '')
    || (b.amount ?? 0) - (a.amount ?? 0)
    || (b.notification?.createdAt ?? '').localeCompare(a.notification?.createdAt ?? '');
}

function latest(message: Message): string {
  return message.items.reduce((max, n) => (n.createdAt > max ? n.createdAt : max), '');
}

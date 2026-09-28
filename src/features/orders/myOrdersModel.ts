import type { PortalNotificationDto, PortalOrderDto } from '../../api/generated';

/**
 * Что с заявкой — шестью видами, как в макете «Мои заявки v2».
 *
 * Вид выводится из состояния сервера и его же признака `needsAnswer`:
 * решение «ход за клиентом» принадлежит серверу, и второе такое правило
 * здесь однажды разошлось бы с первым.
 */
export type OrderKind = 'answer' | 'ready' | 'review' | 'accepted' | 'done' | 'cancelled';

export function kindOf(order: PortalOrderDto): OrderKind {
  if (order.needsAnswer) return 'answer';
  switch (order.state) {
    case 'READY': return 'ready';
    case 'ACCEPTED': return 'accepted';
    case 'ISSUED': return 'done';
    case 'CLOSED': return 'cancelled';
    default: return 'review';
  }
}

/** Фильтры-чипы над списком. «У продавца» — всё, где ход не за клиентом и заявка ещё идёт. */
export const FILTERS = ['all', 'answer', 'ready', 'seller', 'done', 'cancelled'] as const;
export type OrderFilter = (typeof FILTERS)[number];

export function matchesFilter(order: PortalOrderDto, filter: OrderFilter): boolean {
  const kind = kindOf(order);
  if (filter === 'all') return true;
  if (filter === 'seller') return kind === 'review' || kind === 'accepted';
  return kind === filter;
}

export const SORTS = ['recent', 'newest', 'oldest', 'sumDesc', 'sumAsc'] as const;
export type OrderSort = (typeof SORTS)[number];

/** Сколько заявок на странице: по умолчанию первое — десять, как в макете. */
export const ORDER_SIZES = [10, 20, 50];

/** Непрочитанные уведомления по заявкам: сколько и когда последнее. */
export interface Unread {
  count: number;
  latest: string;
  ids: string[];
}

export function unreadByOrder(notifications: PortalNotificationDto[]): Map<string, Unread> {
  const map = new Map<string, Unread>();
  for (const notification of notifications) {
    if (!notification.draftId) continue;
    const entry = map.get(notification.draftId) ?? { count: 0, latest: notification.createdAt, ids: [] };
    entry.count += 1;
    entry.ids.push(notification.id);
    if (notification.createdAt > entry.latest) entry.latest = notification.createdAt;
    map.set(notification.draftId, entry);
  }
  return map;
}

/**
 * Последнее сообщение по заявке — строка под заголовком карточки.
 *
 * Два источника: переписка (вопрос клиента или ответ продавца) и само
 * событие заявки — «собрана», «принята», «изменена». Берётся более позднее;
 * у события нет текста, его строку экран берёт по виду заявки.
 */
export interface LastMessage {
  at: string;
  /** Текст из переписки; пусто — строка по виду заявки. */
  text?: string;
  fromCustomer?: boolean;
}

export function lastMessage(order: PortalOrderDto, unread?: Unread): LastMessage {
  const eventAt = [order.issuedAt, order.readyAt, unread?.latest, order.createdAt]
    .filter((value): value is string => Boolean(value))
    .reduce((latest, value) => (value > latest ? value : latest));
  const thread = order.messages ?? [];
  const last = thread.length > 0 ? thread[thread.length - 1] : undefined;
  if (last && last.createdAt >= eventAt) {
    return { at: last.createdAt, text: last.text, fromCustomer: last.author === 'CUSTOMER' };
  }
  return { at: eventAt };
}

/** Количество штук в заявке: сумма количеств по строкам. */
export function pieces(order: PortalOrderDto): number {
  return linesOf(order).reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Что показывать составом: у заявки, ждущей ответа, — то, что предлагает
 * продавец, ведь согласие относится к нему; у остальных — отправленное.
 */
export function linesOf(order: PortalOrderDto) {
  return order.needsAnswer && order.proposed ? order.proposed : order.submitted;
}

export function totalOf(order: PortalOrderDto): number {
  return order.needsAnswer && order.proposedTotal !== undefined ? order.proposedTotal : order.total;
}

/** Номер или название любой позиции — без учёта регистра. */
export function matchesSearch(order: PortalOrderDto, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return order.orderNumber.toLocaleLowerCase().includes(needle)
    || [...order.submitted, ...(order.proposed ?? [])]
      .some((line) => line.name.toLocaleLowerCase().includes(needle));
}

/**
 * Порядок списка.
 *
 * «По последнему сообщению» поднимает заявки с новым наверх, а внутри —
 * по времени последнего сообщения: за этим клиент сюда и пришёл.
 */
export function sorted(
  orders: PortalOrderDto[],
  sort: OrderSort,
  unread: Map<string, Unread>,
): PortalOrderDto[] {
  const copy = [...orders];
  switch (sort) {
    case 'recent':
      return copy.sort((a, b) => {
        const fresh = Number(unread.has(b.id)) - Number(unread.has(a.id));
        if (fresh !== 0) return fresh;
        return lastMessage(b, unread.get(b.id)).at.localeCompare(lastMessage(a, unread.get(a.id)).at);
      });
    case 'newest':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'oldest':
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'sumDesc':
      return copy.sort((a, b) => totalOf(b) - totalOf(a));
    case 'sumAsc':
      return copy.sort((a, b) => totalOf(a) - totalOf(b));
  }
}

/**
 * Заявки, которые открыты сразу: где ход за клиентом и есть новое — как
 * в макете. Прочитанную заявку клиент уже видел, и раскрытой она только
 * отодвигала бы остальные вниз.
 */
export function openByDefault(order: PortalOrderDto, unread?: Unread): boolean {
  const kind = kindOf(order);
  return (kind === 'answer' || kind === 'ready') && unread !== undefined;
}

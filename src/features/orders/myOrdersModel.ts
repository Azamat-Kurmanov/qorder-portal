import type { TFunction } from 'i18next';
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

/**
 * Продавец ничего не менял, а только назвал сумму, которой не было (договорная доставка,
 * грузчики): о чём он спрашивает — «стоимость доставки», «грузчиков» или обеих.
 * Пусто — в ответе продавца есть настоящие правки, или ответа не ждут.
 */
export function namedPriceOf(order: PortalOrderDto): 'delivery' | 'loaders' | 'both' | null {
  const diff = order.diff ?? [];
  if (!order.needsAnswer || diff.length === 0 || diff.some((change) => change.kind !== 'PRICE_NAMED')) return null;
  const loaders = diff.some((change) => change.name === 'Грузчики');
  const delivery = diff.some((change) => change.name !== 'Грузчики');
  return loaders && delivery ? 'both' : loaders ? 'loaders' : 'delivery';
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
    // Ответы на вопросы и отзывы — в своих разделах, не у заявок.
    if (!notification.draftId || notification.kind === 'QUESTION_ANSWERED' || notification.kind === 'REVIEW_ANSWERED') continue;
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
 * Порядок списка: заявки с новым — наверх, внутри — по времени последнего сообщения:
 * за этим клиент сюда и пришёл.
 */
export function sorted(orders: PortalOrderDto[], unread: Map<string, Unread>): PortalOrderDto[] {
  return [...orders].sort((a, b) => {
    const fresh = Number(unread.has(b.id)) - Number(unread.has(a.id));
    if (fresh !== 0) return fresh;
    return lastMessage(b, unread.get(b.id)).at.localeCompare(lastMessage(a, unread.get(a.id)).at);
  });
}

/** «Продавец изменил заявку» — или, если он только назвал сумму, «назвал стоимость доставки». */
export function answerText(order: PortalOrderDto, t: TFunction): string {
  const named = namedPriceOf(order);
  return named ? t(`orders.v2.priceNamed.${named}`) : t('orders.v2.whereText.answer');
}

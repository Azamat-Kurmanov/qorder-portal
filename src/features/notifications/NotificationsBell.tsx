import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { Bell, Check, FileText, MessageCircle, PenLine, ShoppingCart, Sparkles, Tag, Truck, type IconComponent } from '../../ui/icons';
import { useQueryClient } from '@tanstack/react-query';
import { PUSH_RECEIVED_EVENT } from '../../shared/webview/bridge';
import {
  getGetPortalNotificationsQueryKey,
  getGetPortalUnreadSummaryQueryKey,
  useGetPortalNotifications,
  useReadPortalNotification,
  type PortalNotificationDto,
} from '../../api/generated';
import { Sheet } from '../../ui/Sheet';
import { cn } from '../../ui/cn';
import { shortDate } from '../../shared/format';

/**
 * Поводы, о которых кабинет сообщает клиенту.
 *
 * Кодом уведомление не показывается никогда: «RENEGOTIATION» ничего не говорит
 * тому, кто заказывает цемент. Неизвестный повод описывается общими словами,
 * а не прячется: сервер умеет присылать больше поводов, чем знает эта
 * страница, и промолчать о заявке хуже, чем сказать о ней неточно.
 *
 * Список известных поводов стоит в коде, а не выводится из словаря: словарь
 * отвечает за слова, а за то, какие поводы экран умеет назвать, — экран.
 */
const KNOWN_REASONS = [
  'RENEGOTIATION',
  'DEADLINE_SOON',
  'ACCEPTED',
  'QUESTION_ANSWERED',
  'ORDER_ANSWERED',
  'TRANSPORT_RECEIPT_SENT',
  'TRANSPORT_PAYMENT_REJECTED',
  'INVOICE_SENT',
  'NEW_ARRIVALS',
  'PROMO_STARTED',
  'ORDER_ON_ROUTE',
  'ORDER_DELIVERED',
  'TEMPLATE_READY',
  'BACK_IN_STOCK',
  'REORDER_DUE',
];

function reasonOf(kind: string, t: TFunction, detail?: string): string {
  // Причина отклонения — слова продавца: подставляются как есть, без перевода.
  if (kind === 'TRANSPORT_PAYMENT_REJECTED' && detail) return t('notifications.reasons.transportRejectedWith', { reason: detail });
  // Число товаров объявления: «Новые поступления: 30 товаров».
  // Ждавшаяся позиция — названа: «Снова в наличии: Цемент М400».
  if (kind === 'BACK_IN_STOCK' && detail) return t('notifications.reasons.BACK_IN_STOCK_named', { name: detail });
  // Обычный интервал клиента в днях — чтобы напоминание объясняло, почему пришло.
  if (kind === 'REORDER_DUE' && detail) return t('notifications.reasons.REORDER_DUE_every', { days: detail });
  if ((kind === 'NEW_ARRIVALS' || kind === 'PROMO_STARTED') && detail) {
    return t(`notifications.reasons.${kind}_count`, { count: Number(detail) });
  }
  return KNOWN_REASONS.includes(kind)
    ? t(`notifications.reasons.${kind}`)
    : t('notifications.reasons.fallback');
}

/**
 * Куда ведёт плашка.
 *
 * Ответ на вопрос лежит в разделе вопросов, объявления — в своих разделах,
 * всё остальное — в самой заявке.
 * Плашка, отправившая человека не туда, хуже отсутствующей: он ищет
 * и не находит, а новость считает потерянной.
 */
/** Повод, которому для перехода предмет не нужен: раздел один на магазин. */
export function opensWithoutSubject(kind: string): boolean {
  return kind === 'QUESTION_ANSWERED' || kind === 'NEW_ARRIVALS' || kind === 'PROMO_STARTED' || kind === 'TEMPLATE_READY';
}

export function destinationOf(kind: string, draftId: string): string {
  if (kind === 'NEW_ARRIVALS') return '/new-arrivals';
  if (kind === 'PROMO_STARTED') return '/promotions';
  // Шаблон по расписанию уже разложен в корзину — клиенту остаётся проверить и отправить.
  if (kind === 'TEMPLATE_READY') return '/checkout';
  // Предмет — позиция: в её карточку, где её и заказывают.
  if (kind === 'BACK_IN_STOCK') return `/catalog/${draftId}`;
  // Ответ продавца — в свою ветку (draftId — id ветки); без него — к списку вопросов.
  if (kind === 'QUESTION_ANSWERED') return draftId ? `/questions/${draftId}` : '/questions';
  return `/orders/${draftId}`;
}

/**
 * Колокольчик в шапке кабинета.
 *
 * Со счётчиком: значок без числа не отличает «ничего нового» от «два
 * пересогласования», и человек открывает его каждый раз впустую.
 *
 * Прочитанным уведомление становится по переходу к заявке, а не по открытию
 * листа: открыл, отвлёкся, закрыл — и повод исчез, не будучи прочитанным.
 *
 * `active` выключает запрос, пока неизвестно, есть ли у клиента поставщик:
 * уведомления принадлежат поставщику, и в кабинете, который ещё не открыли,
 * запрос за ними возвращает отказ.
 */
export function NotificationsBell({
  active = true,
  dot = false,
  className,
}: {
  active?: boolean;
  /**
   * Точка вместо числа — в шапке шаблона продавца, как в макете: число там
   * спорило бы со счётчиком корзины рядом. Само число не теряется — оно
   * в имени кнопки («Уведомления: 3 новых»).
   */
  dot?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const notifications = useGetPortalNotifications({ query: { enabled: active } });
  const queryClient = useQueryClient();

  // В приложении push сообщает о новом сразу — колокольчик и сводка перечитываются.
  useEffect(() => {
    const onPush = () => {
      void queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetPortalUnreadSummaryQueryKey() });
    };
    window.addEventListener(PUSH_RECEIVED_EVENT, onPush);
    return () => window.removeEventListener(PUSH_RECEIVED_EVENT, onPush);
  }, [queryClient]);
  const list = notifications.data?.status === 200 ? notifications.data.data : [];

  const label = list.length > 0
    ? t('notifications.withCount', { count: list.length })
    : t('notifications.title');

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpened(true)}
        className={cn(
          'relative inline-flex size-11 items-center justify-center rounded-[var(--radius-control)]',
          'text-ink-muted transition-all duration-300 hover:bg-ink/5 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          className,
        )}
      >
        <Bell className="size-5" aria-hidden="true" />
        {list.length > 0 && dot && (
          <span
            data-testid="notifications-dot"
            aria-hidden="true"
            className="absolute right-2 top-2 size-2 rounded-full bg-accent ring-2 ring-surface"
          />
        )}
        {list.length > 0 && !dot && (
          <span
            data-testid="notifications-count"
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-accent px-1 text-2xs font-semibold leading-4 text-on-accent"
          >
            {list.length}
          </span>
        )}
      </button>

      <Sheet open={opened} onOpenChange={setOpened} title={t('notifications.title')}>
        {list.length === 0 ? (
          <p className="text-sm text-ink-subtle">{t('notifications.empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {list.map((notification) => (
              <li key={notification.id}>
                <NotificationRow
                  notification={notification}
                  onFollowed={() => setOpened(false)}
                />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}

/** Значок повода: уведомления узнают по нему с одного взгляда (макеты «Кабинет клиента 2.0»). */
const LOOKS: Record<string, { icon: IconComponent; tone: string }> = {
  RENEGOTIATION: { icon: PenLine, tone: 'bg-sale-soft text-sale-ink' },
  DEADLINE_SOON: { icon: PenLine, tone: 'bg-sale-soft text-sale-ink' },
  ACCEPTED: { icon: Check, tone: 'bg-ok-soft text-ok-ink' },
  QUESTION_ANSWERED: { icon: MessageCircle, tone: 'bg-sage-soft text-accent-ink' },
  ORDER_ANSWERED: { icon: MessageCircle, tone: 'bg-sage-soft text-accent-ink' },
  TRANSPORT_RECEIPT_SENT: { icon: FileText, tone: 'bg-accent-soft text-accent-ink' },
  TRANSPORT_PAYMENT_REJECTED: { icon: FileText, tone: 'bg-sale-soft text-sale-ink' },
  INVOICE_SENT: { icon: FileText, tone: 'bg-accent-soft text-accent-ink' },
  NEW_ARRIVALS: { icon: Sparkles, tone: 'bg-sage-soft text-accent-ink' },
  PROMO_STARTED: { icon: Tag, tone: 'bg-sale-soft text-sale-ink' },
  ORDER_ON_ROUTE: { icon: Truck, tone: 'bg-accent-soft text-accent-ink' },
  ORDER_DELIVERED: { icon: Check, tone: 'bg-ok-soft text-ok-ink' },
  TEMPLATE_READY: { icon: ShoppingCart, tone: 'bg-sage-soft text-accent-ink' },
  BACK_IN_STOCK: { icon: Bell, tone: 'bg-ok-soft text-ok-ink' },
  REORDER_DUE: { icon: ShoppingCart, tone: 'bg-accent-soft text-accent-ink' },
};

function NotificationRow({
  notification,
  onFollowed,
}: {
  notification: PortalNotificationDto;
  onFollowed: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const read = useReadPortalNotification({
    mutation: {
      onSuccess: () => {
        // Список уведомлений и сводка непрочитанного обязаны говорить одно
        // и то же: сводку читают счётчики у поставщиков (в шапке и в списке
        // «Поставщики»), и без её инвалидации колокольчик гаснет, а те
        // счётчики остаются прежними — то самое расхождение, которого ради
        // них и не должно быть.
        void queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetPortalUnreadSummaryQueryKey() });
      },
    },
  });

  const look = LOOKS[notification.kind] ?? { icon: Bell, tone: 'bg-sunk text-ink-muted' };
  const Icon = look.icon;
  return (
    <Link
      to={destinationOf(notification.kind, notification.draftId)}
      onClick={() => {
        read.mutate({ id: notification.id });
        onFollowed();
      }}
      className={cn(
        'flex min-h-14 items-start gap-3 rounded-[var(--radius-control)] px-2 py-2.5',
        'transition-colors duration-200 hover:bg-canvas active:scale-[.98]',
      )}
    >
      <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', look.tone)}>
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold text-ink">{reasonOf(notification.kind, t, notification.detail)}</span>
        <span className="text-caption text-ink-subtle">{shortDate(notification.createdAt)}</span>
      </span>
      <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-sale" />
    </Link>
  );
}

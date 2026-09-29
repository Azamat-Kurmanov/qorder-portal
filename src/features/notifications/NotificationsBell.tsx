import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
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
];

function reasonOf(kind: string, t: TFunction, detail?: string): string {
  // Причина отклонения — слова продавца: подставляются как есть, без перевода.
  if (kind === 'TRANSPORT_PAYMENT_REJECTED' && detail) return t('notifications.reasons.transportRejectedWith', { reason: detail });
  return KNOWN_REASONS.includes(kind)
    ? t(`notifications.reasons.${kind}`)
    : t('notifications.reasons.fallback');
}

/**
 * Куда ведёт плашка.
 *
 * Ответ на вопрос лежит в разделе вопросов, всё остальное — в самой заявке.
 * Плашка, отправившая человека не туда, хуже отсутствующей: он ищет
 * и не находит, а новость считает потерянной.
 */
function destinationOf(kind: string, draftId: string): string {
  return kind === 'QUESTION_ANSWERED' ? '/questions' : `/orders/${draftId}`;
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
          <ul className="flex flex-col gap-1">
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

  return (
    <Link
      to={destinationOf(notification.kind, notification.draftId)}
      onClick={() => {
        read.mutate({ id: notification.id });
        onFollowed();
      }}
      className={cn(
        'flex min-h-11 flex-col justify-center gap-0.5 rounded-[var(--radius-control)] px-3 py-2',
        'transition-all duration-300 hover:bg-canvas active:scale-95',
      )}
    >
      <span className="text-body text-ink">{reasonOf(notification.kind, t, notification.detail)}</span>
      <span className="text-caption text-ink-faint">{shortDate(notification.createdAt)}</span>
    </Link>
  );
}

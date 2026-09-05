import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalNotificationsQueryKey,
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
 */
const REASONS: Record<string, string> = {
  RENEGOTIATION: 'Продавец изменил заявку — посмотрите, что поменялось',
  DEADLINE_SOON: 'Заявка ждёт вашего ответа, срок подходит',
  ACCEPTED: 'Заявка принята продавцом',
  QUESTION_ANSWERED: 'Продавец ответил на вопрос',
};

function reasonOf(kind: string): string {
  return REASONS[kind] ?? 'По заявке есть новости';
}

/**
 * Колокольчик в шапке кабинета.
 *
 * Со счётчиком: значок без числа не отличает «ничего нового» от «два
 * пересогласования», и человек открывает его каждый раз впустую.
 *
 * Прочитанным уведомление становится по переходу к заявке, а не по открытию
 * листа: открыл, отвлёкся, закрыл — и повод исчез, не будучи прочитанным.
 */
export function NotificationsBell() {
  const [opened, setOpened] = useState(false);
  const notifications = useGetPortalNotifications();
  const list = notifications.data?.status === 200 ? notifications.data.data : [];

  const label = list.length > 0 ? `Уведомления: ${list.length}` : 'Уведомления';

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
        )}
      >
        <Bell className="size-5" aria-hidden="true" />
        {list.length > 0 && (
          <span
            data-testid="notifications-count"
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-accent px-1 text-[11px] font-semibold leading-4 text-white"
          >
            {list.length}
          </span>
        )}
      </button>

      <Sheet open={opened} onOpenChange={setOpened} title="Уведомления">
        {list.length === 0 ? (
          <p className="text-sm text-ink-subtle">Новостей нет.</p>
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
  const queryClient = useQueryClient();
  const read = useReadPortalNotification({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() });
      },
    },
  });

  return (
    <Link
      to={`/orders/${notification.draftId}`}
      onClick={() => {
        read.mutate({ id: notification.id });
        onFollowed();
      }}
      className={cn(
        'flex min-h-11 flex-col justify-center gap-0.5 rounded-[var(--radius-control)] px-3 py-2',
        'transition-all duration-300 hover:bg-canvas active:scale-95',
      )}
    >
      <span className="text-[15px] text-ink">{reasonOf(notification.kind)}</span>
      <span className="text-[13px] text-ink-faint">{shortDate(notification.createdAt)}</span>
    </Link>
  );
}

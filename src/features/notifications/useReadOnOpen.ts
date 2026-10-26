import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalNotificationsQueryKey,
  readPortalNotification,
  useGetPortalNotifications,
  type PortalNotificationDto,
} from '../../api/generated';

/** Непрочитанные уведомления повода. */
export function useUnreadOf(kind: PortalNotificationDto['kind']): string[] {
  const notifications = useGetPortalNotifications();
  const list = notifications.data?.status === 200 ? notifications.data.data : [];
  return list.filter((notice) => notice.kind === kind).map((notice) => notice.id);
}

/**
 * Открытый раздел гасит уведомления своего повода: клиент увидел то, о чём они
 * сообщали, — нажимать на плашку отдельно незачем.
 */
export function useReadOnOpen(kind: PortalNotificationDto['kind']) {
  const queryClient = useQueryClient();
  const unreadKey = useUnreadOf(kind).join(',');
  useEffect(() => {
    if (!unreadKey) return;
    void Promise.all(unreadKey.split(',').map((id) => readPortalNotification(id)))
      .finally(() => queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() }));
  }, [unreadKey, queryClient]);
}

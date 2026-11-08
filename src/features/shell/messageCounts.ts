import type { PortalNotificationDto } from '../../api/generated';

/** Непрочитанное по разделам «Сообщений»: заявки, вопросы продавцу, мои отзывы. */
export interface MessageCounts {
  orders: number;
  questions: number;
  reviews: number;
  total: number;
}

/**
 * Раздел уведомления — по его поводу: ответ на вопрос живёт в «Вопросах», ответ на отзыв —
 * в «Моих отзывах», всё остальное о заявке — в «Моих заявках». Уведомления без заявки
 * (долг, новинки, акции) к разговору с продавцом не относятся и здесь не считаются.
 */
export function messageCounts(notifications: PortalNotificationDto[]): MessageCounts {
  let orders = 0;
  let questions = 0;
  let reviews = 0;
  for (const notification of notifications) {
    if (notification.kind === 'QUESTION_ANSWERED') questions += 1;
    else if (notification.kind === 'REVIEW_ANSWERED') reviews += 1;
    else if (notification.draftId) orders += 1;
  }
  return { orders, questions, reviews, total: orders + questions + reviews };
}

/** Уведомления о самой заявке — те, что гасит её открытие. */
export function isAboutOrder(notification: PortalNotificationDto, orderId: string): boolean {
  return notification.draftId === orderId
    && notification.kind !== 'QUESTION_ANSWERED' && notification.kind !== 'REVIEW_ANSWERED';
}

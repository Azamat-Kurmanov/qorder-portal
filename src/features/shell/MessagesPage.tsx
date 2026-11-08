import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useGetPortalNotifications } from '../../api/generated';
import { Bell, ChevronRight, MessageCircleQuestion, Star } from '../../ui/icons';
import { cn } from '../../ui/cn';
import { useCurrentShop } from './Shops';
import { messageCounts } from './messageCounts';

/**
 * «Сообщения» (решение владельца 2026-10-30, «Вариант Б» — макет SimplePicMessages): вопросы продавцу,
 * отзывы и уведомления крупными карточками. «Мои заявки» здесь не повторяются — они с числом стоят
 * на «Главной» (решение владельца 2026-11-05); новое по заявкам видно в «Уведомлениях».
 *
 * У каждого раздела — сколько в нём нового. Число гаснет, когда новое прочитано: ветку вопроса
 * открыли, «Мои отзывы» открыли.
 */
export function MessagesPage() {
  const { t } = useTranslation();
  const reviews = useCurrentShop()?.reviews;
  const notifications = useGetPortalNotifications();
  const list = notifications.data?.status === 200 ? notifications.data.data : [];
  const counts = messageCounts(list);
  const unreadAll = list.length;
  const row = (to: string, icon: typeof Bell, label: string, count: number, warm = false) => {
    const Icon = icon;
    return (
      <li>
        <Link to={to} aria-label={count > 0 ? `${label}, ${t('shell.unread', { count })}` : undefined}
          className={cn(
            'flex min-h-20 items-center gap-3.5 rounded-[var(--radius-card)] border-2 border-solid p-4 text-ink no-underline',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            warm ? 'border-hit-soft bg-hit-soft/50' : 'border-hairline bg-surface hover:border-line',
          )}>
          <span aria-hidden="true" className={cn('flex size-14 shrink-0 items-center justify-center rounded-[0.875rem]',
            warm ? 'bg-surface text-hit-ink' : 'bg-ok-soft text-shop-ink')}>
            <Icon className="size-7" />
          </span>
          <b className="min-w-0 flex-1 text-lead font-extrabold">{label}</b>
          {count > 0 ? (
            <span data-testid={`messages-count-${to.slice(1)}`} aria-hidden="true"
              className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-sale px-2.5 text-caption font-extrabold text-on-sale">
              {count}
            </span>
          ) : null}
          <ChevronRight aria-hidden="true" className="size-6 shrink-0 text-ink-faint" />
        </Link>
      </li>
    );
  };
  return (
    <div className="flex flex-col gap-3 pb-20">
      <div className="pt-1">
        <h1 className="m-0 text-display font-extrabold leading-tight text-ink">{t('shell.tabs.messages')}</h1>
        <p className="m-0 mt-1 text-body text-ink-muted">{t('messages.subtitle')}</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:max-w-3xl">
        {row('/questions', MessageCircleQuestion, t('shell.sections.questions'), counts.questions)}
        {reviews ? row('/reviews', Star, t('shell.sections.reviews'), counts.reviews) : null}
        {row('/notifications', Bell, t('notifications.title'), unreadAll, true)}
      </ul>
    </div>
  );
}

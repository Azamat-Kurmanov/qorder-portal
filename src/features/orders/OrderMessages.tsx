import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PortalOrderMessage } from '../../api/generated';
import { intlLocale } from '../../i18n';
import { cn } from '../../ui/cn';
import { orderDay } from './orderText';

function Label({ children }: { children: ReactNode }) {
  return <span className="text-2xs font-bold uppercase tracking-[0.06em] text-ink-subtle">{children}</span>;
}

/** Время сообщения: «сегодня, 11:40» или «21 сентября, 10:05». */
function when(iso: string, t: (key: string) => string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(date);
  const today = new Date().toDateString() === date.toDateString();
  return `${today ? t('orders.v2.today') : orderDay(iso)}, ${time}`;
}

/**
 * Лента переписки по заявке — вопросы клиента и ответы продавца, по времени.
 *
 * Общий компонент для списка заявок и страницы одной заявки: разметка
 * раньше жила только в карточке списка, и ответ продавца на странице заявки
 * показывался отдельной, чуть другой карточкой — клиент видел два разных
 * представления одного и того же разговора в зависимости от того, откуда
 * зашёл.
 */
export function OrderMessages({ messages }: { messages?: PortalOrderMessage[] }) {
  const { t } = useTranslation();
  if (!messages?.length) return null;

  return (
    <section className="flex flex-col gap-2" aria-label={t('orders.v2.conversation')}>
      <Label>{t('orders.v2.conversation')}</Label>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {messages.map((message, index) => {
          const mine = message.author === 'CUSTOMER';
          return (
            <li key={`${message.createdAt}-${index}`}
              className={cn('flex max-w-[34rem] flex-col gap-0.5 rounded-[var(--radius-control)] px-3 py-2 text-sm',
                mine ? 'self-end bg-accent-soft text-ink' : 'self-start bg-sunk text-ink')}>
              <span className="text-[0.7188rem] font-semibold text-ink-subtle">
                {mine ? t('orders.v2.youAuthor') : t('orders.v2.seller')} · {when(message.createdAt, t)}
              </span>
              <span className="whitespace-pre-line">{message.text}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

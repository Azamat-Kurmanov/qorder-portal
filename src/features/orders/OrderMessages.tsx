import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyPortalOrderQueryKey,
  getGetMyPortalOrdersQueryKey,
  useAskAboutMyPortalOrder,
  type PortalOrderDto,
  type PortalOrderMessage,
} from '../../api/generated';
import { rules } from '../../api/rules.generated';
import { intlLocale } from '../../i18n';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { MessageCircle, X } from '../../ui/icons';
import { sendOnEnter } from '../../ui/sendOnEnter';
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
export function OrderMessages({ messages, onReply }: {
  messages?: PortalOrderMessage[];
  /** «Ответить» у ответа продавца — вопрос именно о нём; без обработчика кнопки нет. */
  onReply?: (quote: string) => void;
}) {
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
              <span className="text-2xs font-semibold text-ink-subtle">
                {mine ? t('orders.v2.youAuthor') : t('orders.v2.seller')} · {when(message.createdAt, t)}
              </span>
              <span className="whitespace-pre-line">{message.text}</span>
              {!mine && onReply ? (
                <button type="button" onClick={() => onReply(quoteOf(message.text))}
                  aria-label={t('orders.v2.replyAria', { quote: quoteOf(message.text) })}
                  className="mt-1 inline-flex cursor-pointer items-center gap-1 self-start text-caption font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <MessageCircle aria-hidden="true" className="size-4" />
                  {t('orders.v2.reply')}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Начало ответа продавца одной строкой — чтобы в цитате было видно, о чём речь, но не весь текст. */
export function quoteOf(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 120 ? `${line.slice(0, 119)}…` : line;
}

/**
 * Вопрос продавцу по этой заявке: уходит в её переписку — и из списка заявок, и со страницы заявки.
 * С цитатой — ответ на конкретный ответ продавца: цитата идёт первой строкой сообщения,
 * чтобы менеджер в карточке заявки видел, на что ему отвечают (решение владельца 2026-10-31).
 */
export function AskForm({ order, quote, onDone }: { order: PortalOrderDto; quote?: string; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [quoted, setQuoted] = useState(quote);
  const fieldId = useId();
  const ask = useAskAboutMyPortalOrder({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrderQueryKey(order.id) });
        onDone();
      },
    },
  });
  const failed = ask.isError || (ask.data !== undefined && ask.data.status !== 200);
  const prefix = quoted ? `${t('orders.v2.replyPrefix', { quote: quoted })}\n\n` : '';

  const send = () => {
    if (!text.trim() || ask.isPending) return;
    ask.mutate({ id: order.id, data: { text: prefix + text.trim() } });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
        {t(quoted ? 'orders.v2.replyLabel' : 'orders.v2.askLabel')}
      </label>
      {quoted ? (
        <div data-testid="reply-quote" className="flex items-start gap-2 rounded-[var(--radius-control)] border-l-2 border-accent bg-sunk px-3 py-2 text-sm text-ink-muted">
          <span className="min-w-0 flex-1">«{quoted}»</span>
          <button type="button" aria-label={t('orders.v2.replyDrop')} onClick={() => setQuoted(undefined)}
            className="qo-hit flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}
      <textarea
        id={fieldId}
        rows={3}
        maxLength={rules.AskAboutOrderRequest.text.maxLength - prefix.length}
        autoFocus
        value={text}
        placeholder={t(quoted ? 'orders.v2.replyPlaceholder' : 'orders.v2.askPlaceholder')}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={sendOnEnter(send)}
        className="resize-y rounded-[var(--radius-control)] border-[1.5px] border-solid border-field-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
      />
      {failed ? <p role="alert" className="m-0 text-sm text-gone">{t('orders.v2.askFailed')}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="accent" disabled={!text.trim() || ask.isPending}>
          {ask.isPending ? t('orders.sending') : t('orders.v2.send')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>{t('orders.v2.askCancel')}</Button>
      </div>
    </form>
  );
}

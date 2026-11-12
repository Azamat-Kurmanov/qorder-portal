import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rules } from '../../api/rules.generated';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getGetPortalQuestionQueryKey,
  getGetPortalQuestionsQueryKey,
  useAskPortalQuestion,
  useReplyPortalQuestion,
} from '../../api/generated';
import { cn } from '../../ui/cn';
import { sendOnEnter } from '../../ui/sendOnEnter';
import { MessageCircle } from '../../ui/icons';
import { CHIP_ROW } from '../../ui/chipRow';

/**
 * Поле сообщения внизу переписки.
 *
 * Поле одно на всю переписку, и это уже не ограничение контракта, а её
 * устройство: вопросы клиента идут одной веткой со своим номером, и
 * написанное здесь ложится в тот же разговор, который он видит выше.
 * Отдельное поле под каждым сообщением предлагало бы выбрать ветку там,
 * где она одна.
 */
export function MessageComposer({ threadId, card = false, itemName }: {
  /** Ветка, в которую пишем; пусто — новый вопрос, своя ветка (макет К2.14). */
  threadId?: string;
  /**
   * Новый вопрос — карточкой вверху страницы, с готовыми темами: поле внизу пустой страницы
   * на мониторе стояло далеко от всего, и было неясно, о чём спрашивать (просьба владельца 2026-11-06).
   */
  card?: boolean;
  /** Товар, о котором новый вопрос (пришли из его карточки). */
  itemName?: string;
} = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  // Пришли из карточки товара (`?item=`): новый вопрос — об этой позиции.
  const [params] = useSearchParams();
  const itemId = params.get('item') ?? undefined;

  const done = (response: { status: number; data?: unknown }) => {
    if (response.status !== 201) {
      setFailed(true);
      return false;
    }
    setText('');
    setFailed(false);
    if (field.current) field.current.style.height = 'auto';
    // Список и ветка помечаются устаревшими, а не дополняются отправленным:
    // номер обращения и время присваивает сервер.
    void queryClient.invalidateQueries({ queryKey: getGetPortalQuestionsQueryKey() });
    if (threadId) void queryClient.invalidateQueries({ queryKey: getGetPortalQuestionQueryKey(threadId) });
    return true;
  };
  const ask = useAskPortalQuestion({
    mutation: {
      onSuccess: (response) => {
        // Новый вопрос открывается своей веткой — там и придёт ответ.
        if (done(response) && response.status === 201) navigate(`/questions/${response.data.id}`);
      },
      onError: () => setFailed(true),
    },
  });
  const reply = useReplyPortalQuestion({
    mutation: { onSuccess: (response) => { done(response); }, onError: () => setFailed(true) },
  });
  const pending = ask.isPending || reply.isPending;

  const send = () => {
    const message = text.trim();
    if (message.length === 0 || pending) return;
    if (threadId) reply.mutate({ threadId, data: { text: message } });
    else ask.mutate({ data: { itemId, text: message } });
  };

  const grow = (area: HTMLTextAreaElement) => {
    // Поле растёт под текст: вопрос в три строки, набираемый в щель
    // высотой в одну, человек перечитать перед отправкой не может.
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, card ? 200 : 128)}px`;
  };

  if (card) {
    const topics = ['stock', 'when', 'wholesale', 'pickup'] as const;
    return (
      <section
        aria-labelledby="ask-title"
        className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border-2 border-accent/25 bg-surface p-3.5 shadow-soft lg:gap-3 lg:p-5"
      >
        <div className="flex items-center gap-2.5 lg:items-start lg:gap-3">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent lg:size-10 lg:rounded-xl">
            <MessageCircle className="size-4 lg:size-5" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <h2 id="ask-title" className="m-0 text-base font-extrabold text-ink lg:text-lg">{t('questions.askTitle')}</h2>
            {itemName ? <span className="text-sm font-semibold text-ink">{t('questions.aboutItemNew', { name: itemName })}</span> : null}
            {/* На телефоне пояснение съедало пол-экрана до поля — оно под заголовком раздела. */}
            <span className="text-sm text-ink-muted max-lg:hidden">{t('questions.askHint')}</span>
          </span>
        </div>
        {/* Готовые темы: одно нажатие — и вопрос в поле, остаётся дописать подробности. */}
        {/* Одной строкой, листаются вбок на телефоне; на мониторе переносятся (ряды чипов — CHIP_ROW). */}
        <div className={cn(CHIP_ROW, 'gap-2 lg:flex-wrap lg:overflow-visible')} aria-label={t('questions.topicsLabel')} role="group">
          {topics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => {
                const next = t(`questions.topics.${topic}`);
                setText(next);
                requestAnimationFrame(() => {
                  const area = field.current;
                  if (!area) return;
                  grow(area);
                  area.focus();
                  area.setSelectionRange(next.length, next.length);
                });
              }}
              className="min-h-10 cursor-pointer rounded-[var(--radius-pill)] border border-hairline bg-canvas px-3 text-caption font-semibold text-ink lg:px-3.5 lg:text-sm transition-colors duration-150 hover:border-accent hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t(`questions.topics.${topic}`)}
            </button>
          ))}
        </div>
        <textarea
          ref={field}
          rows={2}
          value={text}
          maxLength={rules.AskQuestionRequest.text.maxLength}
          aria-label={t('questions.message')}
          placeholder={t('questions.newQuestion')}
          onKeyDown={sendOnEnter(send)}
          onChange={(event) => {
            setText(event.currentTarget.value);
            grow(event.currentTarget);
          }}
          className={cn(
            'min-h-[4.75rem] w-full resize-none rounded-[var(--radius-control)] border-2 border-field-line bg-canvas lg:min-h-24',
            'px-3.5 py-3 text-base leading-[1.45] text-ink placeholder:text-ink-faint',
            'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-1 focus:ring-accent focus:bg-surface focus:outline-none',
          )}
        />
        {failed && <p role="alert" className="m-0 text-sm text-gone">{t('questions.messageFailed')}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 max-lg:justify-end">
          {/* Про Enter — только там, где есть клавиатура. */}
          <span className="text-xs text-ink-subtle max-lg:hidden">{t('questions.enterHint')}</span>
          <button
            type="button"
            disabled={text.trim().length === 0 || pending}
            onClick={send}
            className={cn(
              'inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border-0 bg-accent px-5 max-lg:w-full',
              'text-base font-bold text-on-accent transition-all duration-200 hover:bg-accent-hover active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-default disabled:opacity-40',
            )}
          >
            <SendIcon />
            {t('questions.send')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div
      className={cn(
        // Липкое, а не прижатое к концу списка: переписка длиннее экрана,
        // и уезжающее вверх поле пришлось бы догонять прокруткой.
        // На телефоне — над нижним меню: прижатое к низу экрана, поле пряталось под ним.
        // На телефоне не липнет: прокручивается вся страница (решение владельца 2026-11-04).
        // На мониторе — шириной колонки разговора, с закруглённым верхом, а не полосой во всю страницу.
        '-mx-4 mt-auto border-t border-hairline bg-surface px-4 lg:sticky lg:bottom-0 lg:mx-0 lg:rounded-t-[var(--radius-card)] lg:border-x-2 lg:border-t-2',
        // На телефоне — над нижним меню целиком, с его круглой кнопкой «Каталог»: страница кончалась
        // под меню, и поле в конце длинной ветки пряталось под ним.
        'pt-3 pb-3 lg:pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-lg:mb-[calc(6.5rem+env(safe-area-inset-bottom))]',
      )}
    >
      {failed && (
        <p role="alert" className="pb-2 text-sm text-gone">
          {t('questions.messageFailed')}
        </p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={field}
          rows={1}
          value={text}
          maxLength={rules.AskQuestionRequest.text.maxLength}
          aria-label={t('questions.message')}
          placeholder={threadId ? t('questions.writeMessage') : t('questions.newQuestion')}
          onKeyDown={sendOnEnter(send)}
          onChange={(event) => {
            setText(event.currentTarget.value);
            grow(event.currentTarget);
          }}
          className={cn(
            'min-h-12 flex-1 resize-none rounded-[var(--radius-control)] border border-hairline bg-surface',
            'px-3.5 py-3 text-body leading-[1.45] text-ink placeholder:text-ink-faint',
            'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
          )}
        />

        <button
          type="button"
          aria-label={t('questions.sendMessage')}
          disabled={text.trim().length === 0 || pending}
          onClick={send}
          className={cn(
            'inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)]',
            'bg-accent text-on-accent transition-all duration-300 active:scale-95 hover:bg-accent-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-[18px]">
      <path d="M3 10.5 17 4l-5 13-2.4-5.1L3 10.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rules } from '../../api/rules.generated';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getGetPortalQuestionQueryKey,
  getGetPortalQuestionsQueryKey,
  useAskPortalQuestion,
  useReplyPortalQuestion,
} from '../../api/generated';
import { cn } from '../../ui/cn';
import { sendOnEnter } from '../../ui/sendOnEnter';

/**
 * Поле сообщения внизу переписки.
 *
 * Отдельно от `AskQuestionForm`: в карточке товара вопрос спрашивают
 * по случаю, и развёрнутое поле там читалось бы как требование что-нибудь
 * написать; сюда же приходят именно писать, и лишнее нажатие «спросить»
 * стояло бы между человеком и его вопросом.
 *
 * Поле одно на всю переписку, и это уже не ограничение контракта, а её
 * устройство: вопросы клиента идут одной веткой со своим номером, и
 * написанное здесь ложится в тот же разговор, который он видит выше.
 * Отдельное поле под каждым сообщением предлагало бы выбрать ветку там,
 * где она одна.
 */
export function MessageComposer({ threadId }: {
  /** Ветка, в которую пишем; пусто — новый вопрос, своя ветка (макет К2.14). */
  threadId?: string;
} = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

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
    else ask.mutate({ data: { text: message } });
  };

  return (
    <div
      className={cn(
        // Липкое, а не прижатое к концу списка: переписка длиннее экрана,
        // и уезжающее вверх поле пришлось бы догонять прокруткой.
        // На телефоне — над нижним меню: прижатое к низу экрана, поле пряталось под ним.
        'sticky bottom-0 -mx-4 mt-auto border-t border-hairline bg-surface px-4',
        'max-lg:bottom-[calc(4.25rem+env(safe-area-inset-bottom))]',
        'pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
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
            // Поле растёт под текст: вопрос в три строки, набираемый в щель
            // высотой в одну, человек перечитать перед отправкой не может.
            event.currentTarget.style.height = 'auto';
            event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 128)}px`;
          }}
          className={cn(
            'min-h-12 flex-1 resize-none rounded-[var(--radius-control)] border border-hairline bg-surface',
            'px-3.5 py-3 text-[0.875rem] leading-[1.45] text-ink placeholder:text-ink-faint',
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
            'bg-ink text-on-ink transition-all duration-300 active:scale-95 hover:bg-ink/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-[18px]">
            <path
              d="M3 10.5 17 4l-5 13-2.4-5.1L3 10.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

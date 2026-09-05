import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPortalQuestionsQueryKey, useAskPortalQuestion } from '../../api/generated';
import { cn } from '../../ui/cn';

/**
 * Поле сообщения внизу переписки.
 *
 * Отдельно от `AskQuestionForm`: в карточке товара вопрос спрашивают
 * по случаю, и развёрнутое поле там читалось бы как требование что-нибудь
 * написать; сюда же приходят именно писать, и лишнее нажатие «спросить»
 * стояло бы между человеком и его вопросом.
 *
 * Отвечать в ветку сервер не умеет: каждое сообщение заводит своё обращение
 * со своим номером — его клиент и назовёт по телефону. Поэтому поле стоит под
 * всей перепиской, а не под отдельным разговором: обещать ответ «сюда же»
 * значило бы обещать то, чего в контракте нет.
 */
export function MessageComposer() {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  const ask = useAskPortalQuestion({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 201) {
          setFailed(true);
          return;
        }
        setText('');
        setFailed(false);
        if (field.current) field.current.style.height = 'auto';
        // Переписка помечается устаревшей, а не дополняется отправленным:
        // номер обращения и время присваивает сервер, и собранное экраном
        // сообщение разошлось бы с тем, что увидит продавец.
        void queryClient.invalidateQueries({ queryKey: getGetPortalQuestionsQueryKey() });
      },
      onError: () => setFailed(true),
    },
  });

  const send = () => {
    const message = text.trim();
    if (message.length === 0 || ask.isPending) return;
    ask.mutate({ data: { text: message } });
  };

  return (
    <div
      className={cn(
        // Липкое, а не прижатое к концу списка: переписка длиннее экрана,
        // и уезжающее вверх поле пришлось бы догонять прокруткой.
        'sticky bottom-0 -mx-4 mt-auto border-t border-hairline bg-surface px-4',
        'pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
      )}
    >
      {failed && (
        <p role="alert" className="pb-2 text-sm text-gone">
          Сообщение не отправилось. Попробуйте ещё раз.
        </p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={field}
          rows={1}
          value={text}
          maxLength={2000}
          aria-label="Сообщение продавцу"
          placeholder="Написать сообщение"
          onChange={(event) => {
            setText(event.currentTarget.value);
            // Поле растёт под текст: вопрос в три строки, набираемый в щель
            // высотой в одну, человек перечитать перед отправкой не может.
            event.currentTarget.style.height = 'auto';
            event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 128)}px`;
          }}
          className={cn(
            'min-h-12 flex-1 resize-none rounded-[14px] border border-hairline bg-surface',
            'px-3.5 py-3 text-[14px] leading-[1.45] text-ink placeholder:text-ink-faint',
            'transition-all duration-300 focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-brand/30',
          )}
        />

        <button
          type="button"
          aria-label="Отправить сообщение"
          disabled={text.trim().length === 0 || ask.isPending}
          onClick={send}
          className={cn(
            'inline-flex size-12 shrink-0 items-center justify-center rounded-[14px]',
            'bg-ink text-white transition-all duration-300 active:scale-95 hover:bg-ink/90',
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

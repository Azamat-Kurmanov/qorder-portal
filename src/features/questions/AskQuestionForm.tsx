import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPortalQuestionsQueryKey, useAskPortalQuestion } from '../../api/generated';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';

/**
 * Вопрос продавцу — прямо из карточки товара.
 *
 * Сложена, пока на неё не нажали: карточку открывают ради цены и снимков,
 * и развёрнутое поле ввода внизу каждой позиции читалось бы как требование
 * что-нибудь написать.
 *
 * Отправленный вопрос заводит обращение на стороне продавца и попадает
 * в отдельную вкладку переписки — здесь остаётся только подтверждение: разговор
 * ведут там, где он весь целиком, а не в карточке одной позиции.
 */
export function AskQuestionForm({ itemId, itemName }: { itemId?: string; itemName?: string }) {
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const ask = useAskPortalQuestion({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 201) {
          setFailed(true);
          return;
        }
        setSent(true);
        setFailed(false);
        setText('');
        setOpened(false);
        // Переписка помечается устаревшей, а не дополняется ответом: вкладка
        // могла быть открыта в соседнем окне, и вопрос обязан появиться и там.
        void queryClient.invalidateQueries({ queryKey: getGetPortalQuestionsQueryKey() });
      },
      onError: () => setFailed(true),
    },
  });

  if (sent) {
    return (
      <Card className="flex flex-col gap-1 p-4">
        <p className="text-[15px] text-ink">Вопрос отправлен продавцу.</p>
        <p className="text-sm text-ink-subtle">
          Ответ придёт во вкладку «Вопросы продавцу».
        </p>
      </Card>
    );
  }

  if (!opened) {
    return (
      <Button type="button" variant="outline" className="self-start" onClick={() => setOpened(true)}>
        Спросить продавца
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
        Вопрос
        <textarea
          autoFocus
          value={text}
          rows={3}
          maxLength={2000}
          onChange={(event) => setText(event.currentTarget.value)}
          placeholder={itemName ? `Что уточнить про «${itemName}»?` : 'О чём спросить продавца?'}
          className={cn(
            'w-full resize-y rounded-[var(--radius-control)] border border-hairline bg-surface',
            'p-3 text-[15px] text-ink placeholder:text-ink-faint',
            'transition-all duration-300 focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-brand/30',
          )}
        />
      </label>

      {failed && (
        <p role="alert" className="text-sm text-gone">
          Вопрос не отправился. Попробуйте ещё раз.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          disabled={text.trim().length === 0 || ask.isPending}
          onClick={() => ask.mutate({ data: { itemId, text: text.trim() } })}
        >
          Отправить
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
          Отмена
        </Button>
      </div>
    </Card>
  );
}

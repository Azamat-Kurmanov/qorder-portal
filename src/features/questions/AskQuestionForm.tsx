import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rules } from '../../api/rules.generated';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPortalQuestionsQueryKey, useAskPortalQuestion } from '../../api/generated';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { sendOnEnter } from '../../ui/sendOnEnter';

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
export function AskQuestionForm({
  itemId,
  itemName,
  startOpened = false,
  onClose,
}: {
  itemId?: string;
  itemName?: string;
  /** Открыть поле сразу: кнопку вопроса держит вызывающий (карточка товара). */
  startOpened?: boolean;
  /** Закрыть форму отменой — вызывающий убирает её сам. */
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(startOpened);
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

  const send = () => {
    const question = text.trim();
    if (question.length === 0 || ask.isPending) return;
    ask.mutate({ data: { itemId, text: question } });
  };

  if (sent) {
    return (
      <Card role="status" className="flex flex-col gap-1 p-4">
        <p className="text-body text-ink">{t('questions.sent')}</p>
        <p className="text-sm text-ink-subtle">
          {t('questions.answerWhere')}
        </p>
      </Card>
    );
  }

  if (!opened) {
    if (onClose) return null;
    return (
      <Button type="button" variant="outline" className="self-start" onClick={() => setOpened(true)}>
        {t('questions.ask')}
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
        {t('questions.question')}
        <textarea
          autoFocus
          value={text}
          rows={3}
          maxLength={rules.AskQuestionRequest.text.maxLength}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={sendOnEnter(send)}
          placeholder={itemName ? t('questions.aboutItem', { name: itemName }) : t('questions.questionPlaceholder')}
          className={cn(
            'w-full resize-y rounded-[var(--radius-control)] border border-hairline bg-surface',
            'p-3 text-body text-ink placeholder:text-ink-faint',
            'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
          )}
        />
      </label>

      {failed && (
        <p role="alert" className="text-sm text-gone">
          {t('questions.failed')}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          disabled={text.trim().length === 0 || ask.isPending}
          onClick={send}
        >
          {t('questions.send')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => (onClose ? onClose() : setOpened(false))}>
          {t('questions.cancel')}
        </Button>
      </div>
    </Card>
  );
}

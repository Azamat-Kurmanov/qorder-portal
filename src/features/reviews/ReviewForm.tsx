import { useState } from 'react';
import { useSubmitPortalReview, type ItemReviewDto } from '../../api/generated';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Star } from './Stars';

/**
 * Форма отзыва: одна на карточку товара и на раздел «Мои отзывы».
 *
 * Отдельным файлом, а не по месту: форма нужна в двух местах, и написанная
 * дважды через месяц окажется двумя разными формами — ровно то, из-за чего
 * звезда уже вынесена в `Stars.tsx`.
 *
 * Оценка обязательна, текст — нет: человек, которому нечего написать, всё
 * равно готов поставить звёзды, и требовать от него слов значит не получить
 * ни того, ни другого.
 *
 * Записанный отзыв уходит наверх, а не раскладывается по спискам здесь:
 * куда его положить — в карточку, в раздел или никуда, — знает вызывающий,
 * и знать это форме незачем.
 */
export function ReviewForm({
  itemId,
  initialRating = 0,
  initialText = '',
  submitLabel = 'Оставить отзыв',
  note = 'Отзыв появится на витрине после проверки продавцом.',
  onSaved,
  onCancel,
}: {
  itemId: string;
  initialRating?: number;
  initialText?: string;
  submitLabel?: string;
  note?: string;
  onSaved: (review: ItemReviewDto) => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText);
  const [failed, setFailed] = useState(false);

  const submit = useSubmitPortalReview({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 201) {
          setFailed(true);
          return;
        }
        onSaved(response.data);
        setRating(initialRating);
        setText(initialText);
        setFailed(false);
      },
      onError: () => setFailed(true),
    },
  });

  return (
    <Card className="flex flex-col gap-3 p-4">
      <StarsInput value={rating} onChange={setRating} />

      <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
        Отзыв
        <textarea
          value={text}
          maxLength={2000}
          rows={3}
          onChange={(event) => setText(event.currentTarget.value)}
          placeholder="Что понравилось, что нет"
          className={cn(
            'w-full resize-y rounded-[var(--radius-control)] border border-hairline bg-surface',
            'p-3 text-[15px] text-ink placeholder:text-ink-faint',
            'transition-all duration-300 focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-brand/30',
          )}
        />
      </label>

      {failed && (
        <p role="alert" className="text-sm text-gone">
          Отзыв не отправился. Попробуйте ещё раз.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-subtle">{note}</p>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Отмена
            </Button>
          )}
          <Button
            type="button"
            disabled={rating === 0 || submit.isPending}
            onClick={() => submit.mutate({ itemId, data: { rating, text: text.trim() || undefined } })}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Выбор оценки.
 *
 * Радиогруппой, а не пятью кнопками: оценка одна из пяти, и клавиатура
 * с озвучиванием обязаны понимать это без подсказок.
 */
export function StarsInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Оценка" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={value === rating}
          aria-label={`Оценка ${rating} из 5`}
          onClick={() => onChange(rating)}
          className={cn(
            'inline-flex size-11 items-center justify-center rounded-full',
            'transition-all duration-300 active:scale-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            rating <= value ? 'text-accent' : 'text-ink-faint hover:text-ink-muted',
          )}
        >
          <Star filled={rating <= value} />
        </button>
      ))}
    </div>
  );
}

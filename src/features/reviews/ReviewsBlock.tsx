import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalItemReviewsQueryKey,
  useGetPortalItemReviews,
  useSubmitPortalReview,
  type ItemReviewDto,
} from '../../api/generated';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { shortDate } from '../../shared/format';
import { Star, Stars } from './Stars';

/**
 * Отзывы о позиции: чужие одобренные и свои — любые.
 *
 * Свой неодобренный отзыв показывается автору с честной пометкой, а не
 * прячется: человек, чей текст исчез без следа, пишет его второй раз, а потом
 * идёт спрашивать, почему у них ничего не работает.
 *
 * Ответ продавца стоит внутри отзыва, а не отдельной веткой: разговор здесь
 * не ведут — для разговора есть вопросы продавцу.
 */
export function ReviewsBlock({ itemId, canReview }: { itemId: string; canReview: boolean }) {
  const queryClient = useQueryClient();
  const reviews = useGetPortalItemReviews(itemId);
  const list = reviews.data?.status === 200 ? reviews.data.data : [];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-base font-semibold text-ink">
        Отзывы
      </h2>

      {/*
        Форма — только тому, кто покупал: сервер отклоняет остальные отзывы
        (`REVIEW_WITHOUT_PURCHASE`), и предложенная всем форма означала бы
        выговор человеку за то, чего ему не следовало предлагать.
      */}
      {canReview ? (
      <ReviewForm
        itemId={itemId}
        onPublished={(review) => {
          // Свой отзыв кладётся в список ответом сервера, а не перезапросом:
          // до одобрения его видит только автор, и повторный запрос вернул бы
          // тот же список — с ним или без него решает сервер, а не экран.
          queryClient.setQueryData(
            getGetPortalItemReviewsQueryKey(itemId),
            (previous: { status: number; data: ItemReviewDto[] } | undefined) =>
              previous?.status === 200
                ? { ...previous, data: [review, ...previous.data] }
                : previous,
          );
        }}
      />
      ) : (
        <p className="text-sm text-ink-subtle">
          Отзыв можно оставить о том, что вы покупали у этого поставщика.
        </p>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          Отзывов пока нет. Ваш будет первым.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((review) => (
            <li key={review.id}>
              <ReviewRow review={review} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewRow({ review }: { review: ItemReviewDto }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        <span className="text-sm text-ink-muted">
          {review.authorName ?? 'Клиент'}
        </span>
        <span className="text-sm text-ink-faint">{shortDate(review.createdAt)}</span>
        {review.status === 'PENDING' && (
          // Пометка нужна автору, а не остальным: остальные этот отзыв
          // не видят вовсе.
          <span className="rounded-full bg-sunk px-2 py-0.5 text-[13px] text-unclear">
            Ждёт проверки продавцом
          </span>
        )}
      </div>

      {review.text && <p className="text-[15px] leading-relaxed text-ink">{review.text}</p>}

      {review.reply && (
        <div className="mt-1 rounded-[var(--radius-control)] border-l-2 border-accent bg-sunk p-3">
          <p className="text-[13px] font-medium text-ink-muted">Ответ продавца</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{review.reply}</p>
        </div>
      )}
    </Card>
  );
}

/**
 * Форма отзыва.
 *
 * Оценка обязательна, текст — нет: человек, которому нечего написать, всё
 * равно готов поставить звёзды, и требовать от него слов значит не получить
 * ни того, ни другого.
 */
function ReviewForm({
  itemId,
  onPublished,
}: {
  itemId: string;
  onPublished: (review: ItemReviewDto) => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);

  const submit = useSubmitPortalReview({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 201) {
          setFailed(true);
          return;
        }
        onPublished(response.data);
        setRating(0);
        setText('');
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

      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-subtle">
          Отзыв появится на витрине после проверки продавцом.
        </p>
        <Button
          type="button"
          disabled={rating === 0 || submit.isPending}
          onClick={() => submit.mutate({ itemId, data: { rating, text: text.trim() || undefined } })}
        >
          Оставить отзыв
        </Button>
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
function StarsInput({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
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

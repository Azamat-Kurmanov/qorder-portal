import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getGetPortalItemReviewsQueryKey,
  useGetPortalItemReviews,
  type ItemReviewDto,
} from '../../api/generated';
import { Card } from '../../ui/Card';
import { shortDate } from '../../shared/format';
import { ReviewForm } from './ReviewForm';
import { Stars } from './Stars';

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const reviews = useGetPortalItemReviews(itemId);
  const list = reviews.data?.status === 200 ? reviews.data.data : [];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-base font-semibold text-ink">
        {t('reviews.blockTitle')}
      </h2>

      {/*
        Форма — только тому, кто покупал: сервер отклоняет остальные отзывы
        (`REVIEW_WITHOUT_PURCHASE`), и предложенная всем форма означала бы
        выговор человеку за то, чего ему не следовало предлагать.
      */}
      {canReview ? (
        <ReviewForm
          itemId={itemId}
          onSaved={(review) => {
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
          {t('reviews.canReview')}
        </p>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          {t('reviews.noneYet')}
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
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        <span className="text-sm text-ink-muted">
          {review.authorName ?? t('reviews.client')}
        </span>
        <span className="text-sm text-ink-faint">{shortDate(review.createdAt)}</span>
        {review.status === 'PENDING' && (
          // Пометка нужна автору, а не остальным: остальные этот отзыв
          // не видят вовсе.
          <span className="rounded-full bg-sunk px-2 py-0.5 text-[13px] text-unclear">
            {t('reviews.pending')}
          </span>
        )}
      </div>

      {review.text && <p className="text-[15px] leading-relaxed text-ink">{review.text}</p>}

      {review.reply && (
        <div className="mt-1 rounded-[var(--radius-control)] border-l-2 border-accent bg-sunk p-3">
          <p className="text-[13px] font-medium text-ink-muted">{t('reviews.sellerAnswer')}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{review.reply}</p>
        </div>
      )}
    </Card>
  );
}


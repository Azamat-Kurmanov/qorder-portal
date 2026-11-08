import { Star } from '../../ui/icons';
import { BackTitle } from '../../ui/BackTitle';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalCatalogItemQueryKey,
  getGetPortalItemReviewsQueryKey,
  getGetPortalItemsAwaitingReviewQueryKey,
  getGetPortalMyReviewsQueryKey,
  useDeletePortalReview,
  useGetPortalItemsAwaitingReview,
  useGetPortalMyReviews,
  type AwaitingReviewDto,
  type ItemReviewDto,
  type ItemReviewDtoStatus,
} from '../../api/generated';
import { currentViewer } from '../../auth/oidcConfig';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Reveal } from '../../ui/Reveal';
import { shortDate } from '../../shared/format';
import { ReviewForm } from './ReviewForm';
import { Stars } from './Stars';
import { LineThumb } from '../cart/LineThumb';
import { useCurrentShop } from '../shell/Shops';
import { cn } from '../../ui/cn';

/**
 * Мои отзывы.
 *
 * Отдельным разделом, а не поиском по карточкам: отзыв живёт в карточке той
 * позиции, о которой написан, и человек, оставивший пять отзывов, чтобы найти
 * свой, должен вспомнить товар. Вопрос «что написал я» — не вопрос о товаре.
 *
 * Показываются все состояния, включая отклонённое: автор вправе знать, что
 * стало с его текстом. Отзыв, исчезнувший без объяснения, пишут второй раз.
 */
export function MyReviewsPage() {
  const { t } = useTranslation();
  const reviews = useGetPortalMyReviews();
  const list = reviews.data?.status === 200 ? reviews.data.data : [];
  const shop = useCurrentShop();

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-3">
      <BackTitle title={t('reviews.title')} subtitle={shop ? t('reviews.shopSubtitle', { shop: shop.name }) : t('reviews.subtitle')} />

      <AwaitingBlock />

      {reviews.isPending ? (
        <div
          data-testid="my-reviews-skeleton"
          className="h-24 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk"
        />
      ) : list.length === 0 ? (
        <p className="text-body leading-relaxed text-ink-subtle">
          {t('reviews.empty')}
        </p>
      ) : (
        <section aria-labelledby="yours-heading" className="flex flex-col gap-2.5">
        <h2 id="yours-heading" className="m-0 mt-1 text-lead font-extrabold text-ink">{t('reviews.yours')}</h2>
        <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0 lg:grid-cols-2">
          {list.map((review, index) => (
            <li key={review.id}>
              <Reveal delay={Math.min(index, 3) * 0.04}>
                <MyReviewRow review={review} />
              </Reveal>
            </li>
          ))}
        </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Купленное, что ещё не оценено.
 *
 * Стоит над списком, а не под ним: это единственное, что здесь можно сделать
 * прямо сейчас, — остальное уже написано. Пусто — блока нет вовсе: заголовок
 * над пустотой сообщает только о том, что раздел умеет чего-то не показывать.
 *
 * Форма разворачивается на месте: человек, дошедший до этого списка, готов
 * оценить сейчас, и отправлять его за этим в карточку значит терять его
 * по дороге.
 */
function AwaitingBlock() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const awaiting = useGetPortalItemsAwaitingReview();
  const items = awaiting.data?.status === 200 ? awaiting.data.data : [];

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby="awaiting-heading">
      <h2 id="awaiting-heading" className="m-0 mt-1 text-lead font-extrabold text-ink">
        {t('reviews.awaiting')} · {items.length}
      </h2>
      {/* Как в макете: короткий список купленного, форма оценки — по «Оценить» у строки. */}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((item) => (
          <li key={item.itemId} className="rounded-[var(--radius-card)] border-[3px] border-solid border-hit-ink/25 bg-surface p-3.5">
            <AwaitingRow
              item={item}
              onSaved={() => {
                // Оценённое уходит отсюда и появляется в списке ниже: два
                // запроса, потому что сервер решает оба списка, а не экран.
                queryClient.invalidateQueries({
                  queryKey: getGetPortalItemsAwaitingReviewQueryKey(),
                });
                queryClient.invalidateQueries({ queryKey: getGetPortalMyReviewsQueryKey() });
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AwaitingRow({
  item,
  onSaved,
}: {
  item: AwaitingReviewDto;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  // Оценка — звёздами прямо в строке (макет К2.15): нажатая звезда раскрывает
  // форму уже с этой оценкой, текст и фото — по желанию.
  const [rating, setRating] = useState(0);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <LineThumb seed={item.itemId} className="size-14 shrink-0" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <Link
            to={`/catalog/${item.itemId}`}
            className="text-lead font-extrabold text-ink underline-offset-4 hover:underline"
          >
            {item.itemName}
          </Link>
          <span className="text-caption text-ink-muted">
            {t('reviews.purchasedAt', { date: shortDate(item.purchasedAt) })}
          </span>
        </span>
      </div>
      {rating > 0 ? (
        <ReviewForm itemId={item.itemId} initialRating={rating} submitLabel={t('reviews.rate')} onSaved={onSaved} />
      ) : (
        <div role="group" aria-label={t('reviews.rateItem', { name: item.itemName })} className="flex justify-between">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={t('reviews.rateWith', { rating: value })}
              onClick={() => setRating(value)}
              className="flex size-14 cursor-pointer items-center justify-center rounded-2xl border-0 bg-hit-soft text-line transition-colors hover:text-star focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Star aria-hidden="true" className="size-8" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Подпись состояния: человеку нужно слово, а не код модерации.
 *
 * Здесь ключ словаря, а не само слово: карта считается один раз на модуле,
 * и подпись, посчитанная тут, осталась бы на прежнем языке после его смены.
 */
const STATUS_LOOK: Record<ItemReviewDtoStatus, string> = {
  PENDING: 'bg-hit-soft text-hit-ink',
  PUBLISHED: 'bg-ok-soft text-ok-ink',
  REJECTED: 'bg-sale-soft text-sale-ink',
};

const STATUS_KEY: Record<ItemReviewDtoStatus, string> = {
  PENDING: 'reviews.pending',
  PUBLISHED: 'reviews.published',
  REJECTED: 'reviews.rejected',
};

/**
 * Один отзыв: что написано, что с ним стало и что с ним можно сделать.
 *
 * Правка и удаление стоят здесь, а не в карточке товара: человек приходит
 * сюда именно за этим, и отправлять его обратно в карточку ради двух кнопок
 * значит отправлять его искать товар, который он уже нашёл.
 */
function MyReviewRow({ review }: { review: ItemReviewDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  // Обесценивается и карточка позиции: удалённый отзыв меняет её среднюю
  // оценку, и оставленный прежним список показал бы звёзды удалённого.
  // Обесценивается и «ждут вашей оценки»: сервер после удаления снова
  // считает позицию неоценённой (deletedReviewReturnsItemToAwaiting), и это
  // единственный экран, где оба списка стоят рядом, — оставленный прежним,
  // он показал бы отзыв исчезнувшим, а позицию сверху так и не появившейся.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetPortalMyReviewsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPortalItemReviewsQueryKey(review.itemId) });
    queryClient.invalidateQueries({ queryKey: getGetPortalCatalogItemQueryKey(review.itemId) });
    queryClient.invalidateQueries({ queryKey: getGetPortalItemsAwaitingReviewQueryKey() });
  };

  const remove = useDeletePortalReview({
    mutation: {
      onSuccess: () => {
        setConfirming(false);
        setFailed(false);
        refresh();
      },
      onError: () => setFailed(true),
    },
  });

  return (
    <Card className="flex flex-col gap-2 p-3.5">
      <div className="flex gap-3">
        <LineThumb seed={review.itemId} className="size-14 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {review.itemName ? (
            <Link
              to={`/catalog/${review.itemId}`}
              className="text-lead font-extrabold text-ink underline-offset-4 hover:underline"
            >
              {review.itemName}
            </Link>
          ) : (
            // Позиция снята с продажи: отзыв о ней остаётся, а вести на карточку
            // некуда — она не откроется.
            <span className="text-lead text-ink-faint">{t('reviews.gone')}</span>
          )}
          <span className="flex flex-wrap items-center gap-2">
            <Stars value={review.rating} />
            <span className="text-caption text-ink-muted">{shortDate(review.createdAt)}</span>
          </span>
        </span>
      </div>

      {editing ? (
        <ReviewForm
          itemId={review.itemId}
          initialRating={review.rating}
          initialText={review.text ?? ''}
          initialPhotos={review.photos ?? []}
          submitLabel={t('reviews.save')}
          // Правленый отзыв возвращается на модерацию на сервере, и человек,
          // у которого одобренный отзыв вдруг стал ожидающим, иначе решит,
          // что что-то сломалось.
          note={t('reviews.editNote')}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : (
        <>
          {review.text && <p className="m-0 text-lead leading-relaxed text-ink before:content-['«'] after:content-['»']">{review.text}</p>}

          <span className={cn('inline-flex h-8 items-center self-start rounded-full px-3.5 text-caption font-extrabold', STATUS_LOOK[review.status])}>
            {STATUS_KEY[review.status] ? t(STATUS_KEY[review.status]) : review.status}
          </span>

          {review.reply && (
            <div className="rounded-[0.875rem] bg-canvas px-3 py-2.5 text-body leading-relaxed text-ink">
              <b>{t('reviews.sellerAnswer')}:</b> {review.reply}
            </div>
          )}

          {failed && (
            <p role="alert" className="text-sm text-gone">
              {t('reviews.deleteFailed')}
            </p>
          )}

          {/* Сотрудник магазина отзывы не правит и не удаляет — сервер ему откажет. */}
          {currentViewer() !== 'staff' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Вторичные действия — мягкими кнопками, а не чёрными плашками (макеты «Кабинет клиента 2.0»). */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(true);
                // Взведённое подтверждение, пережившее уход в правку и
                // возврат назад, — это удаление, которого человек не начинал.
                setConfirming(false);
              }}
            >
              {t('reviews.edit')}
            </Button>
            {/*
              Подтверждение на месте, а не окном: окон подтверждения в кабинете
              нет ни одного, и первое, заведённое ради этой кнопки, оказалось бы
              единственным способом что-то подтвердить во всём кабинете.
            */}
            {confirming ? (
              <>
                <Button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ itemId: review.itemId })}
                >
                  {t('reviews.confirmDelete')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                  {t('reviews.cancel')}
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
                {t('reviews.delete')}
              </Button>
            )}
          </div>
          )}
        </>
      )}
    </Card>
  );
}

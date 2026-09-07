import { useState } from 'react';
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
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Reveal } from '../../ui/Reveal';
import { shortDate } from '../../shared/format';
import { ReviewForm } from './ReviewForm';
import { Stars } from './Stars';

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
  const reviews = useGetPortalMyReviews();
  const list = reviews.data?.status === 200 ? reviews.data.data : [];

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-5">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">Мои отзывы</h1>
        <p className="text-[13px] text-ink-subtle">Что вы написали о товарах поставщика</p>
      </header>

      <AwaitingBlock />

      {reviews.isPending ? (
        <div
          data-testid="my-reviews-skeleton"
          className="h-24 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk"
        />
      ) : list.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-ink-subtle">
          Вы ещё не оценивали товары этого поставщика. Отзыв можно оставить
          о том, что вы у него покупали, — из карточки товара или отсюда.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((review, index) => (
            <li key={review.id}>
              <Reveal delay={Math.min(index, 3) * 0.04}>
                <MyReviewRow review={review} />
              </Reveal>
            </li>
          ))}
        </ul>
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
  const queryClient = useQueryClient();
  const awaiting = useGetPortalItemsAwaitingReview();
  const items = awaiting.data?.status === 200 ? awaiting.data.data : [];

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="awaiting-heading">
      <h2 id="awaiting-heading" className="text-base font-semibold text-ink">
        Ждут вашей оценки
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.itemId}>
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
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          to={`/catalog/${item.itemId}`}
          className="text-sm font-medium text-ink underline-offset-4 hover:underline"
        >
          {item.itemName}
        </Link>
        <span className="text-sm text-ink-faint">куплено {shortDate(item.purchasedAt)}</span>
      </div>
      <ReviewForm itemId={item.itemId} submitLabel="Оценить" onSaved={onSaved} />
    </div>
  );
}

/** Подпись состояния: человеку нужно слово, а не код модерации. */
const STATUS_LABEL: Record<ItemReviewDtoStatus, string> = {
  PENDING: 'Ждёт проверки продавцом',
  PUBLISHED: 'Опубликован',
  REJECTED: 'Отклонён продавцом',
};

/**
 * Один отзыв: что написано, что с ним стало и что с ним можно сделать.
 *
 * Правка и удаление стоят здесь, а не в карточке товара: человек приходит
 * сюда именно за этим, и отправлять его обратно в карточку ради двух кнопок
 * значит отправлять его искать товар, который он уже нашёл.
 */
function MyReviewRow({ review }: { review: ItemReviewDto }) {
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
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        {review.itemName ? (
          <Link
            to={`/catalog/${review.itemId}`}
            className="text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            {review.itemName}
          </Link>
        ) : (
          // Позиция снята с продажи: отзыв о ней остаётся, а вести на карточку
          // некуда — она не откроется.
          <span className="text-sm text-ink-faint">Позиция снята с продажи</span>
        )}
        <span className="text-sm text-ink-faint">{shortDate(review.createdAt)}</span>
        <span className="rounded-full bg-sunk px-2 py-0.5 text-[13px] text-unclear">
          {STATUS_LABEL[review.status] ?? review.status}
        </span>
      </div>

      {editing ? (
        <ReviewForm
          itemId={review.itemId}
          initialRating={review.rating}
          initialText={review.text ?? ''}
          submitLabel="Сохранить"
          // Правленый отзыв возвращается на модерацию на сервере, и человек,
          // у которого одобренный отзыв вдруг стал ожидающим, иначе решит,
          // что что-то сломалось.
          note="Исправленный отзыв снова уйдёт на проверку продавцом."
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : (
        <>
          {review.text && <p className="text-[15px] leading-relaxed text-ink">{review.text}</p>}

          {review.reply && (
            <div className="mt-1 rounded-[var(--radius-control)] border-l-2 border-accent bg-sunk p-3">
              <p className="text-[13px] font-medium text-ink-muted">Ответ продавца</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">{review.reply}</p>
            </div>
          )}

          {failed && (
            <p role="alert" className="text-sm text-gone">
              Отзыв не удалился. Попробуйте ещё раз.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => {
                setEditing(true);
                // Взведённое подтверждение, пережившее уход в правку и
                // возврат назад, — это удаление, которого человек не начинал.
                setConfirming(false);
              }}
            >
              Изменить
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
                  Да, удалить
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                  Отмена
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => setConfirming(true)}>
                Удалить
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

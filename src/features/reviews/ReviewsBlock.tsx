import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, ThumbsUp } from '../../ui/icons';
import {
  getGetPortalItemReviewsQueryKey,
  useGetPortalItemReviews,
  useTogglePortalReviewHelpful,
  type ItemReviewDto,
} from '../../api/generated';
import { intlLocale } from '../../i18n';
import { dayMonth, shortDate } from '../../shared/format';
import { cn } from '../../ui/cn';
import { prefersReducedMotion } from '../../ui/reducedMotion';
import { ReviewForm } from './ReviewForm';
import { ReviewPhotoStrip } from './ReviewPhotos';
import { Star, Stars } from './Stars';
import { useCurrentShop } from '../shell/Shops';
import { currentViewer } from '../../auth/oidcConfig';

type Filter = 'all' | '5' | '4' | 'low';

/**
 * «Отзывы и оценки» в карточке товара — по макету «Карточка товара v2».
 *
 * Слева — сводка (средняя, число отзывов, распределение по звёздам) и место
 * для своей оценки: форма любому клиенту магазина (товар он мог купить и вне
 * системы), благодарность тому, кто уже оценил. Строка «Вы покупали · заявка
 * №…» — только при заявке с этим товаром, и метка «Покупал в магазине» у отзыва
 * — только когда заявка есть у его автора. Справа — сами отзывы с отбором
 * по звёздам.
 *
 * Свой неодобренный отзыв показывается автору с честной пометкой, а не
 * прячется: человек, чей текст исчез без следа, пишет его второй раз.
 * Ответ продавца стоит внутри отзыва: разговор ведут в вопросах продавцу.
 */
export function ReviewsBlock({
  itemId,
  canReview,
  sizeTags = false,
  purchase,
}: {
  itemId: string;
  canReview: boolean;
  /** Предлагать метки о размере — у товара с размером. */
  sizeTags?: boolean;
  /** «Вы покупали этот товар · заявка №… от …» над формой; без заявки — пусто. */
  purchase?: { orderNumber?: string; at?: string };
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const reviews = useGetPortalItemReviews(itemId);
  const list = reviews.data?.status === 200 ? reviews.data.data : [];
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState(false);
  const mine = list.find((review) => review.mine);
  const section = useRef<HTMLElement>(null);
  const { hash } = useLocation();
  const loaded = !reviews.isPending;

  // Пришли по ссылке «Оценить товар» (`#reviews`): браузер сам к якорю не
  // прокрутит — блока ещё не было в разметке, — поэтому прокручиваем, когда
  // отзывы загружены и высота блока известна. Без анимации, если человек
  // просил уменьшить движение.
  useEffect(() => {
    if (hash !== '#reviews' || !loaded) return;
    section.current?.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, [hash, loaded, itemId]);

  // Сводка — по опубликованным: чужой отзыв на проверке сюда не приходит,
  // а свой неодобренный в оценку магазина ещё не входит.
  const published = list.filter((review) => review.status === 'PUBLISHED');
  const counts = [0, 0, 0, 0, 0, 0];
  published.forEach((review) => { counts[review.rating] += 1; });
  const average = published.length
    ? published.reduce((sum, review) => sum + review.rating, 0) / published.length
    : 0;

  const shown = list.filter((review) => filter === 'all'
    || (filter === 'low' ? review.rating <= 3 : String(review.rating) === filter));

  function replace(review: ItemReviewDto) {
    queryClient.setQueryData(
      getGetPortalItemReviewsQueryKey(itemId),
      (previous: { status: number; data: ItemReviewDto[] } | undefined) => {
        if (previous?.status !== 200) return previous;
        // Ответ сервера — уже весь отзыв: свой новый встаёт первым, изменённый
        // (оценка, «Полезно») — на своё место.
        const known = previous.data.some((one) => one.id === review.id);
        return {
          ...previous,
          data: known ? previous.data.map((one) => (one.id === review.id ? review : one)) : [review, ...previous.data],
        };
      },
    );
  }

  return (
    <section ref={section} id="reviews" aria-labelledby="h-reviews" className="flex scroll-mt-32 flex-col gap-5">
      <div className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:justify-between lg:gap-4">
        <h2 id="h-reviews" className="text-2xl font-extrabold tracking-[-0.02em] text-ink lg:text-[2rem] lg:font-black">{t('reviews.v2.title')}</h2>
        {/*
          Сотрудник магазина в своей витрине отзывов не пишет — сервер не даёт
          ему формы и отвечает отказом. Без пояснения пустое место под сводкой
          выглядело бы поломкой.
        */}
        <p className="text-sm text-ink-subtle">
          {currentViewer() === 'staff' ? t('reviews.staffNoReviews') : t('reviews.canReview')}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <div data-testid="reviews-summary" className="flex flex-col gap-[18px] rounded-[calc(var(--radius-card)*13/11)] bg-surface p-6 shadow-[0_0_0_1px_var(--color-hairline)]">
            <div className="flex items-center gap-[18px]">
              <span className="text-5xl font-black leading-none tabular-nums tracking-[-0.04em] text-ink lg:text-[4.25rem]">
                {published.length
                  ? average.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                  : '—'}
              </span>
              <span className="flex flex-col gap-1.5">
                {/* Без отзывов «Оценка 0 из 5» читалась бы плохой оценкой, а не её отсутствием. */}
                <Stars value={average} size="size-6" label={published.length ? undefined : t('reviews.v2.noRatings')} />
                <span className="text-sm text-ink-muted">
                  {published.length ? t('reviews.v2.fromBuyers', { count: published.length }) : t('reviews.v2.noRatings')}
                </span>
              </span>
            </div>
            <ul className="flex flex-col gap-2" aria-label={t('reviews.v2.distribution')}>
              {[5, 4, 3, 2, 1].map((stars) => (
                <li key={stars} className="flex items-center gap-2.5 text-caption text-ink-muted">
                  <span className="w-7 shrink-0 tabular-nums">{stars} ★</span>
                  <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-sunk">
                    <span
                      className="block h-full rounded-full bg-[#E0A04A]"
                      style={{ width: `${published.length ? Math.round((counts[stars] / published.length) * 100) : 0}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right tabular-nums">{counts[stars]}</span>
                </li>
              ))}
            </ul>
          </div>

          {/*
            Оценить может любой клиент магазина — сервер говорит «нельзя»
            только тому, кого клиентом не считает; объяснять ему нечего.
          */}
          {!canReview ? null : mine && !editing && mine.status === 'REJECTED' ? (
            /*
              Отклонённый — не «появится после проверки»: проверка прошла,
              и ждать нечего. Как в «Моих отзывах»: решение продавца, причина,
              если он её назвал, и правка — исправленный отзыв сервер снова
              отправит на проверку.
            */
            <div
              data-testid="my-review-rejected"
              className="flex items-start gap-3.5 rounded-[calc(var(--radius-card)*13/11)] bg-sale-soft p-[22px] shadow-[0_0_0_1px_var(--color-hairline)]"
            >
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-sale-ink">
                <AlertCircle className="size-5" strokeWidth={2.4} />
              </span>
              <span className="flex flex-col gap-1.5">
                <b className="text-lead text-ink">{t('reviews.v2.rejectedTitle')}</b>
                {mine.rejectReason && (
                  <span className="text-sm font-semibold text-ink">
                    {t('reviews.v2.rejectReason', { reason: t(`reviews.rejectReasons.${mine.rejectReason}`) })}
                  </span>
                )}
                <span className="text-sm leading-normal text-ink-muted">{t('reviews.editNote')}</span>
                <button type="button" onClick={() => setEditing(true)} className={cn(HELP, 'mt-1 self-start bg-surface')}>
                  {t('reviews.v2.editMine')}
                </button>
              </span>
            </div>
          ) : mine && !editing ? (
            <div className="flex items-start gap-3.5 rounded-[calc(var(--radius-card)*13/11)] bg-ok-soft p-[22px] shadow-[0_0_0_1px_var(--color-hairline)]">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                <Check className="size-5" strokeWidth={2.6} />
              </span>
              <span className="flex flex-col gap-1.5">
                <b className="text-lead text-ink">{t('reviews.v2.thanks')}</b>
                <span className="text-sm leading-normal text-ink-muted">
                  {mine.status === 'PUBLISHED' ? t('reviews.v2.thanksPublished') : t('reviews.v2.thanksPending')}
                </span>
                <button type="button" onClick={() => setEditing(true)} className={cn(HELP, 'mt-1 self-start')}>
                  {t('reviews.v2.editMine')}
                </button>
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-[calc(var(--radius-card)*13/11)] bg-accent-soft/60 p-6 shadow-[0_0_0_1px_var(--color-hairline)]">
              <div className="flex flex-col gap-1">
                {/* «Покупку» оценивает тот, у кого есть заявка; без неё — честно «товар». */}
                <b className="text-xl font-extrabold text-ink">
                  {purchase?.orderNumber ? t('reviews.v2.rateTitle') : t('reviews.v2.rateItemTitle')}
                </b>
                {purchase?.orderNumber && (
                  <span className="text-caption text-accent-ink">
                    {purchase.at
                      ? t('reviews.v2.purchased', { number: purchase.orderNumber, date: shortDate(purchase.at) })
                      : t('reviews.v2.purchasedNoDate', { number: purchase.orderNumber })}
                  </span>
                )}
              </div>
              <ReviewForm
                key={mine?.id ?? 'new'}
                plain
                itemId={itemId}
                sizeTags={sizeTags}
                initialRating={mine?.rating ?? 0}
                initialText={mine?.text ?? ''}
                initialTags={mine?.tags ?? []}
                initialPhotos={mine?.photos ?? []}
                submitLabel={t('reviews.v2.send')}
                // Правка своего отзыва возвращает его на проверку на сервере.
                note={mine ? t('reviews.editNote') : undefined}
                onCancel={mine ? () => setEditing(false) : undefined}
                onSaved={(review) => {
                  replace(review);
                  setEditing(false);
                  // Свежий отзыв мог не попасть в выбранный отбор — «куда делся мой?».
                  setFilter('all');
                }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {list.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="group" aria-label={t('reviews.v2.filter')} className="flex flex-wrap gap-2">
                {([
                  ['all', t('reviews.v2.all', { count: list.length })],
                  ['5', `5 ★ · ${list.filter((r) => r.rating === 5).length}`],
                  ['4', `4 ★ · ${list.filter((r) => r.rating === 4).length}`],
                  ['low', `1–3 ★ · ${list.filter((r) => r.rating <= 3).length}`],
                ] as [Filter, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'h-[38px] rounded-[var(--radius-pill)] border px-3.5 text-sm font-semibold',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      filter === key ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-muted hover:border-ink/50',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-sm text-ink-muted">{t('reviews.v2.newestFirst')}</span>
            </div>
          )}

          {list.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 rounded-[var(--radius-card)] border border-dashed border-line px-5 py-12 text-center lg:py-[70px]">
              <span aria-hidden="true" className="flex size-[76px] items-center justify-center rounded-full bg-sunk text-[#E0A04A]">
                <Star filled={false} className="size-9" />
              </span>
              <b className="text-[1.1875rem] text-ink">{t('reviews.v2.emptyTitle')}</b>
              <p className="max-w-[340px] text-body leading-normal text-ink-muted">{t('reviews.v2.emptyText')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {shown.map((review) => (
                <li key={review.id}>
                  <ReviewRow review={review} onChanged={replace} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** Небольшая кнопка с рамкой: «Изменить отзыв», «Полезно». */
const HELP = cn(
  'inline-flex h-[34px] items-center gap-1.5 rounded-[calc(var(--radius-control)*5/7)] border border-line px-3 text-caption font-semibold text-ink-muted',
  'hover:border-ink/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  // Недоступная (своя отметка сотрудника, запрос в пути) — видно по кнопке.
  'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink-muted',
);

/** Подложки кружков авторов: у одного имени всегда одна. */
const AVATAR_TINTS = ['bg-accent-soft text-accent-ink', 'bg-sale-soft text-sale-ink', 'bg-sage-soft text-ok-ink', 'bg-brand-soft text-ink', 'bg-sunk text-ink-muted'];

function tintOf(name: string | undefined): string {
  const code = [...(name ?? '')].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  return AVATAR_TINTS[code % AVATAR_TINTS.length];
}

/** Инициалы для кружка автора: «Асхат К.» → «АК». */
function initials(name: string | undefined): string {
  const letters = (name ?? '').match(/\p{L}+/gu) ?? [];
  return (letters.slice(0, 2).map((word) => word[0]).join('') || '•').toUpperCase();
}

function ReviewRow({ review, onChanged }: { review: ItemReviewDto; onChanged: (review: ItemReviewDto) => void }) {
  const { t } = useTranslation();
  const helpful = useTogglePortalReviewHelpful({
    mutation: { onSuccess: (response) => { if (response.status === 200) onChanged(response.data); } },
  });
  const date = dayMonth(review.createdAt);
  const shop = useCurrentShop();

  return (
    <article data-testid="review" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[0_0_0_1px_var(--color-hairline)] lg:p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-sm font-extrabold',
            review.mine ? 'bg-accent text-on-accent' : tintOf(review.authorName),
          )}
        >
          {initials(review.authorName)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="text-base text-ink">{review.authorName ?? t('reviews.client')}</b>
            {/*
              «Покупал в магазине» — только у автора с заявкой на этот товар:
              отзыв может оставить и купивший вне системы, и метка отличает
              подтверждённую покупку от слов.
            */}
            {(review.mine || review.verifiedPurchase) && (
              <span
                className={cn(
                  'flex h-[22px] items-center rounded-[var(--radius-pill)] px-2 text-xs font-bold',
                  review.mine ? 'bg-accent text-on-accent' : 'bg-ok-soft text-ok-ink',
                )}
              >
                {review.mine ? t('reviews.v2.mine') : t('reviews.v2.bought')}
              </span>
            )}
            {review.status === 'PENDING' && (
              <span className="flex h-[22px] items-center rounded-[var(--radius-pill)] bg-sunk px-2 text-xs font-semibold text-unclear-ink">
                {t('reviews.pending')}
              </span>
            )}
            {/* Отклонённый видит только автор — и должен понять, что другим он не показан. */}
            {review.status === 'REJECTED' && (
              <span className="flex h-[22px] items-center rounded-[var(--radius-pill)] bg-sale-soft px-2 text-xs font-semibold text-sale-ink">
                {t('reviews.v2.notPublished')}
              </span>
            )}
          </div>
          {/*
            Размер — после даты, как в макете: у вариантов модели одно
            название, и «размер M» говорит читающему, о каком из них отзыв.
          */}
          <span className="text-caption text-ink-subtle">
            {review.size ? t('reviews.v2.dateWithSize', { date, size: review.size }) : date}
          </span>
        </div>
        <Stars value={review.rating} />
      </div>

      {/* Метки могут не прийти от сервера старше этого экрана — тогда их просто нет. */}
      {(review.tags ?? []).length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('reviews.tagsLabel')}>
          {(review.tags ?? []).map((tag) => (
            <li key={tag} className="flex h-7 items-center rounded-[var(--radius-pill)] bg-sunk px-3 text-caption font-semibold text-ink-muted">
              {t(`reviews.tags.${tag}`)}
            </li>
          ))}
        </ul>
      )}

      {review.text && <p className="text-body leading-relaxed text-ink lg:text-base">{review.text}</p>}

      {/* Фото могут не прийти от сервера старше этого экрана — тогда их просто нет. */}
      <ReviewPhotoStrip photos={review.photos ?? []} author={review.authorName} />

      {review.reply && (
        <div className="flex gap-3 rounded-[var(--radius-tile)] bg-sunk px-4 py-3.5">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*5/7)] bg-sale-soft text-2xs font-extrabold text-sale-ink">
            {initials(shop?.name)}
          </span>
          <div className="flex flex-col gap-1">
            <b className="text-caption text-sale-ink">{t('reviews.v2.shopReply')}</b>
            <p className="text-sm leading-relaxed text-ink-muted">{review.reply}</p>
          </div>
        </div>
      )}

      {!review.mine && review.status === 'PUBLISHED' && (
        <button
          type="button"
          aria-pressed={review.helpfulByMe}
          // Отметку магазина под отзывом о своём товаре сервер не примет:
          // сотруднику число видно, а кнопка не нажимается.
          disabled={helpful.isPending || currentViewer() === 'staff'}
          onClick={() => helpful.mutate({ reviewId: review.id })}
          className={cn(
            HELP, 'self-start',
            review.helpfulByMe && 'border-accent/50 bg-accent-soft text-accent-ink',
          )}
        >
          <ThumbsUp aria-hidden="true" className="size-[15px]" />
          {t('reviews.v2.helpful', { count: review.helpful })}
        </button>
      )}
    </article>
  );
}

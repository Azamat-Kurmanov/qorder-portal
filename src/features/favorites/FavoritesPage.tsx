import { useOrderMode } from '../cart/orderMode';
import { BackTitle } from '../../ui/BackTitle';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalCartQueryKey,
  getGetPortalFavoritesQueryKey,
  useAddPortalFavoritesToCart,
  useGetPortalFavorites,
  useTogglePortalFavorite,
  type FavoriteItemDto,
  type SkippedLineDto,
} from '../../api/generated';
import { CartBar } from '../cart/CartBar';
import { QuantityField } from '../cart/QuantityField';
import { LinkedLineThumb } from '../cart/LineThumb';
import { FavoriteButton } from './FavoriteButton';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Reveal } from '../../ui/Reveal';
import { cn } from '../../ui/cn';
import { Plus } from '../../ui/icons';

/**
 * Избранное: «понравилось, вернусь посмотреть».
 *
 * Не корзина и не заказ: отмеченное ни к чему не обязывает, и именно поэтому
 * им пользуются. Отсюда же собирают повторную закупку — одним нажатием, — но
 * по своей воле, а не потому, что отметка что-то значила.
 *
 * Снятая с продажи позиция остаётся в списке погашенной: исчезни она молча,
 * клиент решил бы, что сам её не отмечал, и стал бы искать заново.
 *
 * Список — одна поверхность с волосяными линиями, а не стопка карточек:
 * отложенное просматривают сверху вниз одним движением, и зазоры между
 * карточками растянули бы четыре позиции на два экрана.
 */
export function FavoritesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const favorites = useGetPortalFavorites();
  const items = favorites.data?.status === 200 ? favorites.data.data : [];
  const [skipped, setSkipped] = useState<SkippedLineDto[]>([]);

  // Товар «оптом и в розницу» ложится в заявку, в которой клиент сейчас (решение владельца 2026-11-06).
  const [orderMode] = useOrderMode();
  const toCart = useAddPortalFavoritesToCart({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        queryClient.setQueryData(getGetPortalCartQueryKey(), response);
        // Пропущенное называется поимённо и остаётся на экране: «добавлено
        // не всё» без списка заставляет пересчитывать корзину руками.
        setSkipped(response.data.skipped);
      },
    },
  });

  // Отдельной операции «снять всё» у сервера нет, поэтому список снимается
  // по одной позиции — по очереди, а не залпом: десяток одновременных запросов
  // с телефона на складской сети доходит не весь, и часть отметок осталась бы
  // висеть. Список перечитывается один раз в конце, а не после каждого ответа:
  // иначе он дёргался бы под пальцем на каждой снятой строке.
  const toggle = useTogglePortalFavorite();
  const clearAll = async () => {
    for (const item of items) {
      await toggle.mutateAsync({ itemId: item.itemId });
    }
    await queryClient.invalidateQueries({ queryKey: getGetPortalFavoritesQueryKey() });
  };

  const available = items.filter((item) => item.available);

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/*
        «Вариант Б» (SimplePicFavorites): «Назад», «Избранное · 4» и «отложено вами» — список личный,
        продавцу он ничего не сообщил.
      */}
      <BackTitle
        title={items.length > 0 ? `${t('favorites.title')} · ${items.length}` : t('favorites.title')}
        subtitle={items.length > 0 ? t('favorites.setAside') : undefined}
      />

      {skipped.length > 0 && (
        <Card data-testid="skipped-notice" className="flex flex-col gap-1 p-4">
          <p className="text-sm font-medium text-ink">{t('favorites.notAll')}</p>
          <p className="text-sm text-ink-muted">
            {t('favorites.cannotOrder', { names: skipped.map((line) => line.name).join(', ') })}
          </p>
        </Card>
      )}

      {favorites.isPending ? (
        <Card className="divide-y divide-hairline overflow-hidden p-0">
          {[0, 1, 2].map((row) => (
            <div key={row} data-testid="favorite-skeleton" className="h-[84px] animate-pulse bg-sunk" />
          ))}
        </Card>
      ) : items.length === 0 ? (
        <p className="text-body leading-relaxed text-ink-subtle">
          {t('favorites.empty')}
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0 lg:grid-cols-2">
          {items.map((item, index) => (
            <li key={item.itemId} className="rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface">
              <Reveal delay={Math.min(index, 3) * 0.04}>
                <FavoriteRow item={item} />
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <button
          type="button"
          aria-label={t('favorites.clearAria')}
          disabled={toggle.isPending}
          onClick={() => {
            // Отказ сети посреди очереди оставляет часть отметок снятыми —
            // это видно по списку, и повторное нажатие доснимет остальные.
            void clearAll().catch(() => {});
          }}
          className="self-center cursor-pointer bg-transparent py-2 text-base font-bold text-sale-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          {t('favorites.clearAria')}
        </button>
      )}

      {available.length > 0 && (
        // Главное действие — внизу крупной кнопкой, как в макете. «Доступное», а не «всё»: снятое
        // с витрины в заявку не уедет, и обещать обратное значило бы удивить списком пропущенного.
        <div className="flex flex-col gap-2 lg:items-start">
          <Button size="lg" className="h-16 w-full rounded-[1.375rem] text-lead font-extrabold lg:w-auto lg:px-10"
            disabled={toCart.isPending} onClick={() => toCart.mutate({ params: { mode: orderMode } })}>
            <Plus aria-hidden="true" className="size-6" />
            {t('favorites.addAvailable')}
          </Button>
          <p className="m-0 text-center text-body text-ink-muted">{t('favorites.byMode')}</p>
        </div>
      )}

      <CartBar />
    </div>
  );
}

function FavoriteRow({ item }: { item: FavoriteItemDto }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  return (
    <div data-testid="favorite-row" className={cn('flex gap-3 p-3', !item.available && 'opacity-70')}>
      {/*
        Снимок — тот же путь к карточке, что и название, поэтому без своей
        подписи. У снятой с продажи позиции карточки нет, и снимок остаётся
        просто картинкой, погашенной вместе со строкой.
      */}
      <LinkedLineThumb
        itemId={item.itemId}
        seed={item.itemId}
        src={item.imageUrl}
        linked={item.available}
        className="size-20"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        {item.available ? (
          <Link
            to={`/catalog/${item.itemId}`}
            className="text-lead font-extrabold leading-tight text-ink transition-all duration-300 hover:text-accent"
          >
            {item.name}
          </Link>
        ) : (
          <p className="text-body font-medium text-ink">{item.name}</p>
        )}

        {item.available && item.price != null ? (
          // Цена уже со скидкой распродажи — та же, что на витрине; рядом
          // зачёркнутая старая и «−N%», а сама цена цветом скидки, как на плитке.
          <p className="flex flex-wrap items-baseline gap-x-2 text-body tabular-nums">
            <span className={cn('font-semibold', item.oldPrice !== undefined ? 'text-sale' : 'text-ink')}>
              {money(item.price, currency)}
            </span>
            {item.oldPrice !== undefined ? (
              <span className="flex items-center gap-1.5 text-caption">
                <s className="text-ink-faint">{money(item.oldPrice, currency)}</s>
                {item.discountPercent ? <span className="font-bold text-sale-ink">−{item.discountPercent}%</span> : null}
              </span>
            ) : null}
            {item.unit ? <span className="text-caption text-ink-subtle">· {item.unit}</span> : null}
          </p>
        ) : (
          // Не «недоступна», а кто и что сделал: клиенту нужно понять, что ждать
          // возвращения бессмысленно и пора искать замену.
          <p className="text-caption text-gone">{t('favorites.gone')}</p>
        )}
        {/* Количество — под ценой, а не сбоку: сбоку оно сжимало имя в столбик в два слова. */}
        {item.available && item.unit && <QuantityField itemId={item.itemId} unit={item.unit} className="mt-1 w-full max-w-[14rem]" />}
      </div>

      {/*
        Сердечко — отдельно от количества: снять отметку и набрать количество —
        разные намерения, и соседние цели на телефоне промахиваются одна в другую.
      */}
      <FavoriteButton itemId={item.itemId} favorite className="shrink-0" />
    </div>
  );
}


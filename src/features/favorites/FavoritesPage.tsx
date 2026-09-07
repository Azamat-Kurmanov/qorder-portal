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
import { FavoriteButton } from './FavoriteButton';
import { tenge } from '../../shared/format';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Reveal } from '../../ui/Reveal';
import { cn } from '../../ui/cn';

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
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">{t('favorites.title')}</h1>
          {items.length > 0 && (
            // «Отложено вами» — про то, что список личный: он ничего не сообщил
            // продавцу и ни к чему не обязывает.
            <p className="text-[13px] text-ink-subtle">
              {items.length} {t('common.positions', { count: items.length })}
              {' · '}
              {t('favorites.setAside')}
            </p>
          )}
        </div>

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
            className={cn(
              '-mr-2 inline-flex h-11 shrink-0 items-center rounded-[var(--radius-control)] px-2',
              'text-[13px] text-ink-subtle transition-all duration-300',
              'hover:bg-ink/5 hover:text-ink active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {t('favorites.clear')}
          </button>
        )}
      </header>

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
        <p className="text-[15px] leading-relaxed text-ink-subtle">
          {t('favorites.empty')}
        </p>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-hairline">
            {items.map((item, index) => (
              <li key={item.itemId}>
                <Reveal delay={Math.min(index, 3) * 0.04}>
                  <FavoriteRow item={item} />
                </Reveal>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {available.length > 0 && (
        // «Доступное», а не «всё»: снятое с витрины в заявку не уедет, и обещать
        // обратное значило бы удивить клиента списком пропущенного.
        <Button
          size="lg"
          className="w-full"
          disabled={toCart.isPending}
          onClick={() => toCart.mutate()}
        >
          {t('favorites.addAvailable')}
        </Button>
      )}

      <CartBar />
    </div>
  );
}

function FavoriteRow({ item }: { item: FavoriteItemDto }) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex gap-3 px-4 py-3.5', !item.available && 'opacity-60')}>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        {item.available ? (
          <Link
            to={`/catalog/${item.itemId}`}
            className="text-[15px] font-medium text-ink transition-all duration-300 hover:text-accent"
          >
            {item.name}
          </Link>
        ) : (
          <p className="text-[15px] font-medium text-ink">{item.name}</p>
        )}

        {item.available && item.price != null ? (
          <p className="text-[15px] font-semibold tabular-nums text-ink">
            {tenge(item.price)}
            {item.unit ? <span className="font-normal text-ink-subtle"> · {item.unit}</span> : null}
          </p>
        ) : (
          // Не «недоступна», а кто и что сделал: клиенту нужно понять, что ждать
          // возвращения бессмысленно и пора искать замену.
          <p className="text-[12px] text-gone">{t('favorites.gone')}</p>
        )}
      </div>

      {/*
        Сердечко над количеством, а не рядом: снять отметку и набрать количество —
        разные намерения, и соседние цели в один ряд на телефоне промахиваются
        одна в другую.
      */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <FavoriteButton itemId={item.itemId} favorite />
        {item.available && item.unit && <QuantityField itemId={item.itemId} unit={item.unit} />}
      </div>
    </div>
  );
}


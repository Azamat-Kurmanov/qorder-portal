import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getGetPortalCatalogItemQueryKey,
  getGetPortalCatalogQueryKey,
  getGetPortalFavoritesQueryKey,
  useTogglePortalFavorite,
  type ShowcaseItemDto,
} from '../../api/generated';
import { Bump } from '../../ui/Bump';
import { cn } from '../../ui/cn';

/**
 * Отметка «нравится».
 *
 * Личная и ни к чему не обязывающая: избранное — это «вернусь посмотреть»,
 * а не заказ. Поэтому нажатие ничего не кладёт в корзину и ничего не сообщает
 * продавцу — иначе клиент перестал бы отмечать.
 *
 * Состояние приходит с сервера ответом на нажатие, а не додумывается экраном:
 * с двух устройств отмечают одну и ту же позицию, и «переверни у себя»
 * разошлось бы с тем, что лежит в базе.
 */
export function FavoriteButton({
  itemId,
  favorite,
  className,
}: {
  itemId: string;
  favorite: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const toggle = useTogglePortalFavorite({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        // Карточка правится точечно, а список избранного помечается устаревшим:
        // в карточке меняется один флаг, а в списке появляется или исчезает
        // целая строка, и собрать её из ответа значило бы повторить сервер.
        queryClient.setQueryData(
          getGetPortalCatalogItemQueryKey(itemId),
          (previous: { status: number; data: Record<string, unknown> } | undefined) =>
            previous?.status === 200
              ? { ...previous, data: { ...previous.data, favorite: response.data.favorite } }
              : previous,
        );

        // Витрина правится там же, где лежит: перезапрос ради одного флага
        // стоил бы полусотни строк на мобильной сети — и мигания списка
        // под пальцем. Ключей у витрины много (поиск, рубрика, страница),
        // поэтому правятся все загруженные разом.
        queryClient.setQueriesData(
          { queryKey: getGetPortalCatalogQueryKey() },
          (previous: { status: number; data: { items?: ShowcaseItemDto[] } } | undefined) => {
            if (previous?.status !== 200 || !previous.data.items) return previous;
            return {
              ...previous,
              data: {
                ...previous.data,
                items: previous.data.items.map((item) =>
                  item.id === itemId ? { ...item, favorite: response.data.favorite } : item),
              },
            };
          },
        );

        void queryClient.invalidateQueries({ queryKey: getGetPortalFavoritesQueryKey() });
      },
    },
  });

  return (
    <button
      type="button"
      aria-label={favorite ? t('favorites.remove') : t('favorites.add')}
      aria-pressed={favorite}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ itemId })}
      className={cn(
        // Сорок четыре точки цели остаются, а рамки вокруг нет: отметка стоит
        // в строке рядом с названием, и обведённая кнопка спорила бы там
        // за внимание с ценой и количеством — тем, ради чего строку читают.
        'inline-flex size-11 items-center justify-center rounded-[var(--radius-control)]',
        'transition-all duration-300 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        favorite ? 'text-accent' : 'text-ink-faint hover:text-ink',
        className,
      )}
    >
      {/*
        Сердечко отвечает упругим толчком на смену состояния.

        Состояние приходит с СЕРВЕРА, а не переворачивается на месте, — и
        между нажатием и ответом проходит доля секунды, за которую не меняется
        ничего. Толчок в момент ответа говорит, что отметка дошла; без него
        на мобильной сети нажатие выглядит не сработавшим, и по сердечку
        стучат второй раз, снимая только что поставленную отметку.
      */}
      <Bump value={favorite}>
        {/*
          Отметка держится на заливке, а не на цвете: цвет здесь означал бы
          состояние товара, как везде в системе, а речь о выборе человека.
        */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill={favorite ? 'currentColor' : 'none'}
          stroke={favorite ? 'none' : 'currentColor'}
          strokeWidth="1.6"
          strokeLinejoin="round"
        >
          <path d="M12 20.5s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 8.4a4.4 4.4 0 0 1 7.5 2.5c0 5-7.5 9.6-7.5 9.6Z" />
        </svg>
      </Bump>
    </button>
  );
}

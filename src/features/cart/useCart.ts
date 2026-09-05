import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalCartQueryKey,
  useGetPortalCart,
  useSetPortalCartLine,
  type CartDto,
} from '../../api/generated';


/**
 * Корзина одна на весь кабинет.
 *
 * Каждый ответ сервера — это уже пересчитанная корзина целиком, поэтому она
 * кладётся в кеш как есть, а не запрашивается заново. Второй запрос показал бы
 * то же самое и стоил бы клиенту ожидания на каждое нажатие «плюс».
 */
export function useCart() {
  return useGetPortalCart();
}

/**
 * Корзина из ответа — или её отсутствие.
 *
 * Генерация объявляет ответ объединением тела успеха и тел ошибок, и сузить
 * его можно только по статусу. Делается это в одном месте: разбирай объединение
 * каждый экран сам — и один из них однажды покажет тело ошибки как корзину.
 */
export function cartOf(response?: { status: number; data: unknown }): CartDto | undefined {
  return response?.status === 200 ? (response.data as CartDto) : undefined;
}

/**
 * Изменение количества позиции.
 *
 * Ноль убирает строку — отдельного удаления нет: две операции с одним смыслом
 * однажды разойдутся, и одна перестанет пересчитывать итог.
 */
export function useSetCartLine() {
  const queryClient = useQueryClient();

  return useSetPortalCartLine({
    mutation: {
      onSuccess: (response) => {
        // Ответ на изменение — это уже пересчитанная корзина: она кладётся
        // в кеш целиком, вместе со статусом. Класть одно тело нельзя: экраны
        // сужают объединение типов по статусу, и корзина без него для них
        // неотличима от ошибки.
        //
        // Отказ (400, 404) корзиной не является и кеш не трогает — иначе
        // на экране вместо состава оказалось бы тело ошибки.
        if (response.status !== 200) return;
        queryClient.setQueryData(getGetPortalCartQueryKey(), response);
      },
    },
  });
}

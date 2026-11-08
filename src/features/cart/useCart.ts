import { useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { announceFailed } from './cartDrawer';
import { reportShareCart } from '../joinShop/shareVisit';
import {
  getGetPortalCartQueryKey,
  useClearPortalCart,
  useGetPortalCart,
  usePutPortalCartWholesaleMinimum,
  useSetPortalCartLine,
  type CartDto,
} from '../../api/generated';


/**
 * Корзина одна на весь кабинет.
 *
 * Каждый ответ сервера — это уже пересчитанная корзина целиком, поэтому она
 * кладётся в кеш как есть, а не запрашивается заново. Второй запрос показал бы
 * то же самое и стоил бы клиенту ожидания на каждое нажатие «плюс».
 *
 * `active` выключает запрос там, где корзины у клиента нет вовсе: в кабинете,
 * который поставщик ещё не открыл, она вернула бы отказ. Экраны кабинета
 * стоят за выбором поставщика и спрашивают её без оговорок — оговорка нужна
 * оболочке, которая рисуется раньше, чем список поставщиков дошёл.
 */
export function useCart(active = true) {
  return useGetPortalCart({ query: { enabled: active } });
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
 * Сообщить, что корзина не изменилась: текст сервера, если он есть, —
 * он уже переведён и называет причину («нет в наличии», «минимум 5 шт.»).
 */
function reportFailure(error: unknown) {
  // 401 — не отказ корзины: кабинет уже уводит на повторный вход.
  if ((error as { status?: number } | null)?.status === 401) return;
  const detail = (error as { info?: { detail?: unknown } } | null)?.info?.detail;
  announceFailed(typeof detail === 'string' && detail ? detail : i18n.t('cart.failed'));
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
      onSuccess: (response, variables) => {
        // Ответ на изменение — это уже пересчитанная корзина: она кладётся
        // в кеш целиком, вместе со статусом. Класть одно тело нельзя: экраны
        // сужают объединение типов по статусу, и корзина без него для них
        // неотличима от ошибки.
        //
        // Отказ (400, 404) корзиной не является и кеш не трогает — иначе
        // на экране вместо состава оказалось бы тело ошибки.
        if (response.status !== 200) return;
        queryClient.setQueryData(getGetPortalCartQueryKey(), response);
        if (variables.data.quantity > 0) reportShareCart();
      },
      onError: reportFailure,
    },
  });
}

/**
 * «Оптом»: минимум опта поровну по размерам этого цвета (10 на три — 4 + 3 + 3),
 * строки в режиме «Оптом». Ответ — пересчитанная корзина, как у изменения строки.
 */
export function useWholesaleMinimum() {
  const queryClient = useQueryClient();

  return usePutPortalCartWholesaleMinimum({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        queryClient.setQueryData(getGetPortalCartQueryKey(), response);
      },
      onError: reportFailure,
    },
  });
}

/**
 * Очистить корзину целиком.
 *
 * Ответ — уже пустая корзина: она кладётся в кеш так же, как ответ на
 * изменение строки, без второго запроса.
 */
export function useClearCart() {
  const queryClient = useQueryClient();

  return useClearPortalCart({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        queryClient.setQueryData(getGetPortalCartQueryKey(), response);
      },
      onError: reportFailure,
    },
  });
}

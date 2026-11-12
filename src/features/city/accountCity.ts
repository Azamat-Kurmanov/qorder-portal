import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalBranchQueryKey, getGetPortalCityQueryKey, useGetPortalCity, useSetPortalCity,
  type PortalCityDto, type SetPortalCityRequest,
} from '../../api/generated';
import { useAuth } from '../../auth/useAuth';
import { refetchStockViews } from '../../supplier/pickupPoint';

/**
 * Город человека в учётной записи — один на всех его поставщиков.
 *
 * Только после входа, как и язык (`useAccountLanguage`): без входа учётной записи нет.
 *
 * @returns `city` — `undefined`, пока учётная запись не ответила; `null` — нет входа или запрос не удался;
 *          `save` — записать выбор; `true`, если записался (кеш тогда перечитан)
 */
export function useAccountCity(): { city: PortalCityDto | null | undefined; save: (request: SetPortalCityRequest) => Promise<boolean> } {
  const { authenticated } = useAuth();
  const queryClient = useQueryClient();
  const query = useGetPortalCity({ query: { enabled: authenticated, staleTime: Infinity, retry: false } });
  const mutation = useSetPortalCity();
  const city = !authenticated ? null
    : query.isPending ? undefined
      : query.data?.status === 200 ? query.data.data : null;
  return {
    city,
    save: async (request) => {
      try {
        const response = await mutation.mutateAsync({ data: request });
        if (response.status !== 204) return false;
        await queryClient.invalidateQueries({ queryKey: getGetPortalCityQueryKey() });
        // Новый город — может быть, другой филиал: и наличие на витрине и в корзине — другое.
        void queryClient.invalidateQueries({ queryKey: getGetPortalBranchQueryKey() });
        refetchStockViews(queryClient);
        return true;
      } catch {
        return false;
      }
    },
  };
}

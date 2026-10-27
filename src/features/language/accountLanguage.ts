import { useQueryClient } from '@tanstack/react-query';
import { getGetPortalLanguageQueryKey, useGetPortalLanguage, useSetPortalLanguage } from '../../api/generated';
import { useAuth } from '../../auth/useAuth';
import type { Language } from '../../i18n';

/**
 * Язык в учётной записи: выбранный однажды, он приходит на новое устройство.
 *
 * Только после входа: на страницах приглашения и ссылки магазина учётной записи
 * ещё нет, и запрос к ней отправил бы человека на вход посреди заявки.
 *
 * @returns `serverLanguage` — `undefined`, пока учётная запись не ответила; `null` — языка в ней нет
 *          (не выбирал, нет входа или запрос не удался); `save` — записать выбор, без входа ничего не делает
 */
export function useAccountLanguage(): { serverLanguage: Language | null | undefined; save: (language: Language) => void } {
  const { authenticated } = useAuth();
  const queryClient = useQueryClient();
  const query = useGetPortalLanguage({ query: { enabled: authenticated, staleTime: Infinity, retry: false } });
  const mutation = useSetPortalLanguage();
  const serverLanguage = !authenticated ? null
    : query.isPending ? undefined
      : query.data?.status === 200 ? (query.data.data.language ?? null) : null;
  return {
    serverLanguage,
    save: (language) => {
      if (!authenticated) return;
      // Сразу в кеш: смена языка сбрасывает кеш, и перечитанный до записи старый язык
      // вернул бы прежний выбор. Зовётся после сброса кеша, а не до.
      queryClient.setQueryData(getGetPortalLanguageQueryKey(), { status: 200, data: { language }, headers: new Headers() });
      // Не записалось — не беда: язык этого браузера уже сменён, учётная запись догонит при следующем выборе.
      mutation.mutate({ data: { language } });
    },
  };
}

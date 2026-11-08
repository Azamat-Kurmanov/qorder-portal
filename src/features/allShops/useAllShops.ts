import { useGetPortalOverview } from '../../api/generated';
import { buildOverview, type Overview } from './overviewModel';

/** Сводка по всем магазинам, разложенная на дела и сообщения; пока не пришла — undefined. */
export function useAllShops(): Overview | undefined {
  const query = useGetPortalOverview();
  if (query.data?.status !== 200) return undefined;
  return buildOverview(query.data.data, localToday());
}

export function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}


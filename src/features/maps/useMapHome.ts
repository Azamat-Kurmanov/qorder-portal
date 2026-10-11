import { useGetPortalDeliveryOptions } from '../../api/generated';
import type { MapPoint } from './mapProvider';

/**
 * С чего открывать карту, когда точки ещё нет: отмеченная точка самовывоза
 * поставщика — он работает в том городе, а с ним и его покупатели. Нет такой —
 * `null`, и карта открывается на запасном центре (`DEFAULT_CENTER`).
 *
 * Тот же запрос, что у экрана оформления: ответ уже в кеше, лишнего нет.
 */
export function useMapHome(): MapPoint | null {
  const options = useGetPortalDeliveryOptions();
  const located = options.data?.status === 200
    ? options.data.data.pickupPoints.find((point) => point.latitude != null && point.longitude != null)
    : undefined;
  return located ? { latitude: Number(located.latitude), longitude: Number(located.longitude) } : null;
}

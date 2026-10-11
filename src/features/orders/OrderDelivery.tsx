import { useTranslation } from 'react-i18next';
import type { PortalOrderDelivery } from '../../api/generated';
import { MapViewButton } from '../maps/MapViewButton';
import { pointOf } from '../maps/mapProvider';

/**
 * Доставка заявки для клиента: способ и адрес — всегда; перевозчик с телефоном,
 * кому платить за перевозку и номер отправления со ссылкой — когда везёт перевозчик.
 */
export function OrderDelivery({ delivery }: { delivery: PortalOrderDelivery }) {
  const { t } = useTranslation();
  const where = [delivery.city, delivery.address].filter(Boolean).join(', ');

  return (
    <div data-testid="order-delivery-block" className="flex flex-col gap-1 text-sm text-ink">
      <span className="text-xs font-semibold uppercase tracking-[.06em] text-ink-subtle">{t('orders.delivery.title')}</span>
      <span>{[delivery.methodName, where].filter(Boolean).join(' · ')}</span>
      {where ? (
        <MapViewButton title={delivery.methodName ?? t('orders.delivery.title')} address={where}
          point={pointOf(delivery.latitude, delivery.longitude)} className="my-1" />
      ) : null}
      {delivery.deliverTo === 'TERMINAL' ? <span className="text-ink-muted">{t('orders.delivery.terminal')}</span> : null}
      {delivery.carrierName ? (
        <span>
          {t('orders.delivery.carrier', { name: delivery.carrierName })}
          {delivery.carrierPhone ? (
            <>
              {' · '}
              <a href={`tel:${delivery.carrierPhone.replace(/[^\d+]/g, '')}`} className="font-semibold text-accent-ink hover:underline">
                {delivery.carrierPhone}
              </a>
            </>
          ) : null}
        </span>
      ) : null}
      {delivery.transportPayee === 'DIRECT' ? <span className="text-ink-muted">{t('orders.delivery.direct')}</span> : null}
      {delivery.trackingNumber ? (
        <span data-testid="order-tracking">
          {t('orders.delivery.tracking')}{' '}
          {delivery.trackingUrl ? (
            <a href={delivery.trackingUrl} target="_blank" rel="noopener noreferrer"
              className="font-semibold text-accent-ink hover:underline">{delivery.trackingNumber}</a>
          ) : <b>{delivery.trackingNumber}</b>}
        </span>
      ) : null}
    </div>
  );
}

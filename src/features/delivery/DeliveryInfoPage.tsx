import { BackTitle } from '../../ui/BackTitle';
import { Box, Check, MapPin, Package, Truck } from '../../ui/icons';
import { cn } from '../../ui/cn';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Method, PickupPoint } from '../../api/generated';
import { MapViewButton } from '../maps/MapViewButton';
import { pointOf } from '../maps/mapProvider';
import { slotLabel, useDeliveryOptions } from '../cart/DeliveryBlock';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import type { Currency } from '../../shared/currency';
import { loadersTerms } from '../cart/loaders';

/**
 * Условия доставки поставщика — отдельным разделом, а не сноской в оформлении.
 *
 * Клиент спрашивает об этом до того, как собрал корзину: возит ли поставщик
 * вообще, сколько стоит, откуда забирать, если не возит. Ответ, доступный
 * только на последнем шаге оформления, приходится искать — и его спрашивают
 * у менеджера голосом.
 *
 * Тот же ответ сервера, что и у блока выбора при оформлении: два описания
 * условий разошлись бы на первой же правке тарифа, и клиент увидел бы одну
 * цену в разделе и другую в заявке.
 *
 * Цена стоит справа от способа, а условия — строкой ниже: способы сравнивают
 * по цене, и глаз идёт по правому краю сверху вниз. Уйди цена в общий текст
 * условий — сравнение превратилось бы в чтение трёх абзацев.
 */
export function DeliveryInfoPage() {
  const { t } = useTranslation();
  const delivery = useDeliveryOptions();

  if (!delivery) {
    return (
      <div
        data-testid="delivery-skeleton"
        className="h-40 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk"
      />
    );
  }

  const pickupOnly = delivery.mode === 'PICKUP_ONLY';

  return (
    <div className="flex flex-col gap-3 pb-20">
      {/*
        «Условия продавца» — про то, чьё это обещание: тарифы задаёт он
        и меняет когда захочет. Даты, на которую условия верны, в ответе
        сервера нет, и выдумывать её нельзя: она читалась бы как гарантия.
      */}
      <BackTitle title={t('delivery.title')} subtitle={t('delivery.terms')} />

      {/*
        Возит или не возит — первое, что человек ищет на этом экране: от ответа
        зависит, заказывать ли машину. Поэтому он вынесен в полосу над
        условиями, а не спрятан в текст под ними.
      */}
      <p className={cn('m-0 flex items-center gap-2.5 rounded-[1.125rem] px-3.5 py-3 text-lead font-extrabold',
        pickupOnly ? 'bg-sunk text-ink' : 'bg-ok-soft text-ok-ink')}>
        {pickupOnly
          ? <Package className="size-5 shrink-0" aria-hidden="true" />
          : <Check className="size-5 shrink-0" aria-hidden="true" />}
        {pickupOnly ? t('delivery.pickupOnly') : t('delivery.delivers')}
      </p>

      {/* «Вариант Б» (SimplePicDeliveryInfo): каждый способ — своей карточкой, условия — списком. */}
      {delivery.methods.length > 0 && (
        <section aria-label={t('delivery.methods')} className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-4">
          {delivery.methods.map((method) => <MethodCard key={method.id} method={method} />)}
        </section>
      )}

      {delivery.pickupPoints.length > 0 && (
        <section aria-label={t('delivery.pickup')} className={BOX}>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className={ICON}><MapPin className="size-6" /></span>
            <h2 className="m-0 text-lead font-extrabold text-ink">{t('delivery.pickup')}</h2>
          </div>
          <ul className="m-0 flex list-none flex-col divide-y-2 divide-hairline p-0">
            {delivery.pickupPoints.map((point) => (
              <li key={point.id} className="py-2.5 first:pt-0 last:pb-0">
                <PickupRow point={point} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {pickupOnly && delivery.pickupPoints.length === 0 && (
        <p className="text-body text-ink-subtle">
          {t('delivery.noPoints')}
        </p>
      )}

      <p className="text-caption leading-relaxed text-ink-subtle">
        {t('delivery.note')}
      </p>
    </div>
  );
}

const BOX = 'flex flex-col gap-2 rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface p-3.5';
const ICON = 'flex size-12 shrink-0 items-center justify-center rounded-[0.875rem] bg-ok-soft text-shop-ink';

function MethodCard({ method }: { method: Method }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const terms = termsOf(method, t, currency);
  const Icon = method.pickup ? MapPin : (method.carriers?.length ?? 0) > 0 ? Box : Truck;

  return (
    <article className={BOX}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={ICON}><Icon className="size-6" /></span>
        <h2 className="m-0 min-w-0 flex-1 text-lead font-extrabold text-ink">{method.name}</h2>
        <span data-testid={`method-price-${method.id}`} className="shrink-0 text-lead font-extrabold tabular-nums text-ink">
          {priceOf(method, t, currency)}
        </span>
      </div>
      {terms.length > 0 && (
        <ul data-testid={`method-terms-${method.id}`} className="m-0 flex flex-col gap-0.5 pl-6 text-body leading-[1.45] text-ink">
          {terms.map((part) => <li key={part}>{part}</li>)}
        </ul>
      )}
    </article>
  );
}

function PickupRow({ point }: { point: PickupPoint }) {
  return (
    <div className="flex gap-3">
      <div className="flex min-w-0 grow flex-col gap-1">
        <b className="text-lead font-extrabold text-ink">{point.name}</b>
        {/*
          Адрес и часы одной строкой: по ним приезжают вместе, и разнесённые
          по разным строкам они читаются как два разных сведения.
        */}
        <span className="text-body leading-[1.45] text-ink-muted">
          {point.address}
          {point.workingHours ? ` · ${point.workingHours}` : ''}
        </span>
        <MapViewButton title={point.name} address={point.address}
          point={pointOf(point.latitude, point.longitude)} className="mt-1.5" />
      </div>
    </div>
  );
}

/**
 * Цена способа в одну строку справа.
 *
 * Договорная цена не выдумывается нулём: «0 тенге» клиент прочитал бы
 * как бесплатно, а потом получил бы счёт. Цена по зонам называется «от»
 * — назови её точной, и клиент из дальней зоны посчитал бы её обещанием.
 */
function priceOf(method: Method, t: TFunction, currency: Currency | undefined): string {
  if (method.negotiable) return t('delivery.negotiable');
  if (method.price != null) return money(method.price, currency);

  const zonePrices = method.zones.map((zone) => zone.price).filter((price) => price != null);
  if (zonePrices.length > 0) {
    return t('delivery.priceFrom', { amount: money(Math.min(...zonePrices), currency) });
  }

  return t('delivery.unset');
}

/**
 * Условия способа одной строкой под названием.
 *
 * Порогом бесплатной доставки и окнами интересуются до выбора способа,
 * а не после: они решают, стоит ли добрать до порога и получится ли принять
 * машину. Пустые части выпадают — «бесплатно от —» хуже, чем ничего.
 */
function termsOf(method: Method, t: TFunction, currency: Currency | undefined): string[] {
  const parts: string[] = [];

  if (method.zones.length > 0) {
    parts.push(
      method.zones
        .map((zone) => `${zone.name} ${zone.price != null ? money(zone.price, currency) : '—'}`)
        .join(', '),
    );
  }

  if (method.freeFromAmount != null && !method.negotiable) {
    parts.push(t('delivery.freeFrom', { amount: money(method.freeFromAmount, currency) }));
  }

  if (method.slots.length > 0) {
    parts.push(t('delivery.slots', {
      list: method.slots.map((slot) => slotLabel(slot.fromTime, slot.toTime)).join(', '),
    }));
  }

  // Что спросят при оформлении — часть условий: этаж без лифта человек хочет
  // обдумать заранее, а не в момент отправки заявки.
  const asked = [
    method.requiresAddress ? t('delivery.address') : null,
    method.requiresFloor ? t('delivery.floor') : null,
    method.requiresTimeSlot ? t('delivery.window') : null,
  ].filter(Boolean);
  if (asked.length > 0) parts.push(t('delivery.willAsk', { list: asked.join(', ') }));

  // Кто возит и кому платить — часть условий, как и грузчики.
  if ((method.carriers?.length ?? 0) > 0) {
    const names = method.carriers.map((carrier) => carrier.name).join(', ');
    parts.push(method.transportPayee === 'DIRECT'
      ? t('delivery.carriersDirect', { names })
      : t('delivery.carriers', { names }));
  }
  // Грузчики — часть условий: их обдумывают до заказа, а не при отправке.
  const loaders = loadersTerms(method.loaders, t, currency);
  if (loaders) parts.push(loaders);
  if (method.negotiable) parts.push(t('delivery.priceLater'));

  return parts;
}

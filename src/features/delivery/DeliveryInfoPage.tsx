import { CircleCheck, MapPin, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Method, PickupPoint } from '../../api/generated';
import { slotLabel, useDeliveryOptions } from '../cart/DeliveryBlock';
import { tenge } from '../../shared/format';
import { Card } from '../../ui/Card';
import { Reveal } from '../../ui/Reveal';

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
    <div className="flex flex-col gap-4 pb-20">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">
          {t('delivery.title')}
        </h1>
        {/*
          «Условия продавца» — про то, чьё это обещание: тарифы задаёт он
          и меняет когда захочет. Даты, на которую условия верны, в ответе
          сервера нет, и выдумывать её нельзя: она читалась бы как гарантия.
        */}
        <p className="text-[13px] text-ink-subtle">{t('delivery.terms')}</p>
      </header>

      {/*
        Возит или не возит — первое, что человек ищет на этом экране: от ответа
        зависит, заказывать ли машину. Поэтому он вынесен в полосу над
        условиями, а не спрятан в текст под ними.
      */}
      <div
        className={
          pickupOnly
            ? 'flex items-center gap-2.5 rounded-[var(--radius-card)] border border-hairline bg-sunk p-3.5'
            : 'flex items-center gap-2.5 rounded-[var(--radius-card)] border border-in-stock/25 bg-in-stock/10 p-3.5'
        }
      >
        {pickupOnly ? (
          <Package className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
        ) : (
          <CircleCheck className="size-5 shrink-0 text-in-stock" aria-hidden="true" />
        )}
        <p className={pickupOnly ? 'text-[15px] font-medium text-ink' : 'text-[15px] font-medium text-in-stock'}>
          {pickupOnly ? t('delivery.pickupOnly') : t('delivery.delivers')}
        </p>
      </div>

      {delivery.methods.length > 0 && (
        <Reveal>
          <Card className="overflow-hidden p-0">
            <h2 className="border-b border-hairline px-3.5 py-3 text-[13px] font-semibold text-ink-muted">
              {t('delivery.methods')}
            </h2>
            <ul className="divide-y divide-hairline">
              {delivery.methods.map((method) => (
                <li key={method.id}>
                  <MethodRow method={method} />
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}

      {delivery.pickupPoints.length > 0 && (
        <Reveal delay={0.04}>
          <Card className="overflow-hidden p-0">
            <h2 className="border-b border-hairline px-3.5 py-3 text-[13px] font-semibold text-ink-muted">
              {t('delivery.pickup')}
            </h2>
            <ul className="divide-y divide-hairline">
              {delivery.pickupPoints.map((point) => (
                <li key={point.id}>
                  <PickupRow point={point} />
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}

      {pickupOnly && delivery.pickupPoints.length === 0 && (
        <p className="text-[15px] text-ink-subtle">
          {t('delivery.noPoints')}
        </p>
      )}

      <p className="text-[12px] leading-relaxed text-ink-subtle">
        {t('delivery.note')}
      </p>
    </div>
  );
}

function MethodRow({ method }: { method: Method }) {
  const { t } = useTranslation();
  const terms = termsOf(method, t);

  return (
    <div className="flex flex-col gap-2 p-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[15px] font-medium text-ink">{method.name}</span>
        <span
          data-testid={`method-price-${method.id}`}
          className="shrink-0 text-[15px] font-semibold tabular-nums text-ink"
        >
          {priceOf(method, t)}
        </span>
      </div>

      {terms && (
        <p data-testid={`method-terms-${method.id}`} className="text-[12px] leading-[1.45] text-ink-subtle">
          {terms}
        </p>
      )}
    </div>
  );
}

function PickupRow({ point }: { point: PickupPoint }) {
  return (
    <div className="flex gap-3 p-3.5">
      <MapPin className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[15px] font-medium text-ink">{point.name}</span>
        {/*
          Адрес и часы одной строкой: по ним приезжают вместе, и разнесённые
          по разным строкам они читаются как два разных сведения.
        */}
        <span className="text-[12px] leading-[1.45] text-ink-subtle">
          {point.address}
          {point.workingHours ? ` · ${point.workingHours}` : ''}
        </span>
      </div>
    </div>
  );
}

/**
 * Цена способа в одну строку справа.
 *
 * Договорная цена не выдумывается нулём: «0 ₸» клиент прочитал бы
 * как бесплатно, а потом получил бы счёт. Цена по зонам называется «от»
 * — назови её точной, и клиент из дальней зоны посчитал бы её обещанием.
 */
function priceOf(method: Method, t: TFunction): string {
  if (method.negotiable) return t('delivery.negotiable');
  if (method.price != null) return tenge(method.price);

  const zonePrices = method.zones.map((zone) => zone.price).filter((price) => price != null);
  if (zonePrices.length > 0) {
    return t('delivery.priceFrom', { amount: tenge(Math.min(...zonePrices)) });
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
function termsOf(method: Method, t: TFunction): string {
  const parts: string[] = [];

  if (method.zones.length > 0) {
    parts.push(
      method.zones
        .map((zone) => `${zone.name} ${zone.price != null ? tenge(zone.price) : '—'}`)
        .join(', '),
    );
  }

  if (method.freeFromAmount != null && !method.negotiable) {
    parts.push(t('delivery.freeFrom', { amount: tenge(method.freeFromAmount) }));
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

  if (method.negotiable) parts.push(t('delivery.priceLater'));

  return parts.join(' · ');
}

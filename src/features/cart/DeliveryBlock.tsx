import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refetchStockViews, usePickupPoint } from '../../supplier/pickupPoint';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { cn } from '../../ui/cn';
import { Card } from '../../ui/Card';
import {
  useGetPortalDeliveryOptions,
  useGetPortalKnownAddresses,
  useGetPortalSuppliers,
  type SubmitOrderDelivery,
  type DeliveryOptionsDto,
  type KnownAddressDto,
  type Method,
} from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import type { Currency } from '../../shared/currency';
import { money } from '../../shared/format';
import { CarrierChoice } from './CarrierChoice';
import { paysCarrierDirectly } from './carrier';
import { LoadersChoice } from './LoadersChoice';
import { MapPointField } from '../maps/MapPointField';
import { MapViewButton } from '../maps/MapViewButton';
import { pointOf } from '../maps/mapProvider';
import type { LoadersLine } from './loaders';

interface DeliveryBlockProps {
  /** Сумма товаров: по ней считается, сколько не хватает до бесплатной доставки. */
  goodsTotal: number;
  value: SubmitOrderDelivery;
  onChange: (next: SubmitOrderDelivery) => void;
  /** Строки корзины — для предварительного расчёта грузчиков «за количество» и «за вес». */
  lines?: LoadersLine[];
}

/** Привезут или заберёт сам — первое решение, а не один из способов в списке. */
type Way = 'DELIVERY' | 'PICKUP';

/**
 * Условия доставки поставщика.
 *
 * Одним запросом на весь экран: блок выбора и итог смотрят на один и тот же
 * ответ, и второй запрос показал бы то же самое, но с другой ценой в момент,
 * когда поставщик её правит.
 */
export function useDeliveryOptions(): DeliveryOptionsDto | undefined {
  const options = useGetPortalDeliveryOptions();
  return options.data?.status === 200 ? (options.data.data as DeliveryOptionsDto) : undefined;
}

/**
 * Выбор доставки на экране оформления.
 *
 * Сначала «привезут или заберу» двумя кнопками, и только потом подробности
 * выбранной ветки: список из шести тарифов вперемешку с самовывозом
 * заставляет прочитать все шесть, чтобы принять первое решение.
 *
 * Спрашивается ровно то, что требует выбранный способ: обязательность приходит
 * со справочника поставщика, а не выводится из названия. У одного «до двери»
 * требует этаж, у другого нет — второй список правил в кабинете разошёлся бы
 * с первым на первом же поставщике с нестандартной договорённостью.
 *
 * Незаполненный выбор — рабочее состояние, а не ошибка: заявка дойдёт
 * до менеджера с неразрешённой доставкой, и он назовёт условия сам. Поэтому
 * блок ничего не блокирует и ни на что не жалуется.
 */
export function DeliveryBlock({ goodsTotal, value, onChange, lines = [] }: DeliveryBlockProps) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const options = useDeliveryOptions();
  // Ветка живёт отдельно от выбора: пока способ не назван, из полей заявки
  // не видно, чего клиент ждёт — а показать ему нужно уже нужную половину.
  const [opened, setOpened] = useState<Way | null>(null);
  const { supplierId } = useSupplier();
  const knownAddresses = useGetPortalKnownAddresses();
  const suppliers = useGetPortalSuppliers();

  // Единственный способ получения выбирается сам, как и единственный
  // в ветке: спрашивать «какой из одного» незачем. У «только самовывоза»
  // считаются лишь способы самовывоза — доставку поставщик отключил.
  const offered = options
    ? options.methods.filter((candidate) => options.mode !== 'PICKUP_ONLY' || candidate.pickup)
    : [];
  const only = offered.length === 1 ? offered[0].id : undefined;
  const unchosen = !value.methodId;
  useEffect(() => {
    if (only && unchosen) onChange({ methodId: only });
    // onChange — новая функция на каждой отрисовке экрана; выбор нужен один раз.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [only, unchosen]);

  // Точка, выбранная в шапке, подставляется сама: клиент выбирает её один раз.
  // Ветка считается тем же правилом, что ниже `way`: до раннего выхода хук обязан стоять всегда.
  const queryClient = useQueryClient();
  const [savedPoint, setSavedPoint] = usePickupPoint(() => refetchStockViews(queryClient));
  const chosenMethod = options?.methods.find((candidate) => candidate.id === value.methodId);
  const pickupWay = !!options && (options.mode === 'PICKUP_ONLY'
    || (opened ?? (chosenMethod ? (chosenMethod.pickup ? 'PICKUP' : 'DELIVERY') : null)) === 'PICKUP');
  const savedKnown = !!savedPoint && !!options?.pickupPoints.some((point) => point.id === savedPoint);
  const pointMissing = !value.pickupPointId;
  useEffect(() => {
    if (pickupWay && pointMissing && savedKnown && savedPoint) onChange({ ...value, pickupPointId: savedPoint });
    // onChange и value — новые на каждой отрисовке; подставить нужно один раз.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupWay, pointMissing, savedKnown, savedPoint]);

  if (!options) return null;

  const knownRows = knownAddresses.data?.status === 200 ? knownAddresses.data.data : [];
  const supplierNames = suppliers.data?.status === 200 ? suppliers.data.data : [];
  const suggestions = otherSuppliersAddresses(knownRows, supplierId);
  const nameOf = (id: string) =>
    supplierNames.find((candidate) => candidate.supplierId === id)?.name ?? id;

  const shipped = options.methods.filter((candidate) => !candidate.pickup);
  const collected = options.methods.filter((candidate) => candidate.pickup);
  const method = options.methods.find((candidate) => candidate.id === value.methodId);
  // Самовывоз — это либо режим поставщика целиком, либо способ, отмеченный
  // самовывозом: точку в обоих случаях выбирают одинаково.
  const pickupOnly = options.mode === 'PICKUP_ONLY';
  const way: Way | null = pickupOnly
    ? 'PICKUP'
    : opened ?? (method ? (method.pickup ? 'PICKUP' : 'DELIVERY') : null);

  const zones = method?.zones ?? [];
  const zone = zones.find((candidate) => candidate.id === value.zoneId);
  const shipping = deliveryPrice(method, goodsTotal, value.zoneId);
  const missing = method && missingToFree(method, goodsTotal);
  const list = way === 'PICKUP' ? collected : shipped;

  /**
   * Смена ветки обнуляет выбор целиком.
   *
   * Адрес, этаж и окно принадлежат прежнему способу, и оставленные от него
   * они ушли бы поставщику ответом на вопрос, которого он не задавал.
   * Единственный способ выбирается сам: спрашивать «какой из одного» незачем.
   */
  const choose = (next: Way) => {
    if (way === next) return;
    setOpened(next);
    const branch = next === 'PICKUP' ? collected : shipped;
    onChange(branch.length === 1 ? { methodId: branch[0].id } : {});
  };

  return (
    <Card className="flex flex-col gap-4 p-5 lg:p-6" data-testid="delivery">
      <h2 className="text-xl font-bold text-ink">{t('checkout.delivery.way')}</h2>

      <div className="flex flex-col gap-3 sm:flex-row" role="group" aria-label={t('checkout.delivery.way')}>
        <WayButton
          selected={way === 'DELIVERY'}
          // «Только самовывоз» — решение поставщика: заведённый в справочнике
          // способ доставки его не отменяет, и нажатие сбило бы выбранную точку.
          disabled={pickupOnly || shipped.length === 0}
          onSelect={() => choose('DELIVERY')}
        >
          {t('checkout.delivery.courier')}
        </WayButton>
        <WayButton
          selected={way === 'PICKUP'}
          disabled={!pickupOnly && collected.length === 0 && options.pickupPoints.length === 0}
          onSelect={() => choose('PICKUP')}
        >
          {t('checkout.delivery.pickup')}
        </WayButton>
      </div>

      {pickupOnly && (
        <p className="text-xs text-ink-subtle">{t('checkout.delivery.pickupOnly')}</p>
      )}

      {way && (
        <div className="flex flex-col gap-2">
          {list.length > 1 && (
            <Field label={way === 'PICKUP'
              ? t('checkout.delivery.pickupMethod')
              : t('checkout.delivery.deliveryMethod')}
            >
              <select
                value={value.methodId ?? ''}
                onChange={(event) => onChange({ methodId: event.currentTarget.value || undefined })}
                className={FIELD}
              >
                <option value="">{t('checkout.delivery.chooseMethod')}</option>
                {list.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                    {priceOf(candidate, t, currency)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {zones.length > 0 && (
            <Field label={t('checkout.delivery.zone')}>
              <select
                value={value.zoneId ?? ''}
                onChange={(event) =>
                  onChange({ ...value, zoneId: event.currentTarget.value || undefined })}
                className={FIELD}
              >
                <option value="">{t('checkout.delivery.chooseZone')}</option>
                {zones.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} · {money(candidate.price, currency)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {way === 'DELIVERY' && method && (
            <CarrierChoice method={method} value={value} onChange={onChange} fieldClass={FIELD} />
          )}

          {way === 'PICKUP' && options.pickupPoints.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-xs text-ink-subtle">{t('checkout.delivery.pickupPoint')}</legend>
              {options.pickupPoints.map((point) => (
                <Choice
                  key={point.id}
                  name="pickup-point"
                  checked={value.pickupPointId === point.id}
                  onSelect={() => {
                    onChange({ ...value, pickupPointId: point.id });
                    setSavedPoint(point.id ?? null);
                  }}
                >
                  {point.name}, {point.address}
                  {point.workingHours ? ` (${point.workingHours})` : ''}
                </Choice>
              ))}
              {/*
                Карта выбранного пункта — вне пунктов: внутри подписи
                переключателя она перехватывала бы нажатие, выбирающее пункт.
                Точки продавец не отметил — ищется по тексту адреса.
              */}
              {(() => {
                const chosen = options.pickupPoints.find((point) => point.id === value.pickupPointId);
                return chosen ? (
                  <MapViewButton title={chosen.name} address={chosen.address}
                    point={pointOf(chosen.latitude, chosen.longitude)} className="mt-1" />
                ) : null;
              })()}
            </fieldset>
          )}

          {method?.requiresAddress && (
            <>
              {/*
                Показывается только над пустым полем: подсказка над уже
                заполненным адресом предлагала бы заменить то, что человек
                сам набрал, а не сэкономить ему набор с нуля.
              */}
              {!value.address && suggestions.length > 0 && (
                <div className="flex flex-col gap-1.5" data-testid="known-address-suggestions">
                  <p className="text-xs text-ink-subtle">{t('checkout.delivery.addressHint')}</p>
                  {suggestions.map((known) => (
                    <button
                      key={known.supplierId}
                      type="button"
                      onClick={() =>
                        // Переносится только свободный текст — адрес, город,
                        // этаж. Способ доставки, зона и точка самовывоза —
                        // идентификаторы справочника соседнего поставщика,
                        // у нового они указывают в никуда; окно и дата
                        // принадлежат тому заказу, а не человеку.
                        onChange({
                          ...value,
                          address: known.address,
                          city: known.city,
                          floor: known.floor,
                          // Точка прежнего адреса не хранится — отметят заново.
                          latitude: undefined,
                          longitude: undefined,
                        })}
                      className={cn(
                        'flex flex-col items-start gap-0.5 rounded-[var(--radius-tile)] border border-hairline',
                        'px-3 py-2 text-left text-caption transition-all duration-300 hover:bg-sunk',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                      )}
                    >
                      <span className="text-ink-subtle">{nameOf(known.supplierId)}</span>
                      <span className="font-medium text-ink">
                        {known.address}
                        {known.city ? `, ${known.city}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <Field label={t('checkout.delivery.address')}>
                <input
                  type="text"
                  placeholder={t('checkout.delivery.addressPlaceholder')}
                  value={value.address ?? ''}
                  onChange={(event) => onChange({ ...value, address: event.currentTarget.value })}
                  className={FIELD}
                />
              </Field>
              {/*
                Точка необязательна: адрес словами остаётся главным, а точка
                помогает курьеру найти вход. Найденный картой адрес заменяет
                набранный — человек видит, что отметил.
              */}
              <MapPointField
                title={t('maps.deliveryTitle')}
                address={value.address ?? ''}
                point={pointOf(value.latitude, value.longitude)}
                onChange={(point, found) => onChange({
                  ...value,
                  address: found ?? value.address,
                  latitude: point?.latitude,
                  longitude: point?.longitude,
                })}
              />
            </>
          )}

          {method?.requiresFloor && (
            <Field label={t('checkout.delivery.floor')}>
              <input
                type="number"
                min={0}
                value={value.floor ?? ''}
                onChange={(event) =>
                  onChange({ ...value, floor: numberOrUndefined(event.currentTarget.value) })}
                className={cn(FIELD, 'tabular-nums')}
              />
            </Field>
          )}

          {method && !method.pickup && (
            // Дата и окно — один вопрос «когда»: разнесённые по разным строкам
            // они читаются как два, и второй легко пропустить.
            <div
              data-testid="delivery-when"
              className={cn(
                'grid gap-2',
                method.requiresTimeSlot && method.slots.length > 0 ? 'grid-cols-2' : 'grid-cols-1',
              )}
            >
              <Field label={t('checkout.delivery.date')}>
                <input
                  type="date"
                  value={value.date ?? ''}
                  onChange={(event) =>
                    onChange({ ...value, date: event.currentTarget.value || undefined })}
                  className={FIELD}
                />
              </Field>

              {method.requiresTimeSlot && method.slots.length > 0 && (
                <Field label={t('checkout.delivery.window')}>
                  <select
                    value={value.slot ?? ''}
                    onChange={(event) =>
                      onChange({ ...value, slot: event.currentTarget.value || undefined })}
                    className={FIELD}
                  >
                    <option value="">{t('checkout.delivery.chooseWindow')}</option>
                    {method.slots.map((slot) => (
                      <option
                        key={slotLabel(slot.fromTime, slot.toTime)}
                        value={slotLabel(slot.fromTime, slot.toTime)}
                      >
                        {slotLabel(slot.fromTime, slot.toTime)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}

          {way === 'DELIVERY' && method && (
            <div
              data-testid="shipping-row"
              className="flex items-center justify-between text-caption"
            >
              <span className="text-ink-muted">{t('checkout.delivery.cost')}</span>
              <span className="font-semibold tabular-nums text-ink">
                {shipping === undefined
                  ? (paysCarrierDirectly(method) ? t('checkout.delivery.carrierTariff') : t('checkout.summary.negotiable'))
                  : money(shipping, currency)}
              </span>
            </div>
          )}

          {way === 'DELIVERY' && paysCarrierDirectly(method) && (
            <p className="text-xs text-ink-subtle">{t('checkout.delivery.directNote')}</p>
          )}

          {way === 'DELIVERY' && method?.loaders && (
            <LoadersChoice
              loaders={method.loaders}
              value={value}
              lines={lines}
              askFloor={!method.requiresFloor}
              onChange={onChange}
            />
          )}

          {missing !== undefined && (
            <p
              data-testid="missing-to-free"
              className="flex items-start gap-2 rounded-[var(--radius-tile)] bg-accent-soft px-3 py-2.5 text-xs text-accent"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-px size-4 shrink-0">
                <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.4" fill="none" />
                <path
                  d="M8 5v3.4M8 10.8h.01"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              {t('checkout.delivery.freeFrom', { amount: money(missing, currency) })}
            </p>
          )}

          {method?.negotiable && !paysCarrierDirectly(method) && (
            <p className="text-xs text-ink-subtle">
              {t('checkout.delivery.costLater')}
            </p>
          )}

          {zones.length > 0 && !zone && (
            <p className="text-xs text-ink-subtle">
              {t('checkout.delivery.costByZone')}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Половина переключателя «доставка — самовывоз».
 *
 * Кнопкой, а не переключателем формы: выбор меняет половину блока, и человек
 * должен видеть, что нажатие что-то делает. Недоступная половина названа
 * недоступной, а не спрятана: исчезнувшая кнопка читается как поломка,
 * а серая — как «этот поставщик так не работает».
 */
function WayButton({
  selected,
  disabled,
  onSelect,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      // Карточка выбора — галочка в углу в оформленном кабинете (`liveTheme.css`).
      data-choice
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        // Крупная плитка, а не тонкий переключатель: способ получения —
        // главный вопрос экрана, и выбор должен читаться издалека.
        'min-h-16 flex-1 rounded-[var(--radius-tile)] border-2 px-4 text-left text-lead font-bold',
        'transition-all duration-200 active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-45',
        selected
          ? 'border-accent bg-bar text-accent-ink'
          : 'border-line bg-surface text-ink hover:border-ink',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Выбор одного из нескольких: своя разметка вместо готового переключателя.
 *
 * Целиком кликается вся строка, а не кружок в её начале: попасть пальцем
 * в двадцать точек на складе невозможно, а строка высотой 44 точки прощает
 * промах.
 */
function Choice({
  name,
  checked,
  onSelect,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-tile)] px-3',
        'text-sm transition-all duration-300',
        checked ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-sunk',
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="size-4 accent-[var(--color-accent)]"
      />
      <span>{children}</span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-ink-subtle">{label}</span>
      {children}
    </label>
  );
}

const FIELD = cn(
  'h-12 w-full rounded-[var(--radius-tile)] border border-hairline bg-surface px-3',
  'text-sm text-ink placeholder:text-ink-faint',
  'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
);

/**
 * До трёх адресов, которые клиент уже называл другим поставщикам.
 *
 * Текущий поставщик исключён: адрес, набранный у него самого, предлагать
 * незачем — человек его уже видит в поле. Свежие идут первыми: адрес,
 * названный вчера, вероятнее подойдёт, чем адрес полугодовой давности.
 */
function otherSuppliersAddresses(
  addresses: KnownAddressDto[],
  currentSupplierId: string | null,
): KnownAddressDto[] {
  return addresses
    .filter((candidate) => candidate.supplierId !== currentSupplierId)
    .slice()
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt))
    .slice(0, 3);
}

/** Стоимость способа в подписи. Договорную не называем: её называет человек. */
function priceOf(method: Method, t: TFunction, currency: Currency | undefined): string {
  if (method.negotiable) return t('checkout.delivery.priceNegotiable');
  if (method.price === undefined) return '';
  return method.price === 0 ? t('checkout.delivery.priceFree') : ` — ${money(method.price, currency)}`;
}

/**
 * Сколько не хватает до бесплатной доставки.
 *
 * Пусто, когда порога нет или он уже пройден: «не хватает 0 тенге» человек читает
 * как поломку, а не как хорошую новость.
 */
function missingToFree(method: Method, goodsTotal: number): number | undefined {
  if (method.freeFromAmount === undefined) return undefined;
  const missing = method.freeFromAmount - goodsTotal;
  return missing > 0 ? missing : undefined;
}

/**
 * Стоимость доставки, которую кабинет вправе показать в итоге.
 *
 * Только заранее известная: договорная приходит пустой, и подставить вместо
 * неё ноль значило бы пообещать бесплатную доставку от имени поставщика.
 * У зонального тарифа цену называет выбранная зона — пока она не выбрана,
 * цены нет ни у кабинета, ни у поставщика.
 */
export function deliveryPrice(
  method: Method | undefined,
  goodsTotal: number,
  zoneId?: string,
): number | undefined {
  if (!method || method.negotiable) return undefined;
  if (method.freeFromAmount !== undefined && goodsTotal >= method.freeFromAmount) return 0;

  const zones = method.zones ?? [];
  if (zones.length > 0) return zones.find((candidate) => candidate.id === zoneId)?.price;
  return method.price;
}

/** «14:00:00» — время для машины; человеку нужно «14:00». */
export function slotLabel(fromTime: string, toTime: string): string {
  return `${fromTime.slice(0, 5)}–${toTime.slice(0, 5)}`;
}

/**
 * Этаж из поля ввода.
 *
 * Поле отдаёт строку, и пустая строка — это «не указали», а не ноль:
 * нулевой этаж уехал бы поставщику как ответ, которого клиент не давал.
 */
function numberOrUndefined(value: number | string): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const parsed = Number(value);
  return value.trim() === '' || !Number.isFinite(parsed) ? undefined : parsed;
}

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
import { ownCarrierChosen, paysCarrierDirectly } from './carrier';
import { LoadersChoice } from './LoadersChoice';
import { MapPointField } from '../maps/MapPointField';
import { MapPickerDialog } from '../maps/MapPickerDialog';
import { useMapHome } from '../maps/useMapHome';
import { MapViewButton } from '../maps/MapViewButton';
import { pointOf } from '../maps/mapProvider';
import { CHIP_ROW } from '../../ui/chipRow';
import type { LoadersLine } from './loaders';

interface DeliveryBlockProps {
  /** Сумма товаров: по ней считается, сколько не хватает до бесплатной доставки. */
  goodsTotal: number;
  value: SubmitOrderDelivery;
  onChange: (next: SubmitOrderDelivery) => void;
  /** Строки корзины — для предварительного расчёта грузчиков «за количество» и «за вес». */
  lines?: LoadersLine[];
  /**
   * Какая часть блока: всё сразу (монитор), «где и когда» или «грузчики и перевозчик» —
   * на телефоне это два экрана шага «Как получить» (макеты SimplePicCheckoutDelivery / …Loaders).
   */
  part?: 'all' | 'where' | 'extras';
}

/** Есть ли у способа второй экран — грузчики или перевозчик. */
export function hasDeliveryExtras(method: DeliveryOptionsDto['methods'][number] | undefined): boolean {
  return !!method && !method.pickup && (!!method.loaders || (method.carriers ?? []).length > 0);
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
export function DeliveryBlock({ goodsTotal, value, onChange, lines = [], part = 'all' }: DeliveryBlockProps) {
  const where = part !== 'extras';
  const extras = part !== 'where';
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const options = useDeliveryOptions();
  // Ветка живёт отдельно от выбора: пока способ не назван, из полей заявки
  // не видно, чего клиент ждёт — а показать ему нужно уже нужную половину.
  const [opened, setOpened] = useState<Way | null>(null);
  // Адрес сначала ищут картой (просьба владельца 2026-11-09); «Ввести вручную» — отказ от карты.
  const [manualAddress, setManualAddress] = useState(false);
  const [addressMap, setAddressMap] = useState(false);
  const mapHome = useMapHome();
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
  const mapFirst = !manualAddress && !value.address && value.latitude == null;
  // Самовывоз — это либо режим поставщика целиком, либо способ, отмеченный
  // самовывозом: точку в обоих случаях выбирают одинаково.
  const pickupOnly = options.mode === 'PICKUP_ONLY';
  const way: Way | null = pickupOnly
    ? 'PICKUP'
    : opened ?? (method ? (method.pickup ? 'PICKUP' : 'DELIVERY') : null);

  const zones = method?.zones ?? [];
  const zone = zones.find((candidate) => candidate.id === value.zoneId);
  // Свой перевозчик клиента: тариф продавца не действует — цену называет перевозчик.
  const own = ownCarrierChosen(method, value);
  const shipping = own ? undefined : deliveryPrice(method, goodsTotal, value.zoneId);
  const missing = own ? undefined : method && missingToFree(method, goodsTotal);
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

  if (!where) {
    if (way !== 'DELIVERY' || !hasDeliveryExtras(method)) return null;
    return (
      <Card className="flex flex-col gap-4 p-5" data-testid="delivery-extras">
        {method && <CarrierChoice method={method} value={value} onChange={onChange} fieldClass={FIELD} />}
        {method?.loaders && (
          <LoadersChoice loaders={method.loaders} value={value} lines={lines} askFloor={!method.requiresFloor} onChange={onChange} />
        )}
      </Card>
    );
  }

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
            // Карточками, а не системным списком (просьба владельца 2026-11-09): выпадающее меню
            // рисует браузер, и оформить его под кабинет нельзя.
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-lead font-extrabold text-ink">
                {way === 'PICKUP' ? t('checkout.delivery.pickupMethod') : t('checkout.delivery.deliveryMethod')}
              </legend>
              {list.map((candidate) => {
                const checked = value.methodId === candidate.id;
                const price = priceOf(candidate, t, currency).replace(/^ — /, '');
                return (
                  <label key={candidate.id} className={cn(
                    'flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-[3px] border-solid px-4 py-2',
                    'transition-colors duration-150 focus-within:ring-2 focus-within:ring-accent',
                    checked ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink hover:border-ink',
                  )}>
                    <input type="radio" name="delivery-method" checked={checked} className="sr-only"
                      onChange={() => onChange({ methodId: candidate.id })} />
                    <span aria-hidden="true" className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                      checked ? 'border-current' : 'border-line',
                    )}>
                      {checked && <span className="size-2.5 rounded-full bg-current" />}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-body font-extrabold leading-tight">{candidate.name}</span>
                      {price && <span className={cn('text-sm font-semibold', checked ? 'opacity-85' : 'text-ink-muted')}>{price}</span>}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}

          {zones.length > 0 && (
            <ChipChoice
              legend={t('checkout.delivery.zone')}
              name="delivery-zone"
              value={value.zoneId}
              options={zones.map((candidate) => ({ value: candidate.id, label: `${candidate.name} · ${money(candidate.price, currency)}` }))}
              onChange={(zoneId) => onChange({ ...value, zoneId })}
            />
          )}

          {extras && way === 'DELIVERY' && method && (
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
              <Field label={t('checkout.delivery.address')}>
                {/*
                  Пока адреса нет, поле — вход в карту: нажатие открывает поиск по карте.
                  Набирать руками можно после «Ввести вручную» — здесь или в окне карты.
                */}
                <input
                  type="text"
                  readOnly={mapFirst}
                  placeholder={mapFirst ? t('checkout.delivery.addressMapPlaceholder') : t('checkout.delivery.addressPlaceholder')}
                  value={value.address ?? ''}
                  onClick={() => { if (mapFirst) setAddressMap(true); }}
                  onKeyDown={(event) => {
                    if (mapFirst && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setAddressMap(true); }
                  }}
                  onChange={(event) => onChange({ ...value, address: event.currentTarget.value })}
                  className={cn(FIELD, mapFirst && 'cursor-pointer')}
                />
              </Field>
              {mapFirst && (
                <button type="button" onClick={() => setManualAddress(true)}
                  className="self-start cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-accent-ink underline underline-offset-2">
                  {t('checkout.delivery.addressManual')}
                </button>
              )}
              {addressMap && (
                <MapPickerDialog
                  title={t('maps.deliveryTitle')}
                  address=""
                  initial={null}
                  home={mapHome}
                  cancelLabel={t('checkout.delivery.addressManual')}
                  onClose={() => { setAddressMap(false); setManualAddress(true); }}
                  onPick={(point, found) => {
                    setAddressMap(false);
                    onChange({ ...value, address: found ?? value.address, latitude: point.latitude, longitude: point.longitude });
                  }}
                />
              )}
              {/*
                «Уже называли» — адреса, которые клиент давал другим магазинам, кнопкой под полем (макет).
                Переносится только свободный текст — адрес, город, этаж: способ, зона и точка соседнего
                поставщика у нового указывают в никуда, а окно и дата принадлежат тому заказу.
              */}
              {/* Только над пустым полем: над набранным адресом подсказка предлагала бы заменить написанное. */}
              {!value.address && suggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2" data-testid="known-address-suggestions">
                  <span className="text-sm text-ink-muted">{t('checkout.delivery.addressHint')}</span>
                  {suggestions.map((known) => (
                    <button
                      key={known.supplierId}
                      type="button"
                      onClick={() => onChange({
                        ...value,
                        address: known.address,
                        city: known.city,
                        floor: known.floor,
                        // Точка прежнего адреса не хранится — отметят заново.
                        latitude: undefined,
                        longitude: undefined,
                      })}
                      className="min-h-10 cursor-pointer rounded-2xl border-[3px] border-solid border-line bg-surface px-3 text-sm font-extrabold text-ink hover:border-shop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {known.address}{known.city ? `, ${known.city}` : ''}
                      <span className="sr-only"> — {nameOf(known.supplierId)}</span>
                    </button>
                  ))}
                </div>
              )}
              {/*
                Точка необязательна: адрес словами остаётся главным, а точка
                помогает курьеру найти вход. Найденный картой адрес заменяет
                набранный — человек видит, что отметил.
              */}
              {!mapFirst && <MapPointField
                title={t('maps.deliveryTitle')}
                address={value.address ?? ''}
                point={pointOf(value.latitude, value.longitude)}
                onChange={(point, found) => onChange({
                  ...value,
                  address: found ?? value.address,
                  latitude: point?.latitude,
                  longitude: point?.longitude,
                })}
              />}
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
            // Дата и окно — один вопрос «когда»: кнопками, как в макете SimplePicCheckoutDelivery.
            <div data-testid="delivery-when" className="flex flex-col gap-3">
              <DayChoice value={value.date} onChange={(date) => onChange({ ...value, date })} />
              {method.requiresTimeSlot && method.slots.length > 0 && (
                <ChipChoice
                  legend={t('checkout.delivery.window')}
                  name="delivery-window"
                  value={value.slot}
                  options={method.slots.map((slot) => {
                    const label = slotLabel(slot.fromTime, slot.toTime);
                    return { value: label, label };
                  })}
                  onChange={(slot) => onChange({ ...value, slot })}
                />
              )}
            </div>
          )}

          {/* На телефоне стоимость и «не хватает до бесплатной» стоят над «Дальше» (part='where'). */}
          {part === 'all' && way === 'DELIVERY' && method && (
            <div
              data-testid="shipping-row"
              className="flex items-center justify-between text-caption"
            >
              <span className="text-ink-muted">{t('checkout.delivery.cost')}</span>
              <span className="font-semibold tabular-nums text-ink">
                {shipping === undefined
                  ? (paysCarrierDirectly(method, value) ? t('checkout.delivery.carrierTariff') : t('checkout.summary.negotiable'))
                  : money(shipping, currency)}
              </span>
            </div>
          )}

          {way === 'DELIVERY' && paysCarrierDirectly(method, value) && (
            <p className="text-xs text-ink-subtle">{t('checkout.delivery.directNote')}</p>
          )}

          {extras && way === 'DELIVERY' && method?.loaders && (
            <LoadersChoice
              loaders={method.loaders}
              value={value}
              lines={lines}
              askFloor={!method.requiresFloor}
              onChange={onChange}
            />
          )}

          {part === 'all' && missing !== undefined && (
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

          {method?.negotiable && !paysCarrierDirectly(method, value) && (
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

/** Выбор одного из нескольких — кнопками в ряд (листается вбок), как чипы макета «Вариант Б». */
function ChipChoice({ legend, name, value, options, onChange }: {
  legend: string;
  name: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-lead font-extrabold text-ink">{legend}</legend>
      <div className={cn(CHIP_ROW, 'gap-2')}>
        {options.map((option) => (
          <Chip key={option.value} name={name} checked={value === option.value} onSelect={() => onChange(option.value)}>
            {option.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

function Chip({ name, checked, onSelect, children }: {
  name: string; checked: boolean; onSelect: () => void; children: React.ReactNode;
}) {
  return (
    <label className={cn(
      'flex min-h-14 min-w-[4.5rem] cursor-pointer items-center justify-center rounded-2xl border-[3px] border-solid px-3.5 text-center text-body font-extrabold leading-tight',
      'focus-within:ring-2 focus-within:ring-accent',
      checked ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink',
    )}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      {children}
    </label>
  );
}

/** Дата «2026-11-07» по местному времени — не через toISOString, иначе ночью уезжает на день. */
function isoDay(offset: number): string {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

/** «Когда»: сегодня, завтра, послезавтра кнопками; другой день — календарём. */
function DayChoice({ value, onChange }: { value: string | undefined; onChange: (date: string | undefined) => void }) {
  const { t, i18n } = useTranslation();
  const days = [0, 1, 2].map((offset) => {
    const iso = isoDay(offset);
    const label = offset === 0 ? t('checkout.delivery.today') : offset === 1 ? t('checkout.delivery.tomorrow')
      : new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'long' });
    return { value: iso, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
  const [other, setOther] = useState(() => !!value && !days.some((day) => day.value === value));
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-lead font-extrabold text-ink">{t('checkout.delivery.date')}</legend>
      <div className={cn(CHIP_ROW, 'gap-2')}>
        {days.map((day) => (
          <Chip key={day.value} name="delivery-day" checked={!other && value === day.value}
            onSelect={() => { setOther(false); onChange(day.value); }}>
            {day.label}
          </Chip>
        ))}
        <Chip name="delivery-day" checked={other} onSelect={() => { setOther(true); onChange(undefined); }}>
          {t('checkout.delivery.otherDay')}
        </Chip>
      </div>
      {other && (
        <input type="date" aria-label={t('checkout.delivery.otherDay')} value={value ?? ''} min={isoDay(0)}
          onChange={(event) => onChange(event.currentTarget.value || undefined)} className={FIELD} />
      )}
    </fieldset>
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
export function missingToFree(method: Method, goodsTotal: number): number | undefined {
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

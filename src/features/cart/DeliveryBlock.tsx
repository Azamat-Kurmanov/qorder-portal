import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { cn } from '../../ui/cn';
import { Card } from '../../ui/Card';
import {
  useGetPortalDeliveryOptions,
  useGetPortalKnownAddresses,
  useGetPortalSuppliers,
  type Delivery,
  type DeliveryOptionsDto,
  type KnownAddressDto,
  type Method,
} from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { tenge } from '../../shared/format';

interface DeliveryBlockProps {
  /** Сумма товаров: по ней считается, сколько не хватает до бесплатной доставки. */
  goodsTotal: number;
  value: Delivery;
  onChange: (next: Delivery) => void;
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
export function DeliveryBlock({ goodsTotal, value, onChange }: DeliveryBlockProps) {
  const { t } = useTranslation();
  const options = useDeliveryOptions();
  // Ветка живёт отдельно от выбора: пока способ не назван, из полей заявки
  // не видно, чего клиент ждёт — а показать ему нужно уже нужную половину.
  const [opened, setOpened] = useState<Way | null>(null);
  const { supplierId } = useSupplier();
  const knownAddresses = useGetPortalKnownAddresses();
  const suppliers = useGetPortalSuppliers();

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
    <Card className="flex flex-col gap-3 p-3.5" data-testid="delivery">
      <p className="text-[15px] font-semibold text-ink">{t('checkout.delivery.way')}</p>

      <div className="flex gap-2" role="group" aria-label={t('checkout.delivery.way')}>
        <WayButton
          selected={way === 'DELIVERY'}
          disabled={shipped.length === 0}
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
                    {priceOf(candidate, t)}
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
                    {candidate.name} · {tenge(candidate.price)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {way === 'PICKUP' && options.pickupPoints.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-xs text-ink-subtle">{t('checkout.delivery.pickupPoint')}</legend>
              {options.pickupPoints.map((point) => (
                <Choice
                  key={point.id}
                  name="pickup-point"
                  checked={value.pickupPointId === point.id}
                  onSelect={() => onChange({ ...value, pickupPointId: point.id })}
                >
                  {point.name}, {point.address}
                  {point.workingHours ? ` (${point.workingHours})` : ''}
                </Choice>
              ))}
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
                        })}
                      className={cn(
                        'flex flex-col items-start gap-0.5 rounded-[var(--radius-tile)] border border-hairline',
                        'px-3 py-2 text-left text-[13px] transition-all duration-300 hover:bg-sunk',
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
              className="flex items-center justify-between text-[13px]"
            >
              <span className="text-ink-muted">{t('checkout.delivery.cost')}</span>
              <span className="font-semibold tabular-nums text-ink">
                {shipping === undefined ? t('checkout.summary.negotiable') : tenge(shipping)}
              </span>
            </div>
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
              {t('checkout.delivery.freeFrom', { amount: tenge(missing) })}
            </p>
          )}

          {method?.negotiable && (
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
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'h-11 flex-1 rounded-[var(--radius-tile)] border text-[13px]',
        'transition-all duration-300 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        'disabled:pointer-events-none disabled:opacity-45',
        selected
          ? 'border-accent/25 bg-accent-soft font-medium text-accent'
          : 'border-hairline text-ink-muted hover:bg-sunk',
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
  'transition-all duration-300 focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-brand/30',
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
function priceOf(method: Method, t: TFunction): string {
  if (method.negotiable) return t('checkout.delivery.priceNegotiable');
  if (method.price === undefined) return '';
  return method.price === 0 ? t('checkout.delivery.priceFree') : ` — ${tenge(method.price)}`;
}

/**
 * Сколько не хватает до бесплатной доставки.
 *
 * Пусто, когда порога нет или он уже пройден: «не хватает 0 ₸» человек читает
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

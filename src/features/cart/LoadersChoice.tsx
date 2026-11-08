import { useTranslation } from 'react-i18next';
import type { DeliveryLoaders, SubmitOrderDelivery } from '../../api/generated';
import { cn } from '../../ui/cn';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { loadersPrice, loadersTerms, type LoadersLine } from './loaders';

/**
 * Грузчики в блоке доставки.
 *
 * «Входят в доставку» — строкой: выбирать нечего. «По запросу» — флажком,
 * и сумма видна сразу; где её не посчитать заранее — «уточнит продавец».
 * Этаж спрашивается здесь, только если способ не спросил его сам.
 */
export function LoadersChoice({ loaders, value, lines, askFloor, onChange }: {
  loaders: DeliveryLoaders;
  value: SubmitOrderDelivery;
  lines: LoadersLine[];
  askFloor: boolean;
  onChange: (next: SubmitOrderDelivery) => void;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const provider = t(`checkout.delivery.loaders.provider.${loaders.provider ?? 'OWN'}`);

  if (loaders.mode === 'INCLUDED') {
    return (
      <p data-testid="loaders-included" className="text-sm text-ink-muted">
        {t('checkout.delivery.loaders.included')} · {provider}
      </p>
    );
  }
  if (loaders.mode !== 'ON_REQUEST' && loaders.mode !== 'REQUIRED') return null;

  const required = loaders.mode === 'REQUIRED';
  const wanted = required || value.loaders === true;
  const quote = wanted ? loadersPrice(loaders, lines, value.floor, value.hasLift === true) : undefined;

  return (
    <div data-testid="loaders" className="flex flex-col gap-2">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={wanted}
          disabled={required}
          onChange={(event) => onChange({
            ...value,
            loaders: event.currentTarget.checked || undefined,
            hasLift: event.currentTarget.checked ? value.hasLift : undefined,
          })}
          className="size-4 accent-[var(--color-accent)]"
        />
        {required ? t('checkout.delivery.loaders.required') : t('checkout.delivery.loaders.need')}
      </label>
      <p className="text-xs text-ink-subtle">{loadersTerms(loaders, t, currency)} · {provider}</p>

      {wanted && loaders.tariff === 'PER_FLOOR' && (
        <>
          {askFloor && (
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-ink-subtle">{t('checkout.delivery.loaders.floor')}</span>
              <input
                type="number"
                min={0}
                value={value.floor ?? ''}
                onChange={(event) => {
                  const text = event.currentTarget.value;
                  const parsed = Number(text);
                  onChange({ ...value, floor: text.trim() === '' || !Number.isFinite(parsed) ? undefined : parsed });
                }}
                className={cn(
                  'h-12 w-full rounded-[var(--radius-tile)] border border-hairline bg-surface px-3 text-sm text-ink tabular-nums',
                  'focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-brand/30',
                )}
              />
            </label>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={value.hasLift === true}
              onChange={(event) => onChange({ ...value, hasLift: event.currentTarget.checked || undefined })}
              className="size-4 accent-[var(--color-accent)]"
            />
            {t('checkout.delivery.loaders.hasLift')}
          </label>
        </>
      )}

      {wanted && (
        <div data-testid="loaders-row" className="flex items-center justify-between text-caption">
          <span className="text-ink-muted">{t('checkout.delivery.loaders.cost')}</span>
          <span className="font-semibold tabular-nums text-ink">
            {quote?.amount === undefined ? t('checkout.delivery.loaders.later') : money(quote.amount, currency)}
          </span>
        </div>
      )}
      {wanted && loaders.payee === 'DIRECT' && (
        <p className="text-xs text-ink-subtle">{t('checkout.delivery.loaders.direct')}</p>
      )}
    </div>
  );
}

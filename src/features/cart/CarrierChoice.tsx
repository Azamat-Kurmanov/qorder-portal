import { useTranslation } from 'react-i18next';
import type { DeliveryOptionsDto, SubmitOrderDelivery } from '../../api/generated';
import { chosenCarrier, terminalAllowed } from './carrier';

type Method = DeliveryOptionsDto['methods'][number];

/**
 * Перевозчик в блоке доставки: выбор, если их несколько; телефон и заметка —
 * чтобы клиент знал, кто позвонит; «до терминала / до двери» — на межгороде.
 */
export function CarrierChoice({ method, value, onChange, fieldClass }: {
  method: Method;
  value: SubmitOrderDelivery;
  onChange: (next: SubmitOrderDelivery) => void;
  fieldClass: string;
}) {
  const { t } = useTranslation();
  const carriers = method.carriers ?? [];
  if (carriers.length === 0) return null;
  const carrier = chosenCarrier(method, value);

  return (
    <div data-testid="carrier" className="flex flex-col gap-2">
      {carriers.length > 1 ? (
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-ink-subtle">{t('checkout.delivery.carrier')}</span>
          <select value={value.carrierId ?? ''} className={fieldClass}
            onChange={(event) => onChange({ ...value, carrierId: event.currentTarget.value || undefined, deliverTo: undefined })}>
            <option value="">{t('checkout.delivery.chooseCarrier')}</option>
            {carriers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>
        </label>
      ) : (
        <p className="text-sm text-ink">{t('checkout.delivery.carrierOne', { name: carrier?.name })}</p>
      )}
      {carrier && (carrier.phone || carrier.note) ? (
        <p className="text-xs text-ink-subtle">{[carrier.phone, carrier.note].filter(Boolean).join(' · ')}</p>
      ) : null}
      {terminalAllowed(method, carrier) ? (
        <div role="radiogroup" className="flex flex-col gap-1 text-sm text-ink">
          {(['DOOR', 'TERMINAL'] as const).map((to) => (
            <label key={to} className="flex min-h-11 items-center gap-3">
              <input type="radio" name="deliver-to" checked={(value.deliverTo ?? 'DOOR') === to}
                onChange={() => onChange({ ...value, deliverTo: to })} className="size-4 accent-[var(--color-accent)]" />
              {to === 'TERMINAL'
                ? t('checkout.delivery.toTerminal', { address: carrier?.terminalAddress })
                : t('checkout.delivery.toDoor')}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

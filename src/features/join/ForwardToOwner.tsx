import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { FieldFaultText } from '../../ui/Field';
import { useFormRules } from '../../ui/forms/useFormRules';
import { rules } from '../../api/rules.generated';
import { useForwardSupplierJoin } from '../../api/generated';
import { whatsappHref } from '../referral/referralText';
import { KZ_PHONE } from './kzPhone';

const INPUT = cn(
  'h-14 rounded-[var(--radius-control)] border-2 border-field-line bg-surface px-4',
  'text-base text-ink outline-none focus:border-shop focus:ring-1 focus:ring-shop',
);

const SCHEMA = {
  ...rules.ForwardReferralRequest,
  sellerPhone: { ...rules.ForwardReferralRequest.sellerPhone, pattern: KZ_PHONE },
};

/**
 * Продавец, не владелец: компанию подключает владелец. Продавец получает ссылку владельцу
 * и отправляет её сам, из своего WhatsApp, — система первой не пишет. Когда владелец заведёт
 * его сотрудником с этим номером, клиент станет его клиентом.
 */
export function ForwardToOwner({ code, onBack }: { code: string; onBack: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const form = useFormRules({ schema: SCHEMA, initial: { sellerName: '', sellerPhone: '' } });
  const forward = useForwardSupplierJoin();
  const [link, setLink] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function make() {
    if (!form.validate()) return;
    setFailed(false);
    try {
      const response = await forward.mutateAsync({
        code,
        data: { sellerName: form.values.sellerName.trim(), sellerPhone: form.values.sellerPhone.trim() },
      });
      if (response.status === 200) setLink(response.data.link);
    } catch (error) {
      form.applyServerFault(error);
      setFailed(true);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Буфер закрыт браузером — ссылка видна на экране, её можно выделить.
    }
  }

  const fields = [
    { key: 'sellerName' as const, label: 'join.seller.name', autoComplete: 'name' },
    { key: 'sellerPhone' as const, label: 'join.seller.phone', inputMode: 'tel' as const, autoComplete: 'tel' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-ink">{t('join.seller.title')}</h2>
      <p className="text-base text-ink-muted">{t('join.seller.text')}</p>

      {link ? (
        <>
          <Button size="lg" className="h-auto whitespace-normal py-3" onClick={() => window.open(whatsappHref(t('join.seller.message', { link })), '_blank', 'noopener')}>
            {t('join.seller.whatsapp')}
          </Button>
          <Button size="lg" variant="outline" onClick={() => void copy()}>
            {copied ? t('join.seller.copied') : t('join.seller.copy')}
          </Button>
          <p className="break-all rounded-[var(--radius-control)] bg-sunk px-3 py-2.5 text-sm text-ink">{link}</p>
        </>
      ) : (
        <>
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-${field.key}`} className="text-sm font-medium text-ink">{t(field.label)}</label>
              <input
                id={`${id}-${field.key}`}
                value={form.values[field.key]}
                inputMode={field.inputMode}
                autoComplete={field.autoComplete}
                aria-invalid={form.faults[field.key] ? 'true' : 'false'}
                onChange={(event) => form.field(field.key).onChange(event.currentTarget.value)}
                onBlur={form.field(field.key).onBlur}
                className={INPUT}
              />
              <FieldFaultText fault={form.faults[field.key]} name={field.key} />
            </div>
          ))}
          {failed && (
            <p role="alert" className="rounded-[var(--radius-control)] border border-gone/30 bg-gone/8 px-3 py-2 text-sm text-ink">
              {t('join.seller.failed')}
            </p>
          )}
          <Button size="lg" disabled={forward.isPending} onClick={() => void make()}>
            {t('join.seller.make')}
          </Button>
        </>
      )}

      <p className="rounded-[var(--radius-control)] border border-hairline bg-sunk px-3 py-2 text-sm text-ink">
        {t('join.seller.already')}
      </p>
      <Button variant="soft" onClick={onBack}>{t('join.back')}</Button>
    </div>
  );
}

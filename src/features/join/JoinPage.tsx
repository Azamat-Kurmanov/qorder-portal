import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Logo } from '../../ui/Logo';
import { cn } from '../../ui/cn';
import { FieldFaultText } from '../../ui/Field';
import { useFormRules } from '../../ui/forms/useFormRules';
import { rules } from '../../api/rules.generated';
import {
  useGetSupplierConsentNotice,
  useGetSupplierJoin,
  useSubmitSupplierLead,
  type ConsentNoticeDto,
} from '../../api/generated';
import { ConsentNotice } from '../activation/ConsentNotice';
import { LanguageAsk } from '../language/LanguageAsk';
import { LanguagePicker } from '../shell/LanguagePicker';

const INPUT = cn(
  'h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3',
  'text-sm text-ink outline-none focus:border-[var(--color-brand)]',
);

type Key = 'name' | 'binIin' | 'phone' | 'city';
const FIELDS: { key: Key; label: string; inputMode?: 'numeric' | 'tel'; autoComplete?: string }[] = [
  { key: 'name', label: 'join.name', autoComplete: 'organization' },
  { key: 'binIin', label: 'join.bin', inputMode: 'numeric' },
  { key: 'phone', label: 'join.phone', inputMode: 'tel', autoComplete: 'tel' },
  { key: 'city', label: 'join.city', autoComplete: 'address-level2' },
];

function failureKey(error: unknown): string {
  const code = (error as { info?: { code?: unknown } } | null)?.info?.code;
  if (code === 'REFERRAL_LEAD_TOO_OFTEN') return 'join.tooOften';
  if (code === 'REFERRAL_CONSENT_OUTDATED') return 'join.consentOutdated';
  return 'join.failed';
}

/**
 * Страница для поставщика, которого клиент позвал в Q-Order, — без входа и без
 * оформления какого-либо магазина. Погашенная ссылка не тупик: поставщик всё равно
 * может оставить заявку, только без пригласившего.
 */
export function JoinPage() {
  const { t } = useTranslation();
  const id = useId();
  const { code } = useParams();
  const invite = useGetSupplierJoin(code ?? '', { query: { enabled: !!code, retry: false } });
  const live = code && invite.data?.status === 200 ? invite.data.data : undefined;
  const expired = !!code && invite.isError;
  const noticeQuery = useGetSupplierConsentNotice();
  const notice: ConsentNoticeDto | undefined = noticeQuery.data?.status === 200 ? noticeQuery.data.data : undefined;
  const form = useFormRules({
    schema: rules.SupplierLeadRequest,
    initial: { name: '', binIin: '', phone: '', city: '' },
  });
  const [accepted, setAccepted] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const submit = useSubmitSupplierLead();

  const title = live
    ? live.referrerName ? t('join.titleBy', { name: live.referrerName }) : t('join.titleHidden')
    : t('join.titleGeneric');

  async function send() {
    if (!notice || !form.validate()) return;
    setFailure(null);
    const blank = (value: string) => value.trim() || undefined;
    try {
      await submit.mutateAsync({
        data: {
          // Погашенный код не отправляется: сервер ответил бы «не найдено», а заявка нужна и так.
          code: live ? code : undefined,
          name: form.values.name.trim(),
          binIin: blank(form.values.binIin),
          phone: form.values.phone.trim(),
          city: blank(form.values.city),
          consentVersion: notice.version,
        },
      });
      setSent(true);
    } catch (error) {
      form.applyServerFault(error);
      setFailure(failureKey(error));
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <LanguageAsk />
      <Card className="flex w-full max-w-[460px] flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <Logo variant="mark" height={22} decorative />
          <div>
            <div className="text-sm font-semibold leading-tight text-ink">Q-Order</div>
            <div className="text-2xs leading-4 text-ink-faint">{t('brand.tagline')}</div>
          </div>
          <div className="ml-auto"><LanguagePicker /></div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>

        {expired && (
          <p className="rounded-[var(--radius-control)] border border-hairline bg-sunk px-3 py-2 text-sm text-ink">
            {t('join.expired')}
          </p>
        )}

        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-muted">
          <li>{t('join.benefit1')}</li>
          <li>{t('join.benefit2')}</li>
          <li>{t('join.benefit3')}</li>
        </ul>

        {sent ? (
          <p role="status" className="rounded-[var(--radius-control)] bg-accent-soft px-3 py-3 text-base font-medium text-accent-ink">
            {t('join.thanks')}
          </p>
        ) : (
          <>
            {FIELDS.map((field) => (
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

            {notice && (
              <div className="flex flex-col gap-2">
                <details className="rounded-[var(--radius-control)] border border-hairline bg-surface p-3">
                  <summary className="cursor-pointer text-sm font-medium text-ink">{t('join.consentTitle')}</summary>
                  <div className="mt-3 max-h-[26rem] overflow-y-auto pr-1">
                    <ConsentNotice text={notice.text} />
                  </div>
                </details>
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.currentTarget.checked)}
                    className="mt-0.5 size-5 accent-[var(--color-brand)]"
                  />
                  <span>{t('join.consentAccept')}</span>
                </label>
              </div>
            )}

            {failure && (
              <p role="alert" className="rounded-[var(--radius-control)] border border-gone/30 bg-gone/8 px-3 py-2 text-sm text-ink">
                {t(failure)}
              </p>
            )}

            <Button
              size="lg"
              disabled={!accepted || !notice || !form.isValid || submit.isPending}
              onClick={() => void send()}
            >
              {submit.isPending ? t('join.sending') : t('join.send')}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

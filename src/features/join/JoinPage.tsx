import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Logo } from '../../ui/Logo';
import { cn } from '../../ui/cn';
import { FieldFaultText } from '../../ui/Field';
import { faultOf, useFormRules } from '../../ui/forms/useFormRules';
import { rules } from '../../api/rules.generated';
import { isGone } from '../../api/client';
import {
  useGetSupplierConsentNotice,
  useGetSupplierJoin,
  useSubmitSupplierLead,
} from '../../api/generated';
import { ConsentBlock, useConsent } from '../activation/Consent';
import { KZ_PHONE } from './kzPhone';
import { LanguageAsk } from '../language/LanguageAsk';
import { LanguagePicker } from '../shell/LanguagePicker';
import { ForwardToOwner } from './ForwardToOwner';
import { signupHref } from './JoinOwnerPage';
import { OpenInApp } from '../openInApp/OpenInApp';
import { PhoneQr } from '../openInApp/PhoneQr';

const INPUT = cn(
  'h-14 rounded-[var(--radius-control)] border-2 border-field-line bg-surface px-4',
  'text-base text-ink outline-none focus:border-shop focus:ring-1 focus:ring-shop',
);

type Key = 'name' | 'binIin' | 'phone' | 'city';
const FIELDS: { key: Key; label: string; inputMode?: 'numeric' | 'tel'; autoComplete?: string }[] = [
  { key: 'name', label: 'join.name', autoComplete: 'organization' },
  { key: 'binIin', label: 'join.bin', inputMode: 'numeric' },
  { key: 'phone', label: 'join.phone', inputMode: 'tel', autoComplete: 'tel' },
  { key: 'city', label: 'join.city', autoComplete: 'address-level2' },
];

const SCHEMA = {
  ...rules.SupplierLeadRequest,
  phone: { ...rules.SupplierLeadRequest.phone, pattern: KZ_PHONE },
};

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
  // «Не действует» — только когда сервер так сказал; обрыв сети приглашение не гасит.
  const expired = !!code && invite.isError && isGone(invite.error);
  const consent = useConsent(useGetSupplierConsentNotice({ query: { retry: 1 } }));
  const { notice } = consent;
  const form = useFormRules({
    schema: SCHEMA,
    initial: { name: '', binIin: '', phone: '', city: '' },
  });
  const [sent, setSent] = useState(false);
  // По живому приглашению сначала «Кто вы»: владелец подключается сам, продавец передаёт владельцу.
  // Заявка платформе — запасной путь, а без приглашения — единственный.
  const [step, setStep] = useState<'who' | 'seller' | 'lead'>('who');
  const shown = live ? step : 'lead';
  const [failure, setFailure] = useState<string | null>(null);
  const submit = useSubmitSupplierLead();

  // Почему кнопка погашена — словами под ней: серая без причины выглядит сломанной.
  // Поля называются по имени: «отмеченных выше» нет, пока человек их не трогал.
  const unfilled = FIELDS.filter((field) => faultOf(SCHEMA[field.key], form.values[field.key])).map((field) => t(field.label));
  const why = unfilled.length ? t('join.why.fields', { list: unfilled.join(', ') })
    : consent.why ? t(consent.why) : null;


  async function send() {
    if (!notice || !form.validate()) return;
    setFailure(null);
    const blank = (value: string) => value.trim() || undefined;
    try {
      await submit.mutateAsync({
        data: {
          // Погашенный код не отправляется: сервер ответил бы «не найдено», а заявка нужна и так.
          code: code && !expired ? code : undefined,
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
    <div className="flex min-h-dvh items-center justify-center gap-6 p-4">
      <LanguageAsk />
      <Card className="flex w-full max-w-[460px] flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <Logo variant="mark" height={36} decorative />
          <div>
            <div className="text-lg font-extrabold leading-tight text-ink">Q-Order</div>
            <div className="text-2xs leading-4 text-ink-faint">{t('brand.tagline')}</div>
          </div>
          <div className="ml-auto"><LanguagePicker /></div>
        </div>
        {/* Без кода приглашения нет — приложению нечего открыть. */}
        {code ? <OpenInApp /> : null}

        {/* По макету SimplePicInvLanding: общий заголовок, а кто позвал — карточкой под ним. */}
        <h1 className="text-display font-extrabold leading-tight text-ink">{t('join.headline')}</h1>

        {live && (
          <div data-testid="join-inviter" className="flex items-center gap-3 rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface p-3">
            <span aria-hidden="true" className="flex size-[3.25rem] shrink-0 items-center justify-center rounded-2xl bg-sale-ink text-title font-extrabold text-on-sale">
              {(live.referrerName ?? '?').replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '?'}
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-ink-muted">{t('join.invitedBy')}</span>
              <span className="block text-lead font-extrabold leading-tight text-ink">{live.referrerName ?? t('join.oneOfClients')}</span>
              <span className="block text-sm text-ink-muted">{t('join.yourClient')}</span>
            </span>
          </div>
        )}

        {expired && (
          <p className="rounded-[var(--radius-control)] border border-hairline bg-sunk px-3 py-2 text-sm text-ink">
            {t('join.expired')}
          </p>
        )}

        <p className="m-0 text-base leading-snug text-ink">{t('join.lead')}</p>

        {shown === 'who' ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink">{t('join.who.title')}</h2>
            {/* Без адреса рабочего места подключаться некуда — владельцу остаётся заявка ниже. */}
            {signupHref('ref', code ?? '') ? (
              <Button size="lg" asChild className="h-auto flex-col items-start gap-0.5 whitespace-normal py-3 text-left">
                <a href={signupHref('ref', code ?? '') ?? undefined}>
                  <span>{t('join.who.owner')}</span>
                  <span className="text-sm font-normal opacity-90">{t('join.who.ownerHint')}</span>
                </a>
              </Button>
            ) : null}
            <Button size="lg" variant="outline" className="h-auto flex-col items-start gap-0.5 whitespace-normal py-3 text-left"
              onClick={() => setStep('seller')}>
              <span>{t('join.who.seller')}</span>
              <span className="text-sm font-normal text-ink-muted">{t('join.who.sellerHint')}</span>
            </Button>
            <Button variant="soft" className="h-auto whitespace-normal py-3" onClick={() => setStep('lead')}>{t('join.who.lead')}</Button>
          </div>
        ) : shown === 'seller' ? (
          <ForwardToOwner code={code ?? ''} onBack={() => setStep('who')} />
        ) : sent ? (
          <p role="status" className="rounded-[var(--radius-control)] bg-accent-soft px-3 py-3 text-base font-medium text-accent-ink">
            {t('join.thanks')}
          </p>
        ) : (
          <>
            {FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-${field.key}`} className="text-sm font-medium text-ink">
                  {t(field.label)}
                  {SCHEMA[field.key].required ? null : <span className="font-normal text-ink-faint"> {t('join.optional')}</span>}
                </label>
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

            <ConsentBlock consent={consent} />

            {failure && (
              <p role="alert" className="rounded-[var(--radius-control)] border border-gone/30 bg-gone/8 px-3 py-2 text-sm text-ink">
                {t(failure)}
              </p>
            )}

            <Button
              size="lg"
              disabled={!!why || submit.isPending}
              aria-describedby={why ? `${id}-why` : undefined}
              onClick={() => void send()}
            >
              {submit.isPending ? t('join.sending') : t('join.send')}
            </Button>
            {why && <p id={`${id}-why`} className="text-base text-ink-muted">{why}</p>}
          </>
        )}
      </Card>
      {/* Монитор: открыли на компьютере — QR переносит ссылку на телефон. */}
      {code ? <PhoneQr /> : null}
    </div>
  );
}

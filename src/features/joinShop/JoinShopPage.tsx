import { intlLocale } from '../../i18n';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { FieldFaultText } from '../../ui/Field';
import { useFormRules } from '../../ui/forms/useFormRules';
import { rules } from '../../api/rules.generated';
import {
  useCreateAccessRequest,
  useGetAccessRequestStatus,
  useGetJoinShop,
  useGetPortalConsentNotice,
  useResendAccessRequestCode,
  useSetAccessRequestPassword,
  type ConsentNoticeDto,
  type JoinRequestCreatedDto,
  type JoinRequestStatusDto,
  type PhoneCodeDto,
} from '../../api/generated';
import { ConsentNotice } from '../activation/ConsentNotice';
import { LanguageAsk } from '../language/LanguageAsk';
import { PublicShowcase } from './PublicShowcase';
import { LanguagePicker } from '../shell/LanguagePicker';

const INPUT = cn(
  'h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3',
  'text-sm text-ink outline-none focus:border-[var(--color-brand)]',
);

type Key = 'phone' | 'companyName' | 'bin' | 'city';
const FIELDS: { key: Key; label: string; inputMode?: 'numeric' | 'tel'; autoComplete?: string }[] = [
  { key: 'phone', label: 'joinShop.phone', inputMode: 'tel', autoComplete: 'tel' },
  { key: 'companyName', label: 'joinShop.company', autoComplete: 'organization' },
  { key: 'bin', label: 'joinShop.bin', inputMode: 'numeric' },
  { key: 'city', label: 'joinShop.city', autoComplete: 'address-level2' },
];

/**
 * Токен заявки сервер отдаёт один раз — страница помнит его сама: гость закрывает вкладку,
 * пока магазин думает, и возвращается по той же ссылке. Хранилище может быть недоступно
 * (приватный режим) — тогда страница работает, но не вспомнит заявку после закрытия.
 */
const tokenKey = (code: string) => `qo.portal.joinShop.${code}`;
function readToken(code: string): string | null {
  try { return localStorage.getItem(tokenKey(code)); } catch { return null; }
}
function writeToken(code: string, token: string | null) {
  try {
    if (token) localStorage.setItem(tokenKey(code), token);
    else localStorage.removeItem(tokenKey(code));
  } catch { /* без памяти — только в этой вкладке */ }
}
/**
 * Код помним тоже: на телефоне гость уходит в WhatsApp, и браузер, вернувшись,
 * часто перезагружает вкладку — без памяти он увидел бы «получите код» вместо своего.
 */
function readPhoneCode(code: string): PhoneCodeDto | null {
  try {
    const raw = localStorage.getItem(`${tokenKey(code)}.code`);
    return raw ? (JSON.parse(raw) as PhoneCodeDto) : null;
  } catch { return null; }
}
function writePhoneCode(code: string, phoneCode: PhoneCodeDto | null) {
  try {
    if (phoneCode) localStorage.setItem(`${tokenKey(code)}.code`, JSON.stringify(phoneCode));
    else localStorage.removeItem(`${tokenKey(code)}.code`);
  } catch { /* без памяти — только в этой вкладке */ }
}

function codeOf(error: unknown): string | undefined {
  const code = (error as { info?: { code?: unknown } } | null)?.info?.code;
  return typeof code === 'string' ? code : undefined;
}

/** Текст отказа — свой у тех, что гостю есть чем исправить; незнакомый код — общий. */
function failureKey(error: unknown): string {
  switch (codeOf(error)) {
    case 'ACCESS_REQUEST_LIMIT': return 'joinShop.tooOften';
    case 'PHONE_CODE_LIMIT': return 'joinShop.codeLimit';
    case 'PHONE_CODE_NO_CHANNEL': return 'joinShop.noChannel';
    case 'CONSENT_OUTDATED': return 'join.consentOutdated';
    case 'SHOP_LINK_NOT_FOUND': return 'joinShop.linkGone';
    default: return 'joinShop.failed';
  }
}

/**
 * Заявка в магазин по его ссылке — без входа (backend.md §18.28, п. 6): гость оставляет номер
 * и реквизиты, подтверждает номер кодом в WhatsApp, магазин одобряет, гость задаёт пароль.
 * Система первой не пишет: код уходит магазину с телефона гостя готовой ссылкой `wa.me`.
 */
export function JoinShopPage() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const shop = useGetJoinShop(code, { query: { enabled: !!code, retry: false } });
  const info = shop.data?.status === 200 ? shop.data.data : undefined;
  const [token, setTokenState] = useState<string | null>(() => (code ? readToken(code) : null));
  const [phoneCode, setPhoneCodeState] = useState<PhoneCodeDto | null>(() => (code ? readPhoneCode(code) : null));
  const setPhoneCode = (next: PhoneCodeDto | null) => { writePhoneCode(code, next); setPhoneCodeState(next); };
  const setToken = (next: string | null) => { writeToken(code, next); setTokenState(next); };

  return (
    <Screen after={info?.showcase && !token ? (
      <PublicShowcase code={code} onRequest={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
    ) : null}>
      {info?.logoUrl ? <img src={info.logoUrl} alt="" className="h-14 w-14 rounded-[var(--radius-control)] object-contain" /> : null}
      {shop.isError || !code ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{t('joinShop.linkGoneTitle')}</h1>
          <p className="text-sm text-ink-muted">{t('joinShop.linkGone')}</p>
        </>
      ) : !info ? (
        <p className="text-sm text-ink-muted">{t('joinShop.loading')}</p>
      ) : token ? (
        <RequestState
          code={code} token={token} shopName={info.shopName} phoneCode={phoneCode} onPhoneCode={setPhoneCode}
          onForget={() => { setToken(null); setPhoneCode(null); }}
        />
      ) : (
        <RequestForm
          code={code} shopName={info.shopName}
          onCreated={(created) => { setPhoneCode(created.phoneCode); setToken(created.token); }}
        />
      )}
    </Screen>
  );
}

function RequestForm({ code, shopName, onCreated }: { code: string; shopName: string; onCreated: (created: JoinRequestCreatedDto) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const noticeQuery = useGetPortalConsentNotice();
  const notice: ConsentNoticeDto | undefined = noticeQuery.data?.status === 200 ? noticeQuery.data.data : undefined;
  const form = useFormRules({
    schema: rules.AccessRequestRequest,
    // Редакцию согласия форма не спрашивает — её подставляет отправка из прочитанного уведомления.
    initial: { phone: '', companyName: '', bin: '', city: '', consentVersion: 'notice' },
  });
  const [accepted, setAccepted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const create = useCreateAccessRequest();

  async function send() {
    if (!notice || !form.validate()) return;
    setFailure(null);
    try {
      const response = await create.mutateAsync({
        code,
        data: {
          phone: form.values.phone,
          companyName: form.values.companyName.trim(),
          bin: form.values.bin.trim() || undefined,
          city: form.values.city.trim(),
          consentVersion: notice.version,
        },
      });
      if (response.status === 201) onCreated(response.data);
    } catch (error) {
      form.applyServerFault(error);
      setFailure(failureKey(error));
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('joinShop.title', { shop: shopName })}</h1>
      <p className="text-sm text-ink-muted">{t('joinShop.lead')}</p>
      {FIELDS.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-${field.key}`} className="text-sm font-medium text-ink">{t(field.label)}</label>
          <input
            id={`${id}-${field.key}`}
            value={form.values[field.key]}
            inputMode={field.inputMode}
            autoComplete={field.autoComplete}
            placeholder={field.key === 'phone' ? '+7 701 123 45 67' : undefined}
            aria-invalid={form.faults[field.key] ? 'true' : 'false'}
            // Номер — только цифры и «+»: пробелы и скобки, которые люди набирают по привычке, сервер не примет.
            onChange={(event) => form.field(field.key).onChange(
              field.key === 'phone' ? event.currentTarget.value.replace(/[^\d+]/g, '') : event.currentTarget.value,
            )}
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

      {failure && <Alert>{t(failure)}</Alert>}

      <Button size="lg" disabled={!accepted || !notice || create.isPending} onClick={() => void send()}>
        {create.isPending ? t('joinShop.sending') : t('joinShop.send')}
      </Button>
    </>
  );
}

/**
 * Что с заявкой сейчас. Пока ждём код — спрашиваем раз в 2 секунды (так просит сервер):
 * гость отправил сообщение в WhatsApp и вернулся — страница уже на следующем шаге.
 * У магазина заявка может лежать часами — там реже.
 */
function RequestState({ code, token, shopName, phoneCode, onPhoneCode, onForget }: {
  code: string; token: string; shopName: string;
  phoneCode: PhoneCodeDto | null; onPhoneCode: (next: PhoneCodeDto) => void; onForget: () => void;
}) {
  const { t } = useTranslation();
  const query = useGetAccessRequestStatus(code, token, {
    query: {
      retry: false,
      refetchInterval: (q) => {
        const status = (q.state.data as { data?: JoinRequestStatusDto } | undefined)?.data?.status;
        return status === 'UNVERIFIED' ? 2_000 : status === 'PENDING' ? 15_000 : false;
      },
    },
  });
  const state = query.data?.status === 200 ? (query.data.data as JoinRequestStatusDto) : undefined;

  // Заявки по токену больше нет (или ссылку перевыпустили) — начинаем заново, а не висим на ошибке.
  if (query.isError) {
    return (
      <>
        <Alert>{t('joinShop.lost')}</Alert>
        <Button size="lg" onClick={onForget}>{t('joinShop.again')}</Button>
      </>
    );
  }
  if (!state) return <p className="text-sm text-ink-muted">{t('joinShop.loading')}</p>;

  switch (state.status) {
    case 'UNVERIFIED':
      return <ConfirmPhone code={code} token={token} phoneCode={phoneCode} onPhoneCode={onPhoneCode} />;
    case 'PENDING':
      return (
        <>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{t('joinShop.pendingTitle')}</h1>
          <p className="text-sm text-ink-muted">{t('joinShop.pending', { shop: shopName })}</p>
        </>
      );
    case 'DECLINED':
      return (
        <>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{t('joinShop.declinedTitle', { shop: shopName })}</h1>
          {state.reason ? <p className="rounded-[var(--radius-control)] bg-sunk px-3 py-2 text-sm text-ink">{state.reason}</p> : null}
          <p className="text-sm text-ink-muted">{t('joinShop.declined')}</p>
        </>
      );
    case 'APPROVED':
      return state.passwordNeeded
        ? <SetPassword code={code} token={token} shopName={shopName} />
        : <Approved shopName={shopName} hint={t('joinShop.ownPassword')} />;
    default:
      return <Alert>{t('joinShop.failed')}</Alert>;
  }
}

function ConfirmPhone({ code, token, phoneCode, onPhoneCode }: {
  code: string; token: string; phoneCode: PhoneCodeDto | null; onPhoneCode: (next: PhoneCodeDto) => void;
}) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<string | null>(null);
  const resend = useResendAccessRequestCode();
  // Код выдаётся при создании заявки; вернувшемуся по ссылке его не прислать — только новый.
  const fresh = phoneCode && new Date(phoneCode.expiresAt).getTime() > Date.now() ? phoneCode : null;

  async function again() {
    setFailure(null);
    try {
      const response = await resend.mutateAsync({ code, token });
      if (response.status === 200) onPhoneCode(response.data as PhoneCodeDto);
    } catch (error) {
      setFailure(failureKey(error));
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{t('joinShop.confirmTitle')}</h1>
      {fresh ? (
        <>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-ink">
            <li>{t('joinShop.confirmStep1')}</li>
            <li>{t('joinShop.confirmStep2', { code: fresh.code })}</li>
            <li>{t('joinShop.confirmStep3')}</li>
          </ol>
          <a
            href={fresh.waLink} target="_blank" rel="noreferrer" data-testid="join-shop-wa"
            className="flex h-12 items-center justify-center rounded-[var(--radius-control)] bg-[#25D366] px-4 text-base font-semibold text-white"
          >
            {t('joinShop.openWhatsApp')}
          </a>
          <p className="text-center text-xs text-ink-muted">
            {t('joinShop.codeIs', { code: fresh.code, time: new Date(fresh.expiresAt).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' }) })}
          </p>
          <p role="status" className="text-center text-xs text-ink-faint">{t('joinShop.waiting')}</p>
        </>
      ) : (
        <p className="text-sm text-ink-muted">{t('joinShop.needNewCode')}</p>
      )}
      {failure && <Alert>{t(failure)}</Alert>}
      {/* Новый код — тихой ссылкой с переносом: кнопкой во всю ширину длинная подпись не помещалась на телефоне. */}
      {fresh ? (
        <button type="button" disabled={resend.isPending} onClick={() => void again()}
          className="min-h-11 text-center text-sm font-semibold text-accent-ink underline underline-offset-2 disabled:opacity-50">
          {t('joinShop.newCode')}
        </button>
      ) : (
        <Button size="lg" disabled={resend.isPending} onClick={() => void again()}>{t('joinShop.getCode')}</Button>
      )}
    </>
  );
}

function SetPassword({ code, token, shopName }: { code: string; token: string; shopName: string }) {
  const { t } = useTranslation();
  const form = useFormRules({ schema: rules.JoinPasswordRequest, initial: { password: '' } });
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const save = useSetAccessRequestPassword();

  async function send() {
    if (!form.validate()) return;
    setFailure(null);
    try {
      await save.mutateAsync({ code, token, data: { password: form.values.password } });
      setDone(true);
    } catch (error) {
      // Пароль уже задан (вторая вкладка) — это не беда: дальше обычный вход.
      if (codeOf(error) === 'ACCESS_REQUEST_PASSWORD_SET') setDone(true);
      else { form.applyServerFault(error); setFailure(failureKey(error)); }
    }
  }

  if (done) return <Approved shopName={shopName} hint={t('joinShop.passwordSaved')} />;
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{t('joinShop.approvedTitle', { shop: shopName })}</h1>
      <p className="text-sm text-ink-muted">{t('joinShop.setPassword')}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="join-shop-password" className="text-sm font-medium text-ink">{t('activation.passwordLabel')}</label>
        <input
          id="join-shop-password" type="password" autoComplete="new-password"
          value={form.values.password}
          aria-invalid={form.faults.password ? 'true' : 'false'}
          onChange={(event) => form.field('password').onChange(event.currentTarget.value)}
          onBlur={form.field('password').onBlur}
          className={INPUT}
        />
        <FieldFaultText fault={form.faults.password} name="password" />
        <p className="text-xs text-ink-muted">{t('activation.passwordNote')}</p>
      </div>
      {failure && <Alert>{t(failure)}</Alert>}
      <Button size="lg" disabled={save.isPending} onClick={() => void send()}>{t('joinShop.savePassword')}</Button>
    </>
  );
}

/** Доступ открыт — дальше обычный вход: логин — номер из заявки. */
function Approved({ shopName, hint }: { shopName: string; hint: string }) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{t('joinShop.approvedTitle', { shop: shopName })}</h1>
      <p className="text-sm text-ink-muted">{hint}</p>
      {/* Полный переход: вход начинает защищённая часть кабинета и вернёт гостя в каталог. */}
      <Button size="lg" onClick={() => window.location.assign('/catalog')}>{t('joinShop.signIn')}</Button>
    </>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-[var(--radius-control)] border border-gone/30 bg-gone/8 px-3 py-2 text-sm text-ink">{children}</p>
  );
}

function Screen({ children, after }: { children: React.ReactNode; after?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <LanguageAsk />
      <Card className="flex w-full max-w-[460px] flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <span className="text-2xs leading-4 text-ink-faint">{t('joinShop.via')}</span>
          <div className="ml-auto"><LanguagePicker /></div>
        </div>
        {children}
      </Card>
      {after}
    </div>
  );
}

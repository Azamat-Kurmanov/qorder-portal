import { intlLocale } from '../../i18n';
import { isGone, statusOf } from '../../api/client';
import { useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { sizedPhoto } from '../../ui/sizedPhoto';
import { Clock, Eye, Maximize2, MessageCircle, Minimize2 } from '../../ui/icons';
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
  type JoinRequestCreatedDto,
  type JoinRequestStatusDto,
  type PhoneCodeDto,
} from '../../api/generated';
import { ConsentBlock, useConsent } from '../activation/Consent';
import { LanguageAsk } from '../language/LanguageAsk';
import { PublicShowcase } from './PublicShowcase';
import { SharedIntro, shareOf } from './SharedIntro';
import { LanguagePicker } from '../shell/LanguagePicker';
import { OpenInApp } from '../openInApp/OpenInApp';
import { formatPhone } from '../../shared/phone';

const INPUT = cn(
  'h-14 rounded-[var(--radius-control)] border-2 border-field-line bg-surface px-4',
  'text-base text-ink outline-none focus:border-shop focus:ring-1 focus:ring-shop',
);

type Key = 'companyName' | 'bin' | 'city';
type Kind = 'company' | 'person';
/**
 * Поля по ответу «кто вы»: БИН/ИИН — только у компании и ИП; ИИН частного лица собирать нельзя.
 * Номера нет: им станет номер, с которого в WhatsApp придёт код, — ошибиться в цифрах негде.
 */
function fieldsOf(kind: Kind): { key: Key; label: string; inputMode?: 'numeric' | 'tel'; autoComplete?: string }[] {
  return [
    kind === 'company'
      ? { key: 'companyName', label: 'joinShop.company', autoComplete: 'organization' }
      : { key: 'companyName', label: 'joinShop.personName', autoComplete: 'name' },
    ...(kind === 'company' ? [{ key: 'bin' as const, label: 'joinShop.bin', inputMode: 'numeric' as const }] : []),
    { key: 'city', label: 'joinShop.city', autoComplete: 'address-level2' },
  ];
}
/** У компании БИН/ИИН обязателен; у частного лица поля нет, и правило пустому значению не мешает. */
const { phone: _phone, ...PERSON_RULES } = rules.AccessRequestRequest;
const COMPANY_RULES = { ...PERSON_RULES, bin: { ...rules.AccessRequestRequest.bin, required: true } };

/** Последнее непустое значение: перезагрузка после смены языка не должна стирать форму на экране. */
function useLast<T>(value: T | undefined): T | undefined {
  const last = useRef(value);
  if (value !== undefined) last.current = value;
  return last.current;
}

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
  const [params] = useSearchParams();
  const share = shareOf(params);
  const shop = useGetJoinShop(code, { query: { enabled: !!code, retry: false } });
  const info = useLast(shop.data?.status === 200 ? shop.data.data : undefined);
  const [token, setTokenState] = useState<string | null>(() => (code ? readToken(code) : null));
  const [phoneCode, setPhoneCodeState] = useState<PhoneCodeDto | null>(() => (code ? readPhoneCode(code) : null));
  const setPhoneCode = (next: PhoneCodeDto | null) => { writePhoneCode(code, next); setPhoneCodeState(next); };
  const setToken = (next: string | null) => { writeToken(code, next); setTokenState(next); };

  return (
    <Screen behind={info?.showcase && !token ? (
      <PublicShowcase code={code} categoryId={share?.kind === 'c' ? share.categoryId : undefined} novelty={share?.kind === 'new'}
        personal={Boolean(info?.managerName)} />
    ) : null}>
      {info ? (
        // «Вариант Б»: знак магазина и его имя — гость сразу видит, куда подаёт заявку.
        <div className="flex items-center gap-3.5">
          {info.logoUrl
            ? <img src={sizedPhoto(info.logoUrl, 112)} alt="" className="size-14 shrink-0 rounded-2xl object-contain" />
            : <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-shop text-title font-extrabold text-on-shop">{info.shopName.trim().charAt(0).toUpperCase()}</span>}
          <b className="min-w-0 text-lead font-extrabold leading-tight text-ink">{info.shopName}</b>
        </div>
      ) : null}
      {shop.isError && !isGone(shop.error) ? (
        // Сеть или сервер, а не ссылка: «ссылка не работает» отправило бы человека к магазину зря.
        <>
          <h1 className="text-display font-extrabold leading-tight text-ink">{t('joinShop.offlineTitle')}</h1>
          <p role="alert" className="text-base text-ink-muted">
            {t(failedLoadKey(shop.error))}
          </p>
          <Button size="lg" onClick={() => void shop.refetch()}>{t('common.retry')}</Button>
        </>
      ) : shop.isError || !code ? (
        <>
          <h1 className="text-display font-extrabold leading-tight text-ink">{t('joinShop.linkGoneTitle')}</h1>
          <p className="text-base text-ink-muted">{t('joinShop.linkGone')}</p>
          {/* Не тупик: уже подключённый клиент входит в кабинет отсюда. */}
          <Button size="lg" onClick={() => window.location.assign('/catalog')}>{t('joinShop.signIn')}</Button>
        </>
      ) : !info ? (
        <p className="text-base text-ink-muted">{t('joinShop.loading')}</p>
      ) : token ? (
        <RequestState
          code={code} token={token} shopName={info.shopName} phoneCode={phoneCode} onPhoneCode={setPhoneCode}
          onForget={() => { setToken(null); setPhoneCode(null); }}
        />
      ) : (
        <>
        {share ? <SharedIntro code={code} share={share} supplierId={info.supplierId} showcase={info.showcase} /> : null}
        <RequestForm
          code={code} shopName={info.shopName} managerName={info.managerName}
          onCreated={(created) => { setPhoneCode(created.phoneCode); setToken(created.token); }}
        />
        </>
      )}
    </Screen>
  );
}

function RequestForm({ code, shopName, managerName, onCreated }: {
  code: string; shopName: string; managerName?: string; onCreated: (created: JoinRequestCreatedDto) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const consent = useConsent(useGetPortalConsentNotice({ query: { retry: 1 } }));
  const { notice } = consent;
  const [kind, setKind] = useState<Kind | null>(null);
  const form = useFormRules({
    schema: kind === 'company' ? COMPANY_RULES : PERSON_RULES,
    // Редакцию согласия форма не спрашивает — её подставляет отправка из прочитанного уведомления.
    initial: { companyName: '', bin: '', city: '', consentVersion: 'notice' },
  });
  const [failure, setFailure] = useState<string | null>(null);
  const create = useCreateAccessRequest();

  // Почему кнопка погашена — словами под ней.
  const whyKey = !kind ? 'joinShop.whyKind' : consent.why;

  async function send() {
    if (!notice || !form.validate()) return;
    setFailure(null);
    try {
      const response = await create.mutateAsync({
        code,
        data: {
          companyName: form.values.companyName.trim(),
          bin: kind === 'company' ? form.values.bin.trim() : undefined,
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
      {/* Личная ссылка продавца (этап 6): одобрения нет — кабинет откроется, как только номер подтверждён. */}
      <h1 className="text-display font-extrabold leading-tight text-ink">
        {t(managerName ? 'joinShop.personalTitle' : 'joinShop.title', { shop: shopName })}
      </h1>
      {managerName ? (
        <p className="m-0 rounded-[var(--radius-control)] bg-accent-soft px-3 py-2 text-base text-ink">
          {t('joinShop.yourManager')} <b>{managerName}</b>
        </p>
      ) : null}
      <p className="text-base text-ink-muted">{t(managerName ? 'joinShop.personalLead' : 'joinShop.lead')}</p>
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 p-0 text-body font-extrabold text-ink">{t('joinShop.who')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['company', 'person'] as const).map((option) => (
            <label key={option} className={cn(
              'flex min-h-14 cursor-pointer items-center justify-center rounded-[1.25rem] border-[3px] border-solid px-3 py-2 text-center text-body font-extrabold leading-tight',
              'focus-within:ring-2 focus-within:ring-accent',
              kind === option ? 'border-shop bg-ok-soft text-ok-ink' : 'border-line bg-surface text-ink',
            )}>
              <input type="radio" name={`${id}-kind`} checked={kind === option} onChange={() => setKind(option)}
                className="sr-only" />
              {t(option === 'company' ? 'joinShop.whoCompany' : 'joinShop.whoPerson')}
            </label>
          ))}
        </div>
      </fieldset>
      {kind && fieldsOf(kind).map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-${field.key}`} className="text-body font-extrabold text-ink">{t(field.label)}</label>
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

      {failure && <Alert>{t(failure)}</Alert>}

      <Button size="lg" className="h-16 w-full rounded-[1.375rem] text-lead" disabled={!!whyKey || create.isPending} aria-describedby={whyKey ? `${id}-why` : undefined} onClick={() => void send()}>
        {create.isPending ? t('joinShop.sending') : t('joinShop.send')}
      </Button>
      {whyKey && <p id={`${id}-why`} className="text-base text-ink-muted">{t(whyKey)}</p>}
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
        // «Слишком часто» — не стучаться каждые две секунды.
        if (statusOf(q.state.error) === 429) return 60_000;
        const status = (q.state.data as { data?: JoinRequestStatusDto } | undefined)?.data?.status;
        return status === 'UNVERIFIED' ? 2_000 : status === 'PENDING' ? 15_000 : false;
      },
    },
  });
  const state = useLast(query.data?.status === 200 ? (query.data.data as JoinRequestStatusDto) : undefined);

  // Заявки по токену больше нет (или ссылку перевыпустили) — начинаем заново, а не висим на ошибке.
  // Только на 404/410: один оборванный опрос не повод предлагать стереть свою заявку.
  if (query.isError && isGone(query.error)) {
    return (
      <>
        <Alert>{t('joinShop.lost')}</Alert>
        <Button size="lg" onClick={onForget}>{t('joinShop.again')}</Button>
      </>
    );
  }
  if (!state) {
    return query.isError ? (
      <>
        <Alert>{t(failedLoadKey(query.error))}</Alert>
        <Button size="lg" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('common.retry')}</Button>
      </>
    ) : <p className="text-base text-ink-muted">{t('joinShop.loading')}</p>;
  }

  return (
    <>
      {/* Опрос сорвался — последний ответ на месте, следующий опрос попробует снова. */}
      <StateView
        state={state} code={code} token={token} shopName={shopName} phoneCode={phoneCode} onPhoneCode={onPhoneCode}
        note={query.isError ? <p role="status" className="text-base text-ink-muted">{t(pollLostKey(query.error))}</p> : null}
      />
    </>
  );
}

/** `note` — строка о сорвавшемся опросе: сразу под заголовком, а не под кнопками. Опрашиваются только «ждём» и «на рассмотрении». */
function StateView({ state, code, token, shopName, phoneCode, onPhoneCode, note }: {
  state: JoinRequestStatusDto; code: string; token: string; shopName: string;
  phoneCode: PhoneCodeDto | null; onPhoneCode: (next: PhoneCodeDto) => void; note: React.ReactNode;
}) {
  const { t } = useTranslation();
  switch (state.status) {
    case 'UNVERIFIED':
      return <ConfirmPhone code={code} token={token} phoneCode={phoneCode} onPhoneCode={onPhoneCode} note={note} />;
    case 'PENDING':
      return (
        <>
          <h1 className="text-display font-extrabold leading-tight text-ink">{t('joinShop.pendingTitle')}</h1>
          {note}
          <p className="text-base text-ink-muted">{t('joinShop.pending', { shop: shopName })}</p>
        </>
      );
    case 'DECLINED':
      return (
        <>
          <h1 className="text-display font-extrabold leading-tight text-ink">{t('joinShop.declinedTitle', { shop: shopName })}</h1>
          {state.reason ? <p className="rounded-[var(--radius-control)] bg-sunk px-3 py-2 text-sm text-ink">{state.reason}</p> : null}
          <p className="text-base text-ink-muted">{t('joinShop.declined')}</p>
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

function ConfirmPhone({ code, token, phoneCode, onPhoneCode, note }: {
  code: string; token: string; phoneCode: PhoneCodeDto | null; onPhoneCode: (next: PhoneCodeDto) => void; note?: React.ReactNode;
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
      <h1 className="text-display font-extrabold leading-tight text-ink">{t('joinShop.confirmTitle')}</h1>
      {note}
      {fresh ? (
        <>
          {/* «Вариант Б» (SimplePicJoinConfirm): шаги кружками, код крупно на тёмной плашке, большая зелёная кнопка. */}
          <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
            {[t('joinShop.confirmStep1'), t(fresh.fromPhone ? 'joinShop.confirmStep2From' : 'joinShop.confirmStep2', { code: fresh.code, phone: formatPhone(fresh.fromPhone ?? '') }), t('joinShop.confirmStep3')].map((step, index) => (
              <li key={index} className="flex items-start gap-3.5">
                <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-full text-lead font-extrabold',
                  index === 0 ? 'bg-shop text-on-shop' : 'bg-sunk text-ink-muted')}>{index + 1}</span>
                <span className="pt-2 text-lead leading-snug text-ink">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col items-center gap-1 rounded-[1.375rem] bg-night px-5 py-4 text-white">
            <span className="text-caption opacity-80">{t('joinShop.yourCode')}</span>
            <b className="text-hero font-extrabold tracking-[0.3em] tabular-nums">{fresh.code}</b>
            <span className="text-caption opacity-80">
              {t('joinShop.codeUntil', { time: new Date(fresh.expiresAt).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' }) })}
            </span>
          </div>
          {/* Опрос сорвался — «ждём» противоречил бы строке под заголовком. */}
          {note ? null : (
            <p role="status" className="m-0 flex items-center justify-center gap-2 text-body font-bold text-ink-muted">
              <Clock aria-hidden="true" className="size-5" />
              {t('joinShop.waiting')}
            </p>
          )}
          <a
            href={fresh.waLink} target="_blank" rel="noreferrer" data-testid="join-shop-wa"
            className="flex h-16 items-center justify-center gap-2.5 rounded-[1.375rem] bg-whatsapp px-4 text-lead font-extrabold text-white no-underline"
          >
            <MessageCircle aria-hidden="true" className="size-6" />
            {t('joinShop.openWhatsApp')}
          </a>
        </>
      ) : (
        <p className="text-base text-ink-muted">{t('joinShop.needNewCode')}</p>
      )}
      {failure && <Alert>{t(failure)}</Alert>}
      {/* Новый код — тихой ссылкой с переносом: кнопкой во всю ширину длинная подпись не помещалась на телефоне. */}
      {fresh ? (
        <button type="button" disabled={resend.isPending} onClick={() => void again()}
          className="min-h-11 cursor-pointer border-0 bg-transparent text-center text-body font-bold text-shop-ink underline-offset-2 hover:underline disabled:opacity-50">
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
  // Глазок — как на активации: придумывая пароль, человек должен видеть, что набирает.
  const [shown, setShown] = useState(false);

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
      <h1 className="text-display font-extrabold leading-tight text-ink">{t('joinShop.approvedTitle', { shop: shopName })}</h1>
      <p className="text-base text-ink-muted">{t('joinShop.setPassword')}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="join-shop-password" className="text-body font-extrabold text-ink">{t('activation.passwordLabel')}</label>
        <span className="relative flex">
          <input
            id="join-shop-password" type={shown ? 'text' : 'password'} autoComplete="new-password"
            value={form.values.password}
            aria-invalid={form.faults.password ? 'true' : 'false'}
            onChange={(event) => form.field('password').onChange(event.currentTarget.value)}
            onBlur={form.field('password').onBlur}
            className={cn(INPUT, 'w-full pr-14')}
          />
          <button type="button" aria-pressed={shown} aria-label={t(shown ? 'activation.hidePassword' : 'activation.showPassword')}
            onClick={() => setShown((was) => !was)}
            className="absolute inset-y-0 right-1 flex w-12 cursor-pointer items-center justify-center border-0 bg-transparent text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Eye aria-hidden="true" className="size-6" />
          </button>
        </span>
        <FieldFaultText fault={form.faults.password} name="password" />
        <p className="text-xs text-ink-muted">{t('activation.passwordNote')}</p>
      </div>
      {failure && <Alert>{t(failure)}</Alert>}
      <Button size="lg" disabled={save.isPending} onClick={() => void send()}>{t('joinShop.savePassword')}</Button>
    </>
  );
}

/** Доступ открыт — дальше обычный вход: логин — номер из заявки. */

/** Опрос статуса сорвался: сеть, сервер или «слишком часто» — следующий опрос попробует снова. */
function pollLostKey(error: unknown): string {
  const status = statusOf(error);
  if (status === undefined) return 'joinShop.pollLost';
  if (status === 429) return 'joinShop.pollTooOften';
  return status >= 500 ? 'joinShop.pollServer' : 'joinShop.pollRefused';
}

/** Чем объяснить, что страница не открылась: сеть, «слишком часто» или сервер. */
function failedLoadKey(error: unknown): string {
  const status = statusOf(error);
  if (status === undefined) return 'joinShop.offline';
  if (status === 429) return 'joinShop.tooManyTries';
  // 403 и прочие отказы — не «сервер лежит»: он ответил, но не пустил.
  return status >= 500 ? 'joinShop.serverDown' : 'joinShop.refused';
}

function Approved({ shopName, hint }: { shopName: string; hint: string }) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-display font-extrabold leading-tight text-ink">{t('joinShop.approvedTitle', { shop: shopName })}</h1>
      <p className="text-base text-ink-muted">{hint}</p>
      {/* Полный переход: вход начинает защищённая часть кабинета и вернёт гостя в каталог. */}
      <Button size="lg" onClick={() => window.location.assign('/catalog')}>{t('joinShop.signIn')}</Button>
    </>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="m-0 rounded-[var(--radius-control)] bg-sale-soft px-3.5 py-3 text-base font-semibold text-sale-ink">{children}</p>
  );
}

/**
 * Открытая витрина — каталог без цен фоном, а заявка окном поверх: гость сразу видит,
 * что здесь продают, но закрыть окно нельзя — только заполнить. Заявка ушла — окно
 * становится обычной карточкой (подтверждение номера, ожидание магазина).
 */
function Screen({ children, behind }: { children: React.ReactNode; behind?: React.ReactNode }) {
  const { t } = useTranslation();
  // На телефоне окно заявки сразу на весь экран: внизу на 60% экрана поля и согласие тесно.
  // «Свернуть» открывает витрину за окном, «Развернуть» возвращает. С планшета — обычное окно.
  const [full, setFull] = useState(() => !window.matchMedia('(min-width: 640px)').matches);
  const card = (extra?: string, resize?: boolean) => (
    // [&>*]:shrink-0 — окно ограничено по высоте и прокручивается, а не сжимает содержимое:
    // иначе кнопка (у неё overflow: hidden под блик) схлопывалась до нулевой высоты и не нажималась.
    <Card className={cn('flex w-full max-w-[30rem] flex-col gap-4 p-5 sm:p-7 [&>*]:shrink-0', extra)}>
      <div className="flex items-center gap-2">
        <span className="text-2xs leading-4 text-ink-faint">{t('joinShop.via')}</span>
        <div className="ml-auto"><LanguagePicker /></div>
        {resize && (
          <button type="button" onClick={() => setFull(!full)} aria-pressed={full}
            aria-label={t(full ? 'joinShop.collapse' : 'joinShop.expand')} title={t(full ? 'joinShop.collapse' : 'joinShop.expand')}
            className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-ink-muted hover:bg-ink/5 hover:text-ink">
            {full ? <Minimize2 className="size-5" aria-hidden="true" /> : <Maximize2 className="size-5" aria-hidden="true" />}
          </button>
        )}
      </div>
      <OpenInApp />
      {children}
    </Card>
  );
  if (!behind) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
        <LanguageAsk />
        {card()}
      </div>
    );
  }
  const keep = (event: Event) => event.preventDefault();
  return (
    <div className="flex min-h-dvh flex-col items-center gap-8 p-4">
      {behind}
      {/* Окно заявки — раньше вопроса о языке: открытый позже Radix-диалог лежит сверху и кликабелен. */}
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/40 dark:bg-black/60" />
          {/* Без автофокуса: иначе на кнопке языка вспыхивает рамка, а окно может открыться прокрученным. */}
          <Dialog.Content aria-describedby={undefined} onEscapeKeyDown={keep} onPointerDownOutside={keep} onInteractOutside={keep}
            onOpenAutoFocus={keep}
            className={cn('fixed inset-0 z-40 flex flex-col items-center overflow-y-auto p-3 outline-none sm:p-4', full && 'p-0 sm:p-0')}>
            <Dialog.Title className="sr-only">{t('joinShop.via')}</Dialog.Title>
            {/* На телефоне окно внизу и не выше 60% экрана, прокручивается само — сверху виден каталог.
                my-auto, а не justify-center: высокое окно прокручивается, а не срезается сверху. */}
            {/* Развёрнутое — на весь экран, свёрнутое возвращается к прежнему размеру.
                На широком экране поля отступами сжаты до ширины обычного окна — строка не растягивается на весь монитор. */}
            <div className={cn('flex w-full justify-center', full ? 'h-full' : 'mt-auto sm:my-auto')}>
              {full
                ? card('h-full max-w-none gap-3 overflow-y-auto rounded-none p-4 sm:gap-4 sm:p-6 sm:px-[max(1.5rem,calc((100%_-_412px)/2))]', true)
                : card('max-h-[60dvh] gap-3 overflow-y-auto p-4 sm:max-h-none sm:gap-4 sm:overflow-visible sm:p-6', true)}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <LanguageAsk />
    </div>
  );
}

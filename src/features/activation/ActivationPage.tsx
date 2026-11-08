import { useId, useState } from 'react';
import { ConsentBlock, useConsent } from './Consent';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Logo } from '../../ui/Logo';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Eye } from '../../ui/icons';
import { FieldFaultText } from '../../ui/Field';
import { useFormRules } from '../../ui/forms/useFormRules';
import { rules } from '../../api/rules.generated';
import {
  useActivatePortalInvitation,
  useGetPortalConsentNotice,
  usePreviewPortalInvitation,
  type AccountDto,
} from '../../api/generated';
import { useAuth } from '../../auth/useAuth';
import { LanguageAsk } from '../language/LanguageAsk';
import { LanguagePicker } from '../shell/LanguagePicker';
import { setCurrentSupplierId } from '../../supplier/supplier';
import { OpenInApp } from '../openInApp/OpenInApp';
import { ShopTile } from '../shell/ShopTile';

/**
 * Единственная страница кабинета, открытая без входа.
 *
 * Порядок здесь важнее вёрстки. Приглашённого впервые никто не просит войти,
 * потому что входить ему нечем: учётную запись завёл поставщик, пароля у неё
 * нет. Пароль человек придумывает прямо здесь, и владение кодом из ссылки
 * служит единственным доказательством личности — таково решение владельца,
 * и оно означает, что переславший ссылку не тому отдаёт кабинет.
 *
 * У кого пароль уже есть — а так бывает, когда пригласил и второй поставщик, —
 * тому приглашение пароля не меняет: сервер отвечает отказом, и страница
 * предлагает войти. Предлагает, а не утверждает: отказ один на все причины,
 * и сказать «код верен, просто вы уже зарегистрированы» страница не вправе.
 *
 * Разбирается ровно то, что сервер назвал сам своим кодом ошибки: пустой
 * пароль, частота попыток, недоступность службы. Всё прочее остаётся одним
 * отказом — просроченный, использованный, отозванный и несуществующий код
 * обязаны выглядеть одинаково, иначе форма превращается в способ узнать,
 * кто чей клиент.
 */
/**
 * Номер группами, как его читают вслух: 7 701 999-88-77.
 *
 * Ровно для показа. Отправлять нечего — сервер берёт номер из токена, — и
 * форматирование здесь ни на что, кроме глаз, не влияет.
 */
function phoneLabel(phone: string | null, unknown: string): string {
  if (phone === null) return unknown;
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 11) return phone;
  return `${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

/** Отказ, причину которого сервер не назвал: показываем общий текст. */
const REFUSAL_UNKNOWN = 'UNKNOWN';

/**
 * Код отказа из тела ответа.
 *
 * Мутатор запросов кладёт разобранное тело в `info` — оттуда и берётся код.
 * Всё, что не похоже на наш отказ, считается неназванной причиной: показать
 * «код истёк» там, где сервер этого не говорил, значит выдумать за него.
 */
function refusalCodeOf(error: unknown): string {
  const info = (error as { info?: { code?: unknown } } | null)?.info;
  return typeof info?.code === 'string' ? info.code : REFUSAL_UNKNOWN;
}

/** Текст отказа: свой у тех, что человеку есть чем исправить. */
function refusalTextKey(code: string): string {
  switch (code) {
    case 'PORTAL_PASSWORD_REQUIRED': return 'activation.passwordRequired';
    case 'PORTAL_TOO_MANY_ATTEMPTS': return 'activation.tooManyAttempts';
    case 'PORTAL_REALM_UNAVAILABLE': return 'activation.unavailable';
    // Текст согласия сменился, пока страница была открыта: тот же ответ, что у ссылки поставщика.
    case 'CONSENT_OUTDATED': return 'join.consentOutdated';
    default: return 'activation.failed';
  }
}

export function ActivationPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { authenticated, login, phone } = useAuth();

  /**
   * Код отказа, названный сервером, либо `null`. Не флаг: у трёх отказов есть
   * свой текст, и человеку по ним есть что исправить.
   */
  const [refusal, setRefusal] = useState<string | null>(null);
  /*
   * Пароль — на правиле контракта: потолок в 128 знаков объявлен там, и своё
   * число здесь стало бы второй записью того же правила. Обязательным поле
   * не объявлено намеренно: вошедший активирует приглашение без него.
   */
  const form = useFormRules({
    schema: rules.ActivateInvitationRequest,
    initial: { password: '' },
  });
  const password = form.values.password;
  const code = params.get('code') ?? '';

  // Уведомление читается до входа и без токена: учётной записи ещё нет,
  // а обработка не должна начаться раньше, чем человека о ней уведомили.
  // Согласие — на языке экрана; при смене языка даётся заново (см. useConsent).
  const consent = useConsent(useGetPortalConsentNotice({ query: { retry: 1 } }));
  // «Вас пригласил «Лето»» — по коду ссылки; негодный код просто не покажет магазин, отказ скажет активация.
  const preview = usePreviewPortalInvitation({ code }, { query: { enabled: !!code, retry: false, staleTime: Infinity } });
  const inviter = preview.data?.status === 200 ? preview.data.data : undefined;
  // Ссылку заперло частотой попыток: превью не скажет, нужен ли вход, и форма с паролем
  // без объяснения выглядела бы рабочей. Говорим то же, что сказала бы активация.
  const locked = preview.isError && refusalCodeOf(preview.error) === 'PORTAL_TOO_MANY_ATTEMPTS';
  const shownRefusal = refusal ?? (locked ? 'PORTAL_TOO_MANY_ATTEMPTS' : null);
  const { notice } = consent;
  const id = useId();
  const [shown, setShown] = useState(false);
  // Почему кнопка погашена — словами под ней; про длинный пароль скажет само поле.
  const why = consent.why;

  const activate = useActivatePortalInvitation({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) {
          setRefusal(REFUSAL_UNKNOWN);
          return;
        }
        // Поставщик известен из ответа: с этого момента кабинету есть что
        // ставить в заголовок каждого запроса.
        setCurrentSupplierId((response.data as AccountDto).supplierId);
        navigate('/catalog', { replace: true });
      },
      // Код ошибки приходит в теле отказа: мутатор кладёт разобранное тело
      // в `info`. Незнакомый код — общий отказ: выдумывать за сервер нельзя.
      onError: (error: unknown) => setRefusal(refusalCodeOf(error)),
    },
  });

  if (!code) {
    return (
      <Screen>
        <h1 className="text-display font-extrabold leading-tight text-ink">
          {t('activation.incomplete.title')}
        </h1>
        <p className="text-ink-muted">{t('activation.incomplete.note')}</p>
        {/* Не тупик: у кого кабинет уже есть, тот входит отсюда. */}
        <Button size="lg" onClick={login}>{t('activation.signIn')}</Button>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Знак вместо прежней точки: это первый экран системы, который видит
          приглашённый клиент, и назвать её здесь больше нечем. Изображение
          `decorative` — имя стоит надписью рядом. */}
      {/*
        Язык переключается прямо здесь: это единственный экран, открытый без
        входа, и человек, получивший ссылку, читает на нём уведомление
        об обработке данных. Согласие с русским текстом не является согласием
        с казахским — значит выбрать язык он обязан до того, как согласится.
      */}
      <div className="flex items-center gap-2">
        <Logo variant="mark" height={22} decorative />
        {/* Имя и лозунг в две строки, а не в одну: строка эта делится
            с переключателем языка, и в один ряд втроём они не помещаются
            на телефоне — имя усекалось бы первым. */}
        <div>
          <div className="text-sm font-semibold leading-tight text-ink">Q-Order</div>
          <div className="text-2xs leading-4 text-ink-faint">{t('brand.tagline')}</div>
        </div>
        <div className="ml-auto">
          <LanguagePicker />
        </div>
      </div>

      {inviter && (
        <div data-testid="activation-inviter" className="flex items-center gap-3.5">
          <ShopTile supplier={{ name: inviter.name, logoUrl: inviter.logoUrl }} initials className="size-16 shrink-0 rounded-2xl text-title" />
          <span className="min-w-0">
            <b className="block text-body font-extrabold text-ink-muted">{t('activation.invitedBy')}</b>
            <b className="block text-lead font-extrabold leading-tight text-ink">{inviter.name}</b>
          </span>
        </div>
      )}

      <h1 className="text-display font-extrabold leading-tight text-ink">{t('activation.title')}</h1>
      <p className="text-base text-ink-muted">{t('activation.note')}</p>

      {authenticated && (
        /*
          Номер не спрашивается: человек вошёл под ним, и сервер читает его
          из токена сам. Показан он потому, что приглашение выписано на
          конкретный номер: увидев чужой, человек поймёт, что вошёл не тем,
          — а не будет гадать над одинаковым отказом.
        */
        <div className="rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface px-3.5 py-3">
          <span className="text-caption text-ink-muted">{t('activation.yourNumber')}</span>
          <b className="block text-title font-extrabold tabular-nums text-ink">{phoneLabel(phone, t('activation.unknownPhone'))}</b>
          <span className="text-caption text-ink-muted">{t('activation.signedInAs')}</span>
        </div>
      )}

      {/*
        Учётная запись у приглашённого уже есть: пароль ему придумывать нечего,
        ссылка его не сменит. Вход вернёт на эту же ссылку, и магазин добавится
        из-под входа — согласием и одной кнопкой.
      */}
      {!authenticated && inviter?.signInRequired ? (
        <div className="flex flex-col gap-3" data-testid="activation-sign-in-first">
          <p className="text-base text-ink">{t('activation.signInToAccept')}</p>
          <Button size="lg" className="h-16 w-full rounded-[1.375rem] text-lead" onClick={login}>
            {t('activation.signIn')}
          </Button>
        </div>
      ) : (
      <>
          {shownRefusal !== null && (
            /*
             * Свой текст только у тех отказов, которые сервер назвал сам
             * и которые человеку есть чем исправить. Остальное — один текст
             * на все причины: просрочено, использовано, отозвано, не
             * существует. Разные тексты превратили бы форму в способ узнать,
             * кто чей поставщик.
             */
            <p
              role="alert"
              className="rounded-[var(--radius-control)] border border-gone/30 bg-gone/8 px-3 py-2 text-sm text-ink"
            >
              {t(refusalTextKey(shownRefusal))}
            </p>
          )}

          {/*
            Вход предлагается после отказа, а не вместо формы.

            Приглашённому впервые входить нечем, и кнопка входа на его пути
            была бы тупиком. Но отказ может означать, что кабинет у человека
            уже есть — тогда приглашение принимается из-под входа. Утверждать
            этого страница не вправе: сервер о причине умалчивает намеренно,
            и текст говорит «если уже был», а не «вы уже зарегистрированы».
          */}
          {!authenticated && shownRefusal !== null && (
            <div className="flex flex-col gap-2">
              <p className="text-base text-ink-muted">{t('activation.alreadyHaveAccount')}</p>
              <Button size="lg" variant="outline" onClick={login}>{t('activation.signIn')}</Button>
            </div>
          )}

          {/*
            Уведомление стоит над кнопкой, а не ссылкой мелким шрифтом внизу:
            согласие даётся до начала обработки, и человек должен увидеть тот
            текст, с которым соглашается. Вместе с согласием на сервер уходит
            редакция документа — через год отвечать придётся именно за неё.
          */}
          <ConsentBlock consent={consent} titleKey="activation.consentTitle" acceptKey="activation.consentAccept" />

          {/*
            Пароль спрашивается только у невошедшего: вошедший его уже задал —
            Keycloak требует смены при первом входе, — и придумывать второй,
            чтобы сервер его выбросил, никого просить не за что.
          */}
          {!authenticated && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="activation-password" className="text-body font-extrabold text-ink">
                {t('activation.passwordLabel')}
              </label>
              <span className="relative flex">
              <input
                id="activation-password"
                type={shown ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                aria-invalid={form.faults.password ? 'true' : 'false'}
                onChange={(event) => form.field('password').onChange(event.currentTarget.value)}
                onBlur={form.field('password').onBlur}
                className={cn(
                  'h-14 w-full rounded-[var(--radius-control)] border-2 border-field-line bg-surface pl-4 pr-14',
                  'text-base text-ink outline-none focus:border-shop focus:ring-1 focus:ring-shop',
                )}
              />
              <button type="button" aria-pressed={shown} aria-label={t(shown ? 'activation.hidePassword' : 'activation.showPassword')}
                onClick={() => setShown((was) => !was)}
                className="absolute inset-y-0 right-1 flex w-12 cursor-pointer items-center justify-center border-0 bg-transparent text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <Eye aria-hidden="true" className="size-6" />
              </button>
              </span>
              <FieldFaultText fault={form.faults.password} name="password" />
              <p className="text-caption text-ink-muted">{t('activation.passwordNote')}</p>
            </div>
          )}

          <Button
            size="lg"
            className="h-16 w-full rounded-[1.375rem] text-lead"
            disabled={!!why || !form.isValid || activate.isPending}
            aria-describedby={why ? `${id}-why` : undefined}
            onClick={() =>
              notice
              && activate.mutate({
                data: {
                  code,
                  consentVersion: notice.version,
                  // Вошедшему поле не отправляется вовсе: сервер его не читает,
                  // а пустая строка в теле выглядела бы как забытый пароль.
                  ...(authenticated ? {} : { password }),
                },
              })
            }
          >
            {activate.isPending ? t('activation.opening') : t('activation.open')}
          </Button>
          {why && <p id={`${id}-why`} className="text-base text-ink-muted">{t(why)}</p>}
          {/*
            Подсказка до попытки, а не только после отказа: клиент, у которого
            кабинет Q-Order уже есть у другого поставщика, иначе придумывал бы
            пароль и упирался в «недействительно». Показывается всем невошедшим
            одинаково — от ссылки не зависит и о ней ничего не сообщает.
          */}
          {!authenticated && shownRefusal === null && (
            <p className="flex flex-col items-center gap-1 text-center text-body text-ink-muted">
              <span>{t('activation.existingCustomerHint')}</span>
              <button
                type="button"
                onClick={login}
                className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-base font-bold text-shop-ink underline-offset-2 hover:underline"
              >
                {t('activation.signIn')}
              </button>
            </p>
          )}

      </>
      )}
    </Screen>
  );
}

/**
 * Единственная публичная страница кабинета — и единственная, которую видят
 * до входа. Карточка по центру, а не во всю ширину: на мониторе форма
 * в тысячу точек читается как ошибка вёрстки.
 */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-start justify-center bg-canvas px-4 py-6 sm:items-center">
      {/*
        Вопрос о языке стоит здесь, в общей обёртке, а не в одной из веток:
        приглашённый попадает и на форму, и на экран «ссылка неполная», и
        читать оба ему одинаково нечем, если язык угадан мимо.

        Спрашивается он раньше согласия на обработку данных не случайно:
        согласие с русским текстом не является согласием с казахским. Ответ
        помнится общим ключом с кабинетом — ответившему здесь в кабинете
        тот же вопрос второй раз не зададут.
      */}
      <LanguageAsk />
      <Card className="flex w-full max-w-[30rem] flex-col gap-4 border-0 bg-transparent p-0 sm:border-2 sm:bg-surface sm:p-7"><OpenInApp />{children}</Card>
    </div>
  );
}

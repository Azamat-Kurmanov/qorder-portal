import { useState } from 'react';
import { ConsentNotice } from './ConsentNotice';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Logo } from '../../ui/Logo';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { FieldFaultText } from '../../ui/Field';
import { useFormRules } from '../../ui/forms/useFormRules';
import { rules } from '../../api/rules.generated';
import {
  useActivatePortalInvitation,
  useGetPortalConsentNotice,
  type AccountDto,
  type ConsentNoticeDto,
} from '../../api/generated';
import { useAuth } from '../../auth/useAuth';
import { LanguageAsk } from '../language/LanguageAsk';
import { LanguagePicker } from '../shell/LanguagePicker';
import { setCurrentSupplierId } from '../../supplier/supplier';

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

/** Текст отказа: свой у тех трёх, что человеку есть чем исправить. */
function refusalTextKey(code: string): string {
  switch (code) {
    case 'PORTAL_PASSWORD_REQUIRED': return 'activation.passwordRequired';
    case 'PORTAL_TOO_MANY_ATTEMPTS': return 'activation.tooManyAttempts';
    case 'PORTAL_REALM_UNAVAILABLE': return 'activation.unavailable';
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
  const [accepted, setAccepted] = useState(false);
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
  const noticeQuery = useGetPortalConsentNotice();
  const notice: ConsentNoticeDto | undefined =
    noticeQuery.data?.status === 200 ? noticeQuery.data.data : undefined;

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
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          {t('activation.incomplete.title')}
        </h1>
        <p className="text-ink-muted">{t('activation.incomplete.note')}</p>
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
          <div className="text-[11px] leading-4 text-ink-faint">{t('brand.tagline')}</div>
        </div>
        <div className="ml-auto">
          <LanguagePicker />
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('activation.title')}</h1>
      <p className="text-sm text-ink-muted">{t('activation.note')}</p>

      {authenticated && (
        /*
          Номер не спрашивается: человек вошёл под ним, и сервер читает его
          из токена сам. Показан он потому, что приглашение выписано на
          конкретный номер: увидев чужой, человек поймёт, что вошёл не тем,
          — а не будет гадать над одинаковым отказом.
        */
        <p className={cn(
          'rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2.5',
          'text-sm text-ink-muted',
        )}>
          {t('activation.signedInPrefix')}{' '}
          <span className="font-medium tabular-nums text-ink">
            {phoneLabel(phone, t('activation.unknownPhone'))}
          </span>.{' '}
          {t('activation.signedInAs')}
        </p>
      )}

      <>
          {refusal !== null && (
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
              {t(refusalTextKey(refusal))}
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
          {!authenticated && refusal !== null && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-muted">{t('activation.alreadyHaveAccount')}</p>
              <Button size="lg" variant="ghost" onClick={login}>{t('activation.signIn')}</Button>
            </div>
          )}

          {/*
            Уведомление стоит над кнопкой, а не ссылкой мелким шрифтом внизу:
            согласие даётся до начала обработки, и человек должен увидеть тот
            текст, с которым соглашается. Вместе с согласием на сервер уходит
            редакция документа — через год отвечать придётся именно за неё.
          */}
          {notice && (
            <div className="flex flex-col gap-2">
              <details className="rounded-[var(--radius-control)] border border-hairline bg-surface p-3">
                <summary className="cursor-pointer text-sm font-medium text-ink">
                  {t('activation.consentTitle')}
                </summary>
                {/*
                  Текст разбирается, а не выводится как есть: сервер отдаёт его
                  в разметке, и решётки со звёздочками посреди юридического
                  документа читаются как недоделанность.

                  Высота больше прежней: документ из десяти разделов в полоске
                  на четырнадцать строк листается вслепую, и человек соглашается
                  с тем, чего не прочёл.
                */}
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
                <span>{t('activation.consentAccept')}</span>
              </label>
            </div>
          )}

          {/*
            Пароль спрашивается только у невошедшего: вошедший его уже задал —
            Keycloak требует смены при первом входе, — и придумывать второй,
            чтобы сервер его выбросил, никого просить не за что.
          */}
          {!authenticated && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="activation-password" className="text-sm font-medium text-ink">
                {t('activation.passwordLabel')}
              </label>
              <input
                id="activation-password"
                type="password"
                autoComplete="new-password"
                value={password}
                aria-invalid={form.faults.password ? 'true' : 'false'}
                onChange={(event) => form.field('password').onChange(event.currentTarget.value)}
                onBlur={form.field('password').onBlur}
                className={cn(
                  'h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3',
                  'text-sm text-ink outline-none focus:border-[var(--color-brand)]',
                )}
              />
              <FieldFaultText fault={form.faults.password} name="password" />
              <p className="text-xs text-ink-muted">{t('activation.passwordNote')}</p>
            </div>
          )}

          <Button
            size="lg"
            disabled={!accepted || !notice || !form.isValid || activate.isPending}
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
      </>
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
    <div className="flex min-h-dvh items-center justify-center p-4">
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
      <Card className="flex w-full max-w-[420px] flex-col gap-4 p-6">{children}</Card>
    </div>
  );
}

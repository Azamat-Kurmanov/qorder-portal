import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Logo } from '../../ui/Logo';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import {
  useActivatePortalInvitation,
  useGetPortalConsentNotice,
  type AccountDto,
  type ConsentNoticeDto,
} from '../../api/generated';
import { useAuth } from '../../auth/useAuth';
import { setCurrentSupplierId } from '../../supplier/supplier';

/**
 * Единственная страница кабинета, открытая без входа.
 *
 * Порядок здесь важнее вёрстки. Активация без входа делает учётную запись
 * действующей, но связать её с человеком некому: войти по ней будет некем.
 * Поэтому страница сначала предлагает войти и только потом отправляет код —
 * тогда запись связывается с учётной записью в realm клиентов, и кабинет
 * открывается сразу.
 *
 * Текст отказа не разбирается: сервер отвечает одинаково на просроченный,
 * использованный, чужой и несуществующий код. Показывать «код истёк» там,
 * где сервер этого не сказал, — значит выдумывать за него.
 */
/**
 * Номер группами, как его читают вслух: 7 701 999-88-77.
 *
 * Ровно для показа. Отправлять нечего — сервер берёт номер из токена, — и
 * форматирование здесь ни на что, кроме глаз, не влияет.
 */
function phoneLabel(phone: string | null): string {
  if (phone === null) return 'неизвестный номер';
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 11) return phone;
  return `${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

export function ActivationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { authenticated, login, phone } = useAuth();

  const [failed, setFailed] = useState(false);
  const [accepted, setAccepted] = useState(false);
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
          setFailed(true);
          return;
        }
        // Поставщик известен из ответа: с этого момента кабинету есть что
        // ставить в заголовок каждого запроса.
        setCurrentSupplierId((response.data as AccountDto).supplierId);
        navigate('/catalog', { replace: true });
      },
      onError: () => setFailed(true),
    },
  });

  if (!code) {
    return (
      <Screen>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Ссылка неполная</h1>
        <p className="text-ink-muted">
          В ссылке нет кода приглашения. Откройте её целиком — так, как
          прислал поставщик.
        </p>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Знак вместо прежней точки: это первый экран системы, который видит
          приглашённый клиент, и назвать её здесь больше нечем. Изображение
          `decorative` — имя стоит надписью рядом. */}
      <div className="flex items-center gap-2">
        <Logo height={22} decorative />
        <span className="text-sm font-semibold text-ink">FastOrders</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Вход в кабинет</h1>
      <p className="text-sm text-ink-muted">
        Поставщик пригласил вас в кабинет: там его каталог с ценами и приём
        заявок. Приглашение одноразовое и действует ограниченное время.
      </p>

      {!authenticated ? (
        <>
          <p className="text-sm text-ink-muted">
            Сначала войдите — тогда кабинет откроется сразу и с этого
            устройства, и со следующего.
          </p>
          <Button size="lg" onClick={login}>Войти</Button>
        </>
      ) : (
        <>
          {/*
            Номер не спрашивается: человек вошёл под ним, и сервер читает его
            из токена сам. Показан он потому, что приглашение выписано на
            конкретный номер: увидев чужой, человек поймёт, что вошёл не тем,
            — а не будет гадать над одинаковым отказом.
          */}
          <p className={cn(
            'rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2.5',
            'text-sm text-ink-muted',
          )}>
            Вы вошли как <span className="font-medium tabular-nums text-ink">{phoneLabel(phone)}</span>.
            Приглашение должно быть выписано на этот номер.
          </p>

          {failed && (
            /*
             * Отказ один на все причины — просрочено, использовано, отозвано,
             * не существует. Разные тексты превратили бы форму в способ узнать,
             * кто чей поставщик.
             */
            <p
              role="alert"
              className="rounded-[var(--radius-control)] border border-gone/30 bg-gone/8 px-3 py-2 text-sm text-ink"
            >
              Приглашение недействительно
            </p>
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
                  Уведомление об обработке персональных данных
                </summary>
                <div className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-ink-muted">
                  {notice.text}
                </div>
              </details>

              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.currentTarget.checked)}
                  className="mt-0.5 size-5 accent-[var(--color-brand)]"
                />
                <span>Я прочитал уведомление и соглашаюсь на обработку своих данных</span>
              </label>
            </div>
          )}

          <Button
            size="lg"
            disabled={!accepted || !notice || activate.isPending}
            onClick={() =>
              notice
              && activate.mutate({
                data: { code, consentVersion: notice.version },
              })
            }
          >
            {activate.isPending ? 'Открываем…' : 'Открыть кабинет'}
          </Button>
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
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="flex w-full max-w-[420px] flex-col gap-4 p-6">{children}</Card>
    </div>
  );
}

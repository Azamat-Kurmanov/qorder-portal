import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { getUserManager, DEFAULT_RETURN_TO } from '../../auth/oidcConfig';
import { currentLanguage } from '../../i18n';

/**
 * Одноразовая ссылка входа `/enter/{токен}` (pilot-rollout, 5.6): продавец выдал её из карточки клиента, когда
 * войти кодом из WhatsApp нельзя. Сразу уходим во вход Keycloak с `login_hint=once:<токен>` — плагин «Код из
 * WhatsApp» обменяет токен на вход один раз. Ссылка не подошла — Keycloak покажет обычную форму входа.
 */
export function EnterPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  const enter = () => {
    setFailed(false);
    void getUserManager().signinRedirect({
      state: { returnTo: DEFAULT_RETURN_TO },
      login_hint: `once:${token}`,
      ui_locales: currentLanguage(),
    }).catch(() => setFailed(true));
  };

  useEffect(() => {
    // StrictMode зовёт эффект дважды — второй переход сбил бы первый.
    if (started.current) return;
    started.current = true;
    enter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      {failed ? (
        <>
          <p role="alert" className="m-0 text-base text-ink">{t('enter.failed')}</p>
          <Button size="lg" onClick={enter}>{t('enter.retry')}</Button>
        </>
      ) : (
        <p role="status" className="m-0 text-base text-ink-muted">{t('enter.opening')}</p>
      )}
    </main>
  );
}

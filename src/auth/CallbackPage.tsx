import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { completeSigninRedirect, DEFAULT_RETURN_TO } from './oidcConfig';
import { markSigninCompleted } from './session';
import { useAuth } from './useAuth';

/**
 * Возврат с Keycloak: обменять код на токен и увести туда, откуда начинали.
 *
 * Обмен начинается ровно один раз. React в строгом режиме монтирует эффекты
 * дважды, а код авторизации одноразовый: второй обмен всегда падает, и человек
 * видит ошибку после успешного входа.
 */
export function CallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void completeSigninRedirect()
      .then((returnTo) => {
        markSigninCompleted();
        navigate(returnTo || DEFAULT_RETURN_TO, { replace: true });
      })
      .catch(() => setFailed(true));
  }, [navigate]);

  if (failed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex max-w-[420px] flex-col items-center gap-3 text-center">
          {/* Знак с лозунгом — одним блоком и с тесным зазором внутри: лозунг
              читается подписью при знаке, а не следующей строкой экрана. */}
          <div className="flex flex-col items-center gap-1.5">
            <Logo height={56} />
            <p className="text-caption tracking-[0.01em] text-ink-subtle">{t('brand.tagline')}</p>
          </div>
          {/* Имя кабинета под знаком: систем у Q-Order три, и знак у них общий.
              Клиент попадает сюда по присланной ссылке и из одного знака
              не поймёт, куда именно вошёл. */}
          <p className="text-base font-semibold text-ink">{t('auth.appName')}</p>
          <h3 className="text-lg font-semibold text-ink">{t('auth.callbackFailed.title')}</h3>
          <p className="text-ink-subtle">
            {t('auth.callbackFailed.note')}
          </p>
          <Button onClick={login}>{t('auth.callbackFailed.again')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        {/* Знак продукта: страница ожидания пуста, и назвать систему на ней
            больше нечем — а ждут её как раз те, кто попал сюда впервые.
            Ростом он здесь вдвое против карточек отказа: посреди пустого
            полотна знак в 40px читался случайной иконкой. */}
        {/* Знак с лозунгом — одним блоком и с тесным зазором внутри: лозунг
            читается подписью при знаке, а не следующей строкой экрана. */}
        <div className="flex flex-col items-center gap-1.5">
          <Logo height={96} animated />
          <p className="text-caption tracking-[0.01em] text-ink-subtle">{t('brand.tagline')}</p>
        </div>
        {/* Имя кабинета под знаком: систем у Q-Order три, и знак у них общий.
            Клиент попадает сюда по присланной ссылке и из одного знака
            не поймёт, куда именно вошёл. */}
        <p className="text-base font-semibold text-ink">{t('auth.appName')}</p>
        <p className="text-ink-subtle">{t('auth.completing')}</p>
      </div>
    </div>
  );
}

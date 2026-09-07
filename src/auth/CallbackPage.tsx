import { useEffect, useRef, useState } from 'react';
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
          <Logo height={40} />
          <h3 className="text-lg font-semibold text-ink">Вход не завершился</h3>
          <p className="text-ink-subtle">
            Ссылка возврата уже использована или устарела. Попробуйте войти заново.
          </p>
          <Button onClick={login}>Войти снова</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        {/* Знак продукта: страница ожидания пуста, и назвать систему на ней
            больше нечем — а ждут её как раз те, кто попал сюда впервые. */}
        <Logo height={40} />
        <span
          aria-hidden="true"
          className="size-6 animate-spin rounded-full border-2 border-hairline border-t-accent"
        />
        <p className="text-ink-subtle">Завершаем вход…</p>
      </div>
    </div>
  );
}

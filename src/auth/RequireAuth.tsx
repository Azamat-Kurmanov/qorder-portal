import { useEffect, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { useAuth } from './useAuth';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Закрывает экран до входа.
 *
 * Не показывает форму: вход живёт на Keycloak, и кабинет уводит туда сам,
 * без промежуточной страницы с кнопкой «войти» — лишний шаг на пути клиента,
 * который открыл ссылку с телефона.
 *
 * Исключение — отказ сервера в доступе с только что полученным токеном:
 * повторный вход его не исправит, и цикл редиректов здесь хуже честного
 * объяснения.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { authenticated, sessionRejected, login, logout } = useAuth();

  useEffect(() => {
    if (!authenticated && !sessionRejected) login();
  }, [authenticated, sessionRejected, login]);

  if (sessionRejected) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex max-w-[420px] flex-col items-center gap-3 text-center">
          <Logo height={40} />
          <h3 className="text-lg font-semibold text-ink">Доступ не открыт</h3>
          <p className="text-ink-subtle">
            Вход выполнен, но поставщик пока не открыл вам кабинет. Если вы
            получили ссылку-приглашение, активируйте её; если активировали —
            напишите поставщику.
          </p>
          <Button variant="ghost" onClick={logout}>Выйти</Button>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {/* Тот же знак, что и на возврате с Keycloak: экран ожидания —
              единственное, что человек видит до формы входа. */}
          <Logo height={40} />
          <span
            aria-hidden="true"
            className="size-6 animate-spin rounded-full border-2 border-hairline border-t-accent"
          />
          <p className="text-ink-subtle">Открываем вход…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { authenticated, sessionRejected, restoring = false, signingOut = false, login, logout } = useAuth();

  useEffect(() => {
    if (!authenticated && !sessionRejected && !restoring && !signingOut) login();
  }, [authenticated, sessionRejected, restoring, signingOut, login]);

  if (sessionRejected) {
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
          <h3 className="text-lg font-semibold text-ink">{t('auth.noAccess.title')}</h3>
          <p className="text-ink-subtle">{t('auth.noAccess.note')}</p>
          <Button variant="ghost" onClick={logout}>{t('auth.logout')}</Button>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {/* Тот же знак, что и на возврате с Keycloak: экран ожидания —
              единственное, что человек видит до формы входа, и знак тут
              не подпись при содержимом, а само содержимое — отсюда рост
              вдвое против карточек отказа. */}
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
          <p className="text-ink-subtle">{t('auth.opening')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

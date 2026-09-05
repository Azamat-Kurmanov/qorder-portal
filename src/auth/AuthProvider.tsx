import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'oidc-client-ts';
import { AuthContext, type AuthContextValue } from './AuthContext';
import { CALLBACK_PATH, DEFAULT_RETURN_TO, getUserManager } from './oidcConfig';
import { isSessionRejected, setSession, subscribeSessionRejected } from './session';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Вход клиента в кабинет.
 *
 * Провайдер поднимается выше маршрутов и всегда даёт состояние — аноним,
 * пока не вошли. Закрывает экраны не он, а RequireAuth: у кабинета есть одна
 * страница, открытая без входа, и общее правило пришлось бы для неё дырявить.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const userManager = useMemo(() => getUserManager(), []);
  const [user, setUser] = useState<User | null>(null);
  /**
   * Отказ приходит из кода вне дерева React (session.ts), поэтому подпиской.
   * Начальное значение читает инициализатор состояния, а не эффект: признак
   * живёт в sessionStorage и обязан быть виден уже на первом рендере, иначе
   * RequireAuth успеет запросить новый вход и получится круг редиректов.
   */
  const [sessionRejected, setSessionRejected] = useState(isSessionRejected);

  useEffect(() => subscribeSessionRejected(() => setSessionRejected(true)), []);

  useEffect(() => {
    let active = true;
    void userManager.getUser().then((stored) => {
      if (active) setUser(stored);
    });

    const handleLoaded = (loaded: User) => setUser(loaded);
    const handleUnloaded = () => setUser(null);
    userManager.events.addUserLoaded(handleLoaded);
    userManager.events.addUserUnloaded(handleUnloaded);

    return () => {
      active = false;
      userManager.events.removeUserLoaded(handleLoaded);
      userManager.events.removeUserUnloaded(handleUnloaded);
    };
  }, [userManager]);

  /**
   * Адрес, с которого начался вход, уезжает на Keycloak и возвращается
   * нетронутым: клиент, открывший ссылку активации или конкретный экран,
   * после входа обязан попасть туда же, а не в каталог.
   */
  const login = useCallback(() => {
    const path = window.location.pathname;
    const returnTo = path === CALLBACK_PATH
      ? DEFAULT_RETURN_TO
      : `${path}${window.location.search}`;
    void userManager.signinRedirect({ state: { returnTo } });
  }, [userManager]);

  /**
   * Выход: сначала обесценить refresh-токен, потом уйти на Keycloak.
   * После навигации эта вкладка кода уже не выполняет, и отзыв, оставленный
   * на потом, не случится никогда.
   */
  const logout = useCallback(() => {
    void userManager
      .revokeTokens(['refresh_token'])
      .catch(() => undefined)
      .finally(() => {
        void userManager.signoutRedirect();
      });
  }, [userManager]);

  const token = user?.access_token ?? null;

  // Токен уезжает в мутатор запросов при каждой смене сессии: он читает его
  // напрямую, минуя React, и о перерисовках ничего не знает.
  useEffect(() => setSession(token, login), [token, login]);

  const value = useMemo<AuthContextValue>(
    () => ({ authenticated: token !== null, token, sessionRejected, login, logout }),
    [token, sessionRejected, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

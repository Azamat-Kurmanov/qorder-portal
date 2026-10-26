import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'oidc-client-ts';
import { AuthContext, type AuthContextValue } from './AuthContext';
import { CALLBACK_PATH, DEFAULT_RETURN_TO, getUserManager } from './oidcConfig';
import { isSessionRejected, setSession, subscribeSessionRejected } from './session';
import { lastLogin, persistSession, restoreSession } from './appSession';
import { currentLanguage } from '../i18n';
import { forgetRegisteredDevice } from '../shared/webview/push';
import { isAvailable } from '../shared/webview/bridge';

/** Переход на Keycloak уже запрошен и ещё не начался — общий на вкладку, а не на компонент. */
let redirecting = false;

/** Пауза перед новой попыткой, если переход на вход не начался. */
const RETRY_MS = 3000;

/**
 * Один переход на вход за раз.
 *
 * В разработке React вызывает эффект `RequireAuth` дважды, и вход запрашивался
 * двумя переходами подряд. Firefox обрывал первый вторым (`NS_BINDING_ABORTED`),
 * второй падал с `NetworkError`, и экран навсегда оставался на «Открываем вход…».
 * Не начался переход (сеть, Keycloak недоступен) — флаг снимается, и через
 * паузу пробуем снова, а не висим.
 */
function startRedirect(redirect: () => Promise<void>) {
  if (redirecting) return;
  redirecting = true;
  Promise.resolve(redirect()).then(
    // Браузер уже уходит на Keycloak; флаг нужен лишь против второго вызова в том же такте.
    () => { redirecting = false; },
    () => {
      redirecting = false;
      window.setTimeout(() => startRedirect(redirect), RETRY_MS);
    },
  );
}

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
  /** В приложении сначала поднимается сохранённая сессия (appSession.ts). */
  const [restoring, setRestoring] = useState(isAvailable);
  // Выход начат: см. AuthContextValue.signingOut.
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => subscribeSessionRejected(() => setSessionRejected(true)), []);

  useEffect(() => {
    let active = true;
    void userManager.getUser().then((stored) => {
      if (active) setUser(stored);
    });

    // Каждая новая сессия уходит в хранилище приложения; в браузере — ничего.
    const handleLoaded = (loaded: User) => {
      setUser(loaded);
      persistSession(loaded);
    };
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
  useEffect(() => {
    if (!restoring) return;
    void restoreSession(userManager).finally(() => setRestoring(false));
    // Один раз на старте: повторять восстановление после входа незачем.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userManager]);

  const login = useCallback(() => {
    const path = window.location.pathname;
    const returnTo = path === CALLBACK_PATH
      ? DEFAULT_RETURN_TO
      : `${path}${window.location.search}`;
    startRedirect(async () =>
      userManager.signinRedirect({
        state: { returnTo },
        login_hint: await lastLogin(),
        // Форма входа — на языке кабинета, а не на языке телефона.
        ui_locales: currentLanguage(),
      }),
    );
  }, [userManager]);

  /**
   * Выход: сначала обесценить refresh-токен, потом уйти на Keycloak.
   * После навигации эта вкладка кода уже не выполняет, и отзыв, оставленный
   * на потом, не случится никогда.
   */
  const logout = useCallback(() => {
    // Отзыв токена снимает пользователя раньше, чем браузер уйдёт на
    // Keycloak; без признака RequireAuth успевал запустить вход.
    setSigningOut(true);
    // Приложение забывает сессию сразу: следующий запуск — снова пароль.
    persistSession(null);
    // Телефон, с которого вышли, push этого человека больше не показывает.
    forgetRegisteredDevice();
    void userManager
      .revokeTokens(['refresh_token'])
      .catch(() => undefined)
      .finally(() => {
        userManager.signoutRedirect().catch((error: unknown) => {
          // Уйти не удалось (Keycloak недоступен) — возвращаем обычное
          // поведение, иначе кнопка «Выйти» молча перестала бы работать.
          setSigningOut(false);
          console.error('Keycloak signout failed', error);
        });
      });
  }, [userManager]);

  const token = user?.access_token ?? null;
  // Номер берётся из разобранного профиля токена, а не разбирается здесь
  // заново: oidc-client-ts уже проверил подпись и срок. Логин — «+7…»,
  // номер везде в портале — цифрами.
  const phone = typeof user?.profile.preferred_username === 'string'
    ? user.profile.preferred_username.replace(/^\+/, '')
    : null;

  // Токен уезжает в мутатор запросов при каждой смене сессии: он читает его
  // напрямую, минуя React, и о перерисовках ничего не знает.
  useEffect(() => setSession(token, login), [token, login]);

  const value = useMemo<AuthContextValue>(
    () => ({ authenticated: token !== null, token, phone, sessionRejected, restoring, signingOut, login, logout }),
    [token, phone, sessionRejected, restoring, signingOut, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

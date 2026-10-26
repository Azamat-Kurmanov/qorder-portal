import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthContext, type AuthContextValue } from './AuthContext';
import { RequireAuth } from './RequireAuth';

function contextValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    authenticated: false,
    token: null,
    phone: null,
    sessionRejected: false,
    login: () => {},
    logout: () => {},
    ...overrides,
  };
}

describe('RequireAuth', () => {
  it('без сессии уводит на вход', () => {
    const login = vi.fn();
    render(
      <AuthContext.Provider value={contextValue({ login })}>
        <RequireAuth><div>secret</div></RequireAuth>
      </AuthContext.Provider>,
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(login).toHaveBeenCalledOnce();
  });

  it('пока приложение поднимает сохранённую сессию, вход не запрашивает', () => {
    const login = vi.fn();
    render(
      <AuthContext.Provider value={contextValue({ login, restoring: true })}>
        <RequireAuth><div>secret</div></RequireAuth>
      </AuthContext.Provider>,
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  /**
   * Выход снимает пользователя раньше, чем браузер уходит на Keycloak.
   * Без этого признака RequireAuth тут же запускал вход, и вместо экрана
   * выхода (а после — экрана выбора кабинета) человек видел форму входа.
   */
  it('во время выхода вход не запрашивает', () => {
    const login = vi.fn();
    render(
      <AuthContext.Provider value={contextValue({ login, signingOut: true })}>
        <RequireAuth><div>secret</div></RequireAuth>
      </AuthContext.Provider>,
    );
    expect(login).not.toHaveBeenCalled();
  });
});

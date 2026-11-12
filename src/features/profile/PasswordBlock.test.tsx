import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordBlock } from './ProfilePage';
import { renderScreen } from '../../test/render';

const signinRedirect = vi.fn(() => Promise.resolve());
vi.mock('../../auth/oidcConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/oidcConfig')>();
  return { ...actual, getUserManager: () => ({ signinRedirect }) };
});

describe('пароль для входа', () => {
  it('ведёт на страницу Keycloak «Новый пароль» и обратно в профиль', async () => {
    renderScreen(<PasswordBlock />);

    await userEvent.click(screen.getByRole('button', { name: /Пароль для входа/ }));

    expect(signinRedirect).toHaveBeenCalledWith(expect.objectContaining({
      state: { returnTo: '/profile' },
      extraQueryParams: { kc_action: 'UPDATE_PASSWORD' },
    }));
  });
});

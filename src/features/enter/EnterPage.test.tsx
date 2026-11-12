import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EnterPage } from './EnterPage';

const signinRedirect = vi.fn(() => Promise.resolve());
vi.mock('../../auth/oidcConfig', () => ({
  getUserManager: () => ({ signinRedirect }),
  DEFAULT_RETURN_TO: '/catalog',
}));

describe('одноразовая ссылка входа /enter/{токен} (pilot-rollout, 5.6)', () => {
  it('сразу уходит во вход Keycloak с подсказкой once:<токен>, один раз', () => {
    render(<MemoryRouter initialEntries={['/enter/abc123']}>
      <Routes><Route path="/enter/:token" element={<EnterPage />} /></Routes>
    </MemoryRouter>);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(signinRedirect).toHaveBeenCalledTimes(1);
    expect(signinRedirect).toHaveBeenCalledWith(expect.objectContaining({ login_hint: 'once:abc123' }));
  });
});

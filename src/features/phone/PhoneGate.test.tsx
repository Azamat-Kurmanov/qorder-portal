import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoneGate } from './PhoneGate';
import { useGetPortalProfile } from '../../api/generated';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

/** Любой экран кабинета: спрашивает профиль и получает то, что ответит сервер. */
function Probe() {
  useGetPortalProfile();
  return null;
}

const phoneCode = { code: '654321', waLink: 'https://wa.me/77010000000?text=Code', expiresAt: new Date(Date.now() + 600_000).toISOString() };

describe('подтверждение номера', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('отказ «номер не подтверждён» — просьба поверх кабинета; код → WhatsApp → подтверждено — просьба уходит', async () => {
    let verified = false;
    stubFetch([
      // После подтверждения сервер отвечает как обычно — иначе перечитанный профиль снова открыл бы просьбу.
      {
        match: (url) => url.includes('/api/portal/me'),
        get status() { return verified ? 200 : 403; },
        get body() { return verified ? { phone: '77010000011' } : { code: 'PHONE_NOT_VERIFIED', detail: 'Номер не подтверждён' }; },
      },
      method('POST', '/api/portal/phone/code', phoneCode),
      { match: (url) => url.includes('/api/portal/phone/status'), get body() { return { verified }; } },
    ]);
    renderScreen(<><PhoneGate /><Probe /></>);

    expect(await screen.findByRole('dialog', { name: 'Подтвердите номер телефона' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));
    expect(await screen.findByRole('link', { name: 'Открыть WhatsApp' })).toHaveAttribute('href', phoneCode.waLink);
    expect(screen.getByText(/Код 654321/)).toBeInTheDocument();

    verified = true;
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 4000 });
  });

  it('другой отказ — просьбы нет', async () => {
    stubFetch([get('/api/portal/me', { code: 'SUPPLIER_UNAVAILABLE' }, 403)]);
    renderScreen(<><PhoneGate /><Probe /></>);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

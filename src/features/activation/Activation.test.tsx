import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivationPage } from './ActivationPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

/** Уведомление читается до входа: без него кнопка не должна работать вовсе. */
const NOTICE = {
  version: '2026-09-05',
  language: 'ru',
  text: 'Уведомление об обработке персональных данных. Обрабатываем номер телефона…',
};

describe('активация приглашения', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('до входа предлагает войти, а не отправлять код', async () => {
    const login = vi.fn();
    stubFetch([]);

    renderScreen(<ActivationPage />, {
      route: '/activate?code=abc123',
      auth: { authenticated: false, token: null, login },
    });

    // Активация без входа делает запись действующей, но войти по ней будет
    // некому: связывать её не с кем.
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    expect(login).toHaveBeenCalled();
    expect(screen.queryByLabelText(/телефон/i)).not.toBeInTheDocument();
  });

  it('после входа отправляет код, согласие и запоминает поставщика', async () => {
    const { calls } = stubFetch([
      get('/api/portal/consent-notice', NOTICE),
      method('POST', '/api/portal/invitation/activate', {
        id: 'account-1',
        supplierId: 'supplier-7',
        customerId: 'customer-1',
        phone: '77010000001',
        status: 'ACTIVE',
      }),
    ]);

    renderScreen(<ActivationPage />, { route: '/activate?code=abc123' });

    await userEvent.type(screen.getByLabelText(/телефон/i), '77010000001');
    // Пока уведомление не принято, кабинет не открывается: обработка началась
    // бы раньше, чем человека о ней уведомили.
    expect(screen.getByRole('button', { name: /открыть кабинет/i })).toBeDisabled();

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /открыть кабинет/i }));

    await waitFor(() => {
      const activation = calls.find((call) => call.init?.method === 'POST');
      expect(activation).toBeDefined();
      expect(JSON.parse(String(activation?.init?.body))).toEqual({
        code: 'abc123',
        phone: '77010000001',
        // Редакция уходит та, которую человеку показали: через год отвечать
        // придётся за неё, а не за сегодняшний текст.
        consentVersion: '2026-09-05',
      });
    });
    // Поставщик из ответа: с этого момента кабинету есть что ставить в заголовок.
    expect(window.localStorage.getItem('fo.portal.supplier')).toBe('supplier-7');
  });

  it('отказ не объясняет причину', async () => {
    stubFetch([
      get('/api/portal/consent-notice', NOTICE),
      method('POST', '/api/portal/invitation/activate',
        { code: 'INVITATION_INVALID', detail: 'Приглашение недействительно' }, 401),
    ]);

    renderScreen(<ActivationPage />, { route: '/activate?code=expired' });

    await userEvent.type(screen.getByLabelText(/телефон/i), '77010000001');
    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /открыть кабинет/i }));

    // Текст один на все причины: иначе форма подсказывает, кто чей поставщик.
    expect(await screen.findByRole('alert')).toHaveTextContent(/приглашение недействительно/i);
    expect(screen.queryByText(/истек|использован|не найден/i)).not.toBeInTheDocument();
  });

  it('ссылка без кода объясняет, что она неполная', () => {
    stubFetch([]);
    renderScreen(<ActivationPage />, { route: '/activate' });

    expect(screen.getByText(/ссылка неполная/i)).toBeInTheDocument();
  });
});

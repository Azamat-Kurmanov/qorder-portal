import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { JoinPage } from './JoinPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const notice = { version: '2026-10-20', language: 'ru', text: '# Согласие\n\nТекст.' };

function open(route: string) {
  return renderScreen(
    <Routes><Route path="/join/:code?" element={<JoinPage />} /></Routes>,
    { route, supplierId: null, auth: { authenticated: false, token: null, phone: null } },
  );
}

describe('страница поставщика', () => {
  it('называет пригласившего', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice), get('/api/portal/join/abc', { referrerName: 'ТОО "Кафе Сауле"' })]);
    open('/join/abc');

    expect(await screen.findByRole('heading', { name: 'ТОО "Кафе Сауле" приглашает вас принимать заказы через Q-Order' }))
      .toBeInTheDocument();
  });

  it('без имени — «один из ваших клиентов»', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice), get('/api/portal/join/abc', {})]);
    open('/join/abc');

    expect(await screen.findByRole('heading', { name: /Один из ваших клиентов/ })).toBeInTheDocument();
  });

  it('без кода — общий заголовок', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice)]);
    open('/join');

    expect(await screen.findByRole('heading', { name: 'Принимайте заказы через Q-Order' })).toBeInTheDocument();
  });

  it('погашенный код — «больше не действует» и форма', async () => {
    stubFetch([
      get('/api/portal/join/consent-notice', notice),
      get('/api/portal/join/abc', { code: 'REFERRAL_NOT_FOUND' }, 404),
    ]);
    open('/join/abc');

    expect(await screen.findByText(/Приглашение больше не действует/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отправить заявку' })).toBeInTheDocument();
  });

  it('без названия, телефона и согласия отправить нельзя', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice)]);
    open('/join');
    const send = await screen.findByRole('button', { name: 'Отправить заявку' });

    await userEvent.type(screen.getByLabelText('Название компании'), 'ТОО Хлеб');
    await userEvent.type(screen.getByLabelText('Телефон'), '8 701 612-22-05');
    expect(send).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(send).toBeEnabled();
  });

  it('после отправки — спасибо, с кодом и редакцией согласия', async () => {
    const { calls } = stubFetch([
      get('/api/portal/join/consent-notice', notice),
      get('/api/portal/join/abc', { referrerName: 'Кафе' }),
      method('POST', '/api/portal/join', undefined, 204),
    ]);
    open('/join/abc');
    await screen.findByRole('heading', { name: /Кафе/ });

    await userEvent.type(screen.getByLabelText('Название компании'), 'ТОО Хлеб');
    await userEvent.type(screen.getByLabelText('Телефон'), '+7 701 612 22 05');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));

    expect(await screen.findByText(/Спасибо! Свяжемся с вами/)).toBeInTheDocument();
    const body = JSON.parse(String(calls.find((call) => call.init?.method === 'POST')?.init?.body));
    expect(body).toMatchObject({ code: 'abc', name: 'ТОО Хлеб', phone: '+7 701 612 22 05', consentVersion: '2026-10-20' });
  });

  it('имя с разметкой выводится текстом', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice), get('/api/portal/join/abc', { referrerName: '<b>ТОО</b>' })]);
    const { container } = open('/join/abc');

    expect(await screen.findByRole('heading', { name: /<b>ТОО<\/b>/ })).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });

  it('открывается без входа', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice)]);
    open('/join');

    expect(await screen.findByRole('button', { name: 'Отправить заявку' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Войти' })).toBeNull();
  });
});

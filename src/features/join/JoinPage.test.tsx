import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import i18n from '../../i18n';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { JoinPage } from './JoinPage';
import { renderScreen } from '../../test/render';
import { stubWideScreen } from '../../test/wideScreen';
import { get, method, stubFetch } from '../../test/http';

const notice = { version: '2026-10-20', language: 'ru', text: '# Согласие\n\nТекст.' };

function open(route: string) {
  return renderScreen(
    <Routes><Route path="/join/:code?" element={<JoinPage />} /></Routes>,
    { route, supplierId: null, auth: { authenticated: false, token: null, phone: null } },
  );
}

describe('страница поставщика', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('на мониторе — QR «Откройте на телефоне», на телефоне его нет', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice), get('/api/portal/join/abc', {})]);
    stubWideScreen();
    open('/join/abc');

    const card = await screen.findByTestId('phone-qr');
    expect(card).toHaveTextContent('Откройте на телефоне');
    expect(screen.getByRole('img', { name: 'QR-код этой страницы' }).querySelector('svg')).not.toBeNull();
  });

  it('на телефоне QR этой страницы не рисуется', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice), get('/api/portal/join/abc', {})]);
    open('/join/abc');

    await screen.findByRole('heading', { name: 'Принимайте заявки клиентов в приложении' });
    expect(screen.queryByTestId('phone-qr')).toBeNull();
  });

  it('называет пригласившего', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice), get('/api/portal/join/abc', { referrerName: 'ТОО "Кафе Сауле"' })]);
    open('/join/abc');

    expect(await screen.findByRole('heading', { name: 'Принимайте заявки клиентов в приложении' })).toBeInTheDocument();
    // Кто позвал — карточкой под заголовком, по макету SimplePicInvLanding.
    expect(await screen.findByTestId('join-inviter')).toHaveTextContent('Вас приглашаетТОО "Кафе Сауле"ваш клиент');
  });

  it('без имени — «один из ваших клиентов»', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice), get('/api/portal/join/abc', {})]);
    open('/join/abc');

    expect(await screen.findByTestId('join-inviter')).toHaveTextContent('Один из ваших клиентов');
  });

  it('без кода — общий заголовок', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice)]);
    open('/join');

    expect(await screen.findByRole('heading', { name: 'Принимайте заявки клиентов в приложении' })).toBeInTheDocument();
    expect(screen.queryByTestId('join-inviter')).not.toBeInTheDocument();
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

  it('неполный номер не проходит: 8 и девять цифр', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice)]);
    open('/join');
    await screen.findByRole('button', { name: 'Отправить заявку' });

    const phone = screen.getByLabelText('Телефон');
    const fault = 'Номер из 10 цифр, начиная с 7, например 701 000 00 01 — можно с +7 или 8';
    await userEvent.type(phone, '8701123456');
    await userEvent.tab();
    expect(screen.getByText(fault)).toBeInTheDocument();

    // Лишняя цифра без «+7» не читается как код 7 и номер 011…
    await userEvent.clear(phone);
    await userEvent.type(phone, '70112345678');
    await userEvent.tab();
    expect(screen.getByText(fault)).toBeInTheDocument();

    await userEvent.clear(phone);
    await userEvent.type(phone, '8 (701) 123-45-67');
    await userEvent.tab();
    expect(screen.queryByText(fault)).not.toBeInTheDocument();
  });

  it('сменили язык — согласие на прежнем тексте не считается', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice)]);
    open('/join');
    const send = await screen.findByRole('button', { name: 'Отправить заявку' });
    await userEvent.type(screen.getByLabelText('Название компании'), 'ТОО Хлеб');
    await userEvent.type(screen.getByLabelText('Телефон'), '8 701 612-22-05');
    await userEvent.click(screen.getByRole('checkbox'));
    expect(send).toBeEnabled();

    await act(async () => { await i18n.changeLanguage('kk'); });
    expect(screen.getByRole('button', { name: i18n.t('join.send') })).toBeDisabled();
    await act(async () => { await i18n.changeLanguage('ru'); });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('после отправки — спасибо, с кодом и редакцией согласия', async () => {
    const { calls } = stubFetch([
      get('/api/portal/join/consent-notice', notice),
      get('/api/portal/join/abc', { referrerName: 'Кафе' }),
      method('POST', '/api/portal/join', undefined, 204),
    ]);
    open('/join/abc');
    await screen.findByTestId('join-inviter');
    await userEvent.click(screen.getByRole('button', { name: /Не получается\? Оставьте заявку/ }));

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

    expect(await screen.findByTestId('join-inviter')).toHaveTextContent('<b>ТОО</b>');
    expect(container.querySelector('b')).toBeNull();
  });

  it('открывается без входа', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice)]);
    open('/join');

    expect(await screen.findByRole('button', { name: 'Отправить заявку' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Войти' })).toBeNull();
  });

  it('по приглашению — сначала «Кто вы»: владелец уходит на подключение с кодом', async () => {
    stubFetch([get('/api/portal/join/consent-notice', notice), get('/api/portal/join/abc', { referrerName: 'Кафе' })]);
    open('/join/abc');

    expect(await screen.findByRole('heading', { name: 'Кто вы в компании?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Я владелец/ }).getAttribute('href')).toMatch(/\/signup\?ref=abc$/);
    expect(screen.queryByRole('button', { name: 'Отправить заявку' })).toBeNull();
  });

  it('продавец передаёт владельцу: получает ссылку, WhatsApp и копирование', async () => {
    const { calls } = stubFetch([
      get('/api/portal/join/consent-notice', notice),
      get('/api/portal/join/abc', { referrerName: 'Кафе' }),
      method('POST', '/api/portal/join/abc/forward', { link: 'https://cab/join/owner/T1' }),
    ]);
    open('/join/abc');
    await userEvent.click(await screen.findByRole('button', { name: /Я сотрудник, продавец/ }));

    await userEvent.type(screen.getByLabelText('Ваше имя'), 'Ерлан');
    await userEvent.type(screen.getByLabelText('Ваш телефон'), '8 701 555 12 34');
    await userEvent.click(screen.getByRole('button', { name: 'Получить ссылку для владельца' }));

    expect(await screen.findByText('https://cab/join/owner/T1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отправить в WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скопировать ссылку' })).toBeInTheDocument();
    const body = JSON.parse(String(calls.find((call) => call.init?.method === 'POST')?.init?.body));
    expect(body).toEqual({ sellerName: 'Ерлан', sellerPhone: '8 701 555 12 34' });
  });
});

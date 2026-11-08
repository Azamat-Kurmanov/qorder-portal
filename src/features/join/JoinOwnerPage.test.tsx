import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { JoinOwnerPage } from './JoinOwnerPage';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

function open(route: string) {
  return renderScreen(
    <Routes><Route path="/join/owner/:token" element={<JoinOwnerPage />} /></Routes>,
    { route, supplierId: null, auth: { authenticated: false, token: null, phone: null } },
  );
}

describe('страница владельца по ссылке от продавца', () => {
  it('сколько клиентов ждут, кто передал и куда подключаться', async () => {
    stubFetch([get('/api/portal/join/owner/T1', { waiting: 3, sellerName: 'Ерлан', clients: ['Кафе Сауле'] })]);
    open('/join/owner/T1');

    expect(await screen.findByRole('heading', { name: 'Вас ждут 3 клиента в Q-Order' })).toBeInTheDocument();
    expect(screen.getByText('Ерлан передал(а) вам их приглашения')).toBeInTheDocument();
    expect(screen.getByText('Кафе Сауле')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Подключить компанию' }).getAttribute('href')).toMatch(/\/signup\?owner=T1$/);
  });

  it('неизвестная ссылка — не тупик: можно оставить заявку', async () => {
    stubFetch([get('/api/portal/join/owner/zz', { code: 'REFERRAL_NOT_FOUND' }, 404)]);
    open('/join/owner/zz');

    expect(await screen.findByRole('heading', { name: 'Ссылка не действует' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Оставить заявку' })).toHaveAttribute('href', '/join');
  });

  it('адрес рабочего места не задан — не ссылка в никуда, а заявка', async () => {
    window.__APP_CONFIG__ = { WEB_URL: '' };
    try {
      stubFetch([get('/api/portal/join/owner/T1', { waiting: 1, clients: [] })]);
      open('/join/owner/T1');
      expect(await screen.findByRole('link', { name: 'Оставить заявку' })).toHaveAttribute('href', '/join');
      expect(screen.queryByRole('link', { name: 'Подключить компанию' })).toBeNull();
    } finally {
      delete window.__APP_CONFIG__;
    }
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';
import { AllShopsPage } from './AllShopsPage';
import { localToday } from './useAllShops';

const shop = (supplierId: string, name: string) => ({ supplierId, name, currency: 'KZT' });

const suppliers = get('/api/portal/suppliers', [shop('s-leto', '«Лето»'), shop('s-jeans', '«Джинс-Опт»'), shop('s-bahyt', '«Бахыт»')]);
const summary = get('/api/portal/notifications/summary', []);

function overview() {
  return get('/api/portal/notifications/overview', [
    { supplierId: 's-leto', notifications: [
      { id: 'n-answer', draftId: 'thread-1', kind: 'QUESTION_ANSWERED', createdAt: '2026-11-07T08:55:00Z' },
      { id: 'n-accepted', draftId: 'd-38', kind: 'ACCEPTED', createdAt: '2026-11-07T09:40:00Z' },
    ] },
    { supplierId: 's-jeans', notifications: [], debt: { debt: 90000, overdue: 12000, pending: 0 } },
    { supplierId: 's-bahyt', notifications: [
      { id: 'n-invoice', draftId: 'd-41', kind: 'INVOICE_SENT', createdAt: '2026-11-07T09:12:00Z' },
    ] },
  ]);
}

function renderAll(route = '/all-shops') {
  const select = vi.fn();
  const result = renderScreen(
    <Routes>
      <Route path="/all-shops" element={<AllShopsPage onSwitch={select} />} />
      <Route path="*" element={<p>в магазине</p>} />
    </Routes>,
    { route },
  );
  return { select, ...result };
}

describe('«Все магазины»', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('дела — группами по виду, сообщения — отдельно; число дел без сообщений', async () => {
    stubFetch([overview(), suppliers, summary]);

    renderAll('/all-shops?view=tasks');

    expect(await screen.findByText('дела осталось')).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Все магазины — меню' });
    expect(within(menu).getByRole('button', { name: /^Дела/ })).toHaveAttribute('aria-current', 'page');
    expect(within(menu).getByRole('img', { name: 'Дела: 3' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Профиль' })).toHaveAttribute('href', '/profile');
    expect(screen.getByText(/Просрочен платёж/)).toBeInTheDocument();
    expect(screen.getByText(/Счёт к оплате/)).toBeInTheDocument();
    expect(screen.getByText(/Продавец ответил на вопрос/)).toBeInTheDocument();
    // «Заявка принята» — сообщение, не дело.
    expect(screen.queryByText('Заявка принята продавцом')).not.toBeInTheDocument();

    // На телефоне сообщения видны и с «Дел» — строкой со ссылкой.
    await userEvent.click(screen.getByRole('button', { name: /Новые сообщения из 1 магазина/ }));
    expect((await screen.findAllByText('Заявка принята продавцом')).length).toBeGreaterThan(0);
  });

  it('дело открывается в своём магазине: плашка гасится с его заголовком', async () => {
    const { calls } = stubFetch([overview(), suppliers, summary, method('POST', '/api/portal/notifications/n-invoice/read', {}, 204)]);

    renderAll('/all-shops?view=group:invoices');

    await userEvent.click(await screen.findByRole('button', { name: 'Оплатить' }));

    expect(await screen.findByText('в магазине')).toBeInTheDocument();
    await waitFor(() => {
      const read = calls.find((call) => call.url.includes('/n-invoice/read'));
      expect(new Headers(read?.init?.headers).get('X-Supplier-Id')).toBe('s-bahyt');
    });
  });

  it('число платежей в заголовке группы — как на карточке: отправленный не считается', async () => {
    const due = localToday();
    stubFetch([get('/api/portal/notifications/overview', [
      { supplierId: 's-jeans', notifications: [], debt: { debt: 30000, overdue: 0, nextDue: due, nextDueLeft: 30000, pending: 0 } },
      { supplierId: 's-bahyt', notifications: [], debt: { debt: 48200, overdue: 0, nextDue: due, nextDueLeft: 48200, pending: 48200 } },
    ]), suppliers, summary]);

    renderAll('/all-shops?view=group:dueSoon');

    expect(await screen.findByText('Оплачено 1 из 2')).toBeInTheDocument();
    expect(screen.getByText('Сегодня платёж')).toBeInTheDocument();
    expect(screen.queryByText('Сегодня 2 платежа')).not.toBeInTheDocument();
  });

  it('главный раздел — «Магазины», он первый в меню', async () => {
    stubFetch([overview(), suppliers, summary]);

    renderAll();

    const menu = await screen.findByRole('navigation', { name: 'Все магазины — меню' });
    const tabs = within(menu).getAllByRole('button');
    expect(tabs[0]).toHaveTextContent('Магазины');
    expect(tabs[0]).toHaveAttribute('aria-current', 'page');
    expect(tabs[2]).toHaveTextContent(/^Дела/);
  });

  it('дел нет — «Всё разобрано»', async () => {
    stubFetch([get('/api/portal/notifications/overview', [{ supplierId: 's-leto', notifications: [] }]), suppliers, summary]);

    renderAll('/all-shops?view=tasks');

    expect(await screen.findByText('Всё разобрано')).toBeInTheDocument();
  });
});

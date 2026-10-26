import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteSupplierDialog } from './InviteSupplierDialog';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const LINK = 'http://localhost:5174/join/AbCdEfGhIjKlMnOpQrStUv';
const created = {
  id: 'r-1', code: 'AbCdEfGhIjKlMnOpQrStUv', link: LINK, status: 'SENT',
  createdAt: '2026-10-20T10:00:00Z', invited: false,
};

function rules(createStatus = 201, createBody: unknown = created) {
  return [
    get('/api/portal/me', { customerName: 'ТОО "Кафе Сауле"' }),
    get('/api/portal/referrals', []),
    method('POST', '/api/portal/referrals', createBody, createStatus),
  ];
}

describe('окно «Пригласить поставщика»', () => {
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    open = vi.fn(() => ({}) as Window);
    vi.stubGlobal('open', open);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('подставляет название из профиля', async () => {
    stubFetch(rules());
    renderScreen(<InviteSupplierDialog open onOpenChange={() => {}} />);

    expect(await screen.findByDisplayValue('ТОО "Кафе Сауле"')).toBeInTheDocument();
  });

  it('галочка «показать, кто приглашает» включена по умолчанию', async () => {
    stubFetch(rules());
    renderScreen(<InviteSupplierDialog open onOpenChange={() => {}} />);

    expect(await screen.findByRole('checkbox', { name: /кто приглашает/ })).toBeChecked();
  });

  it('«Отправить в WhatsApp» создаёт приглашение и открывает wa.me со ссылкой', async () => {
    const { calls } = stubFetch(rules());
    renderScreen(<InviteSupplierDialog open onOpenChange={() => {}} />);
    await screen.findByDisplayValue('ТОО "Кафе Сауле"');

    await userEvent.click(screen.getByRole('button', { name: 'Отправить в WhatsApp' }));

    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    const href = String(open.mock.calls[0][0]);
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain(LINK);
    const body = JSON.parse(String(calls.find((call) => call.init?.method === 'POST')?.init?.body));
    expect(body).toMatchObject({ referrerName: 'ТОО "Кафе Сауле"', showReferrer: true });
  });

  it('«Скопировать ссылку» кладёт ссылку в буфер', async () => {
    stubFetch(rules());
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderScreen(<InviteSupplierDialog open onOpenChange={() => {}} />);
    await screen.findByDisplayValue('ТОО "Кафе Сауле"');

    await userEvent.click(screen.getByRole('button', { name: 'Скопировать ссылку' }));

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(LINK));
    expect(await screen.findByText('Ссылка скопирована')).toBeInTheDocument();
  });

  it('предел приглашений называется словами', async () => {
    stubFetch(rules(429, { code: 'REFERRAL_DAILY_LIMIT', detail: 'limit' }));
    renderScreen(<InviteSupplierDialog open onOpenChange={() => {}} />);
    await screen.findByDisplayValue('ТОО "Кафе Сауле"');

    await userEvent.click(screen.getByRole('button', { name: 'Отправить в WhatsApp' }));

    expect(await screen.findByText(/Сегодня приглашений уже много/)).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyReferrals } from './MyReferrals';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const row = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, code: `code-${id}`, link: `http://x/join/code-${id}`, status, createdAt: '2026-10-20T10:00:00Z',
  invited: false, ...extra,
});

describe('«Мои приглашения»', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('называет каждое состояние словами', async () => {
    stubFetch([get('/api/portal/referrals', [
      row('1', 'SENT', { label: 'Хлеб' }),
      row('2', 'OPENED'),
      row('3', 'LEAD'),
      row('4', 'CONNECTED'),
      row('5', 'CONNECTED', { invited: true }),
      row('6', 'REJECTED'),
      row('7', 'EXPIRED'),
    ])]);
    renderScreen(<MyReferrals />);

    const rows = await screen.findAllByTestId('referral-row');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Отправлено'),
      expect.stringContaining('Открыто'),
      expect.stringContaining('Поставщик оставил заявку'),
      expect.stringContaining('Подключён'),
      expect.stringContaining('Вас пригласили'),
      expect.stringContaining('Не подключился'),
      expect.stringContaining('Ссылка истекла'),
    ]);
    expect(rows[0]).toHaveTextContent('Хлеб');
    expect(rows[1]).toHaveTextContent('Без подписи');
  });

  it('удалить можно только неотвеченное', async () => {
    stubFetch([get('/api/portal/referrals', [row('1', 'SENT'), row('2', 'OPENED'), row('3', 'LEAD')])]);
    renderScreen(<MyReferrals />);

    const rows = await screen.findAllByTestId('referral-row');
    expect(within(rows[0]).getByRole('button', { name: 'Удалить приглашение' })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('button', { name: 'Удалить приглашение' })).toBeInTheDocument();
    expect(within(rows[2]).queryByRole('button', { name: 'Удалить приглашение' })).toBeNull();
  });

  it('«Напомнить» — у неотвеченного: WhatsApp с той же ссылкой', async () => {
    const open = vi.fn(() => null);
    vi.stubGlobal('open', open);
    stubFetch([get('/api/portal/referrals', [row('1', 'OPENED'), row('2', 'CONNECTED')])]);
    renderScreen(<MyReferrals />);

    const [waiting, connected] = await screen.findAllByTestId('referral-row');
    expect(within(connected).queryByRole('button', { name: 'Напомнить' })).toBeNull();
    await userEvent.click(within(waiting).getByRole('button', { name: 'Напомнить' }));

    const href = decodeURIComponent(String((open.mock.calls[0] as unknown[])[0]));
    expect(href).toContain('https://wa.me/?text=Напоминаю');
    expect(href).toContain('http://x/join/code-1');
  });

  it('пустой список не рисует раздел', async () => {
    stubFetch([get('/api/portal/referrals', [])]);
    const { container } = renderScreen(<MyReferrals />);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container).toBeEmptyDOMElement();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsBell } from './NotificationsBell';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const RENEGOTIATION = {
  id: 'n1',
  draftId: 'draft-1',
  kind: 'RENEGOTIATION',
  createdAt: '2026-09-03T09:00:00Z',
};

const ANSWERED = {
  id: 'n2',
  draftId: 'draft-2',
  kind: 'QUESTION_ANSWERED',
  createdAt: '2026-09-03T10:00:00Z',
};

describe('уведомления кабинета', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('колокольчик называет число непрочитанных и объясняет каждое словами', async () => {
    stubFetch([get('/api/portal/notifications', [RENEGOTIATION, ANSWERED])]);

    renderScreen(<NotificationsBell />);

    // Число — на кнопке: значок без счётчика не отличает «ничего нового»
    // от «два пересогласования».
    expect(await screen.findByRole('button', { name: 'Уведомления: 2' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Уведомления: 2' }));

    // Повод назван словами, а не кодом: RENEGOTIATION клиенту ничего не говорит.
    expect(await screen.findByText(/продавец изменил заявку/i)).toBeInTheDocument();
    expect(screen.getByText(/продавец ответил на вопрос/i)).toBeInTheDocument();
  });

  it('прочитанное отмечается на сервере и исчезает из счётчика', async () => {
    const { calls } = stubFetch([
      get('/api/portal/notifications', [RENEGOTIATION]),
      method('POST', '/api/portal/notifications/n1/read', undefined, 204),
    ]);

    renderScreen(<NotificationsBell />);

    await userEvent.click(await screen.findByRole('button', { name: 'Уведомления: 1' }));
    await userEvent.click(await screen.findByRole('link', { name: /продавец изменил заявку/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/notifications/n1/read'))).toBe(true);
    });
  });

  it('без непрочитанного колокольчик не зовёт', async () => {
    stubFetch([get('/api/portal/notifications', [])]);

    renderScreen(<NotificationsBell />);

    expect(await screen.findByRole('button', { name: 'Уведомления' })).toBeInTheDocument();
    expect(screen.queryByTestId('notifications-count')).not.toBeInTheDocument();
  });
});

/**
 * Плашка ведёт туда, где лежит новость.
 *
 * Ответ на вопрос лежит в разделе вопросов, ответ по заявке — в самой заявке.
 * Плашка, отправившая человека не туда, хуже отсутствующей: он ищет
 * и не находит.
 */
describe('куда ведёт плашка', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ответ на вопрос ведёт в переписку, ответ по заявке — в заявку', async () => {
    stubFetch([get('/api/portal/notifications', [
      { id: 'n1', draftId: 'inq-1', kind: 'QUESTION_ANSWERED', createdAt: '2026-09-03T09:00:00Z' },
      { id: 'n2', draftId: 'order-1', kind: 'ORDER_ANSWERED', createdAt: '2026-09-03T10:00:00Z' },
    ])]);

    renderScreen(<NotificationsBell />);

    await userEvent.click(await screen.findByRole('button', { name: 'Уведомления: 2' }));

    expect(await screen.findByRole('link', { name: /продавец ответил на вопрос/i }))
      .toHaveAttribute('href', '/questions');
    expect(screen.getByRole('link', { name: /продавец ответил по заявке/i }))
      .toHaveAttribute('href', '/orders/order-1');
  });
});

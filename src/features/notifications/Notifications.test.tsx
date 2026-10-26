import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsBell } from './NotificationsBell';
import { useGetPortalUnreadSummary } from '../../api/generated';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

/**
 * Подслушивает сводку непрочитанного тем же способом, что и шапка со
 * списком поставщиков: чтобы увидеть повторный запрос по инвалидации,
 * у сводки должен быть хоть один живой подписчик.
 */
function SummaryProbe() {
  const summary = useGetPortalUnreadSummary();
  const total = summary.data?.status === 200
    ? summary.data.data.reduce((sum, row) => sum + row.unread, 0)
    : 0;
  return <span data-testid="summary-total">{total}</span>;
}

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
    expect(await screen.findByRole('button', { name: 'Уведомления: 2 новых' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Уведомления: 2 новых' }));

    // Повод назван словами, а не кодом: RENEGOTIATION клиенту ничего не говорит.
    expect(await screen.findByText(/продавец изменил заявку/i)).toBeInTheDocument();
    expect(screen.getByText(/продавец ответил на вопрос/i)).toBeInTheDocument();
  });

  it('отклонённая оплата перевозки названа с причиной продавца', async () => {
    stubFetch([get('/api/portal/notifications', [{
      id: 'n3', draftId: 'draft-3', kind: 'TRANSPORT_PAYMENT_REJECTED', createdAt: '2026-09-30T10:00:00Z',
      detail: 'Платёж не найден',
    }])]);

    renderScreen(<NotificationsBell />);
    await userEvent.click(await screen.findByRole('button', { name: 'Уведомления: 1 новое' }));

    expect(await screen.findByText('Оплата перевозки не подтверждена: Платёж не найден')).toBeInTheDocument();
  });

  it('прочитанное отмечается на сервере и исчезает из счётчика', async () => {
    const { calls } = stubFetch([
      get('/api/portal/notifications', [RENEGOTIATION]),
      method('POST', '/api/portal/notifications/n1/read', undefined, 204),
    ]);

    renderScreen(<NotificationsBell />);

    await userEvent.click(await screen.findByRole('button', { name: 'Уведомления: 1 новое' }));
    await userEvent.click(await screen.findByRole('link', { name: /продавец изменил заявку/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/notifications/n1/read'))).toBe(true);
    });
  });

  /**
   * Отметка прочитанным обязана обновить не только список, но и сводку:
   * её читают счётчики у поставщиков (шапка, список «Поставщики»), и без
   * инвалидации погасший колокольчик разошёлся бы с ними в показаниях.
   */
  it('прочитанное отправляет сводку непрочитанного за новым ответом', async () => {
    // Правило сводки стоит выше правила списка: `get` совпадает по вхождению
    // подстроки, и короткий путь перехватил бы длинный первым.
    const { calls } = stubFetch([
      get('/api/portal/notifications/summary', [{ supplierId: 'supplier-1', unread: 1 }]),
      get('/api/portal/notifications', [RENEGOTIATION]),
      method('POST', '/api/portal/notifications/n1/read', undefined, 204),
    ]);

    renderScreen(
      <>
        <NotificationsBell />
        <SummaryProbe />
      </>,
    );

    await screen.findByTestId('summary-total');
    const summaryCallsBefore = calls.filter((call) => call.url.includes('/notifications/summary')).length;

    await userEvent.click(await screen.findByRole('button', { name: 'Уведомления: 1 новое' }));
    await userEvent.click(await screen.findByRole('link', { name: /продавец изменил заявку/i }));

    await waitFor(() => {
      const summaryCallsAfter = calls.filter((call) => call.url.includes('/notifications/summary')).length;
      expect(summaryCallsAfter).toBeGreaterThan(summaryCallsBefore);
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

    await userEvent.click(await screen.findByRole('button', { name: 'Уведомления: 2 новых' }));

    // Ответ продавца ведёт прямо в его ветку: draftId — id ветки.
    expect(await screen.findByRole('link', { name: /продавец ответил на вопрос/i }))
      .toHaveAttribute('href', '/questions/inq-1');
    expect(screen.getByRole('link', { name: /продавец ответил по заявке/i }))
      .toHaveAttribute('href', '/orders/order-1');
  });

  it('доставка — в заказ, готовый шаблон — в корзину', async () => {
    stubFetch([get('/api/portal/notifications', [
      { id: 'n3', draftId: 'order-2', kind: 'ORDER_ON_ROUTE', createdAt: '2026-10-26T09:00:00Z' },
      { id: 'n4', draftId: 'tpl-1', kind: 'TEMPLATE_READY', createdAt: '2026-10-26T10:00:00Z' },
    ])]);

    renderScreen(<NotificationsBell />);

    await userEvent.click(await screen.findByRole('button', { name: 'Уведомления: 2 новых' }));

    expect(await screen.findByRole('link', { name: /заказ в пути/i })).toHaveAttribute('href', '/orders/order-2');
    expect(screen.getByRole('link', { name: /собрана в корзине/i })).toHaveAttribute('href', '/checkout');
  });
});

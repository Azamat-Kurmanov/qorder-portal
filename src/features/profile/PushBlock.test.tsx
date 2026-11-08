import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PushBlock } from './PushBlock';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

function sent(calls: { url: string; init?: RequestInit }[]) {
  return calls.filter((call) => call.init?.method === 'PUT').map((call) => JSON.parse(String(call.init?.body)));
}

describe('уведомления на телефон', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('всё включено по умолчанию; выключить повод — уходит в muted, колокольчик не трогаем', async () => {
    const { calls } = stubFetch([
      method('PUT', '/api/portal/push-preferences', { muted: ['PROMO_STARTED'] }),
      get('/api/portal/push-preferences', { muted: [] }),
    ]);
    renderScreen(<PushBlock />);

    await userEvent.click(await screen.findByText('Уведомления на телефон'));
    expect(screen.getByText('Приходят все')).toBeInTheDocument();
    // Только поводы клиента: продавцовых («Новая заявка в очереди») здесь нет.
    expect(screen.getAllByRole('switch')).toHaveLength(20);
    const sale = screen.getByRole('switch', { name: 'Началась распродажа' });
    expect(sale).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(sale);

    expect(sent(calls)).toEqual([{ muted: ['PROMO_STARTED'] }]);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Началась распродажа' })).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText('Выключено: 1')).toBeInTheDocument();
  });

  it('тихие часы: только начало — не отправляет и просит конец; оба — отправляет', async () => {
    const { calls } = stubFetch([
      method('PUT', '/api/portal/push-preferences', { muted: [], quietFrom: '22:00:00', quietTo: '08:00:00' }),
      get('/api/portal/push-preferences', { muted: [] }),
    ]);
    renderScreen(<PushBlock />);

    await userEvent.click(await screen.findByText('Уведомления на телефон'));
    await userEvent.type(screen.getByLabelText('С'), '2200');
    expect(screen.getByRole('alert')).toHaveTextContent('Укажите и начало, и конец');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('До'), '0800');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(sent(calls)).toEqual([{ muted: [], quietFrom: '22:00', quietTo: '08:00' }]);
    expect(await screen.findByText(/тихо с 22:00 до 08:00/)).toBeInTheDocument();
  });
});

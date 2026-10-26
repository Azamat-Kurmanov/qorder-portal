import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuppliersPage } from './SuppliersPage';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

// Пустая сетка — круглосуточно; все дни закрыты — сегодня закрыто.
const ALWAYS = { timezone: 'Asia/Almaty', days: [], exceptions: [] };
const CLOSED = {
  timezone: 'Asia/Almaty',
  days: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({ dayOfWeek, closed: true })),
  exceptions: [],
};

/** «Поставщики» на мониторе: отбор открытых и поиск по имени и адресу. */
describe('страница поставщиков', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('«Открыты сейчас» оставляет открытые, поиск ищет и по адресу', async () => {
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 's-1', name: 'Стройторг', address: 'Северное кольцо, 9', hours: ALWAYS },
        { supplierId: 's-2', name: 'Эко Пак', address: 'ул. Рыскулова, 140', hours: CLOSED },
      ]),
      get('/api/portal/notifications/summary', []),
    ]);
    renderScreen(<SuppliersPage onSwitch={() => {}} />);

    expect(await screen.findByText('Эко Пак')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Открыты сейчас/ }));
    expect(screen.queryByText('Эко Пак')).not.toBeInTheDocument();
    expect(screen.getByText('Стройторг')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Все/ }));
    await userEvent.type(screen.getByRole('searchbox'), 'рыскулова');
    expect(screen.getByText('Эко Пак')).toBeInTheDocument();
    expect(screen.queryByText('Стройторг')).not.toBeInTheDocument();
  });
});

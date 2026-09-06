import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaffBanner } from './StaffBanner';
import { renderScreen } from '../../test/render';
import { method, stubFetch } from '../../test/http';

describe('кабинет, открытый арендатором', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('называет режим и уводит обратно в рабочее место', () => {
    stubFetch([]);
    renderScreen(<StaffBanner webUrl="http://localhost:3000" />);

    // Не сказать об этом значило бы дать администратору принять свою проверку
    // за работу настоящего клиента.
    expect(screen.getByText(/свой кабинет, открытый для проверки/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /в рабочее место/i }))
      .toHaveAttribute('href', 'http://localhost:3000');
  });

  it('убирает проверочные действия и называет число убранного', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/service-data/reset',
        { drafts: 3, carts: 1, templates: 0, favorites: 2, reviews: 0 }),
    ]);

    renderScreen(<StaffBanner webUrl="http://localhost:3000" />);

    await userEvent.click(screen.getByRole('button', { name: /убрать проверочные действия/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/service-data/reset'))).toBe(true);
    });
    // Числом, а не словом «готово»: ноль убранного и три убранных выглядят
    // одинаково, пока их не назвали.
    expect(await screen.findByText(/убрано заявок: 3/i)).toBeInTheDocument();
  });

  it('пустая уборка говорит об этом прямо', async () => {
    stubFetch([
      method('POST', '/api/portal/service-data/reset',
        { drafts: 0, carts: 0, templates: 0, favorites: 0, reviews: 0 }),
    ]);

    renderScreen(<StaffBanner webUrl="http://localhost:3000" />);

    await userEvent.click(screen.getByRole('button', { name: /убрать проверочные действия/i }));

    expect(await screen.findByText(/убирать было нечего/i)).toBeInTheDocument();
  });
});

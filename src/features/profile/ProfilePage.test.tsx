import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { ProfilePage } from './ProfilePage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const suppliers = [
  { supplierId: 'supplier-1', name: 'СтройБаза Алматы' },
  { supplierId: 'supplier-2', name: 'Бумага оптом' },
];

/**
 * Правило сводки стоит первым: `get` в обвязке совпадает по вхождению
 * подстроки, и более короткий путь, будь он в наборе, перехватил бы более
 * длинный (`/api/portal/notifications` — `/api/portal/notifications/summary`).
 * Здесь такого правила нет — `ProfilePage` рендерится без оболочки и
 * колокольчика, — но порядок «сначала более специфичный путь» держим как
 * общее правило обвязки, а не как реакцию на конкретную коллизию в этом файле.
 */
function profileRules(summary: unknown) {
  return [
    get('/api/portal/notifications/summary', summary),
    get('/api/portal/suppliers', suppliers),
    // Согласия проверяются своим файлом, но запрашивает их тот же экран,
    // и незаявленный запрос обвязка считает ошибкой набора, а не пустотой.
    get('/api/portal/consents', []),
    get('/api/portal/promotions', { volumeTiers: [], deals: [], dealCount: 0, subscription: { subscribed: true } }),
  ];
}

describe('профиль по «Варианту Б»', () => {
  // Список магазинов — на /shops; здесь одна строка с их числом и текущим.
  it('ведёт «Мои магазины» на /shops и называет их число', async () => {
    stubFetch(profileRules([]));
    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    const link = await screen.findByRole('link', { name: /Мои магазины/ });
    expect(link).toHaveAttribute('href', '/shops');
    expect(await screen.findByText(/2 магазина/)).toBeInTheDocument();
  });

  // «Назад» ведёт туда, откуда пришли: из «Все магазины» — в «Дела», из магазина — на «Главную».
  it('«Назад» из «Все магазины» — в «Дела», иначе — на «Главную»', async () => {
    stubFetch(profileRules([]));
    const { unmount } = renderScreen(<ProfilePage />, { supplierId: 'supplier-1', route: { pathname: '/profile', state: { from: 'all-shops' } } });
    expect(await screen.findByRole('link', { name: 'Назад' })).toHaveAttribute('href', '/all-shops');
    unmount();

    renderScreen(<ProfilePage />, { supplierId: 'supplier-1', route: '/profile' });
    expect(await screen.findByRole('link', { name: 'Назад' })).toHaveAttribute('href', '/home');
  });

  // Приглашение другого магазина видно у входа в «Мои магазины», не открывая окно.
  it('новое приглашение — плашкой у «Мои магазины»', async () => {
    stubFetch([
      get('/api/portal/pending-invitations', [
        { invitationId: 'inv-1', supplier: { supplierId: 'supplier-9', name: 'ТОО «Роза»' }, expiresAt: '2026-12-01T00:00:00Z' },
      ]),
      ...profileRules([]),
    ]);
    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    const link = await screen.findByRole('link', { name: /Мои магазины/ });
    expect(await within(link).findByText('1 новое приглашение')).toBeInTheDocument();
  });

  it('размер текста — кнопками на виду', async () => {
    stubFetch(profileRules([]));
    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    const large = await screen.findByRole('button', { name: 'Крупный' });
    await userEvent.click(large);
    expect(large).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.fontScale).toBe('large');
  });
});

describe('уведомления о новинках и акциях в профиле', () => {
  it('включены по умолчанию; переключатель отказывается от них', async () => {
    const { calls } = stubFetch([
      method('PUT', '/api/portal/promotions/subscription', { volumeTiers: [], deals: [], dealCount: 0, subscription: { subscribed: false } }),
      ...profileRules([]),
    ]);
    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    const toggle = await screen.findByRole('switch', { name: 'Сообщать о новинках и акциях' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    expect(await screen.findByRole('switch', { name: 'Сообщать о новинках и акциях' })).toHaveAttribute('aria-checked', 'false');
    expect(calls.some((call) => call.url.includes('/promotions/subscription') && call.init?.body === '{"subscribed":false}')).toBe(true);
  });
});

describe('выход из профиля', () => {
  /** Как значок в шапке телефона: сначала вопрос, «Остаться» ничего не делает. */
  it('спрашивает «Выйти из аккаунта?», «Остаться» не выводит', async () => {
    stubFetch(profileRules([]));
    const logout = vi.fn();
    renderScreen(<ProfilePage />, { supplierId: 'supplier-1', auth: { logout } });

    const button = await screen.findByRole('button', { name: 'Выйти' });
    await userEvent.click(button);
    const ask = await screen.findByRole('dialog', { name: 'Выйти из аккаунта?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Остаться' }));
    expect(logout).not.toHaveBeenCalled();
    // Фокус — обратно на кнопку, с которой открыли вопрос.
    expect(button).toHaveFocus();

    await userEvent.click(button);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Выйти' }));
    expect(logout).toHaveBeenCalled();
  });
});

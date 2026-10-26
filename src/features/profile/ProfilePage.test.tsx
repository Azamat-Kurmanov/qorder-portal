import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
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

describe('список поставщиков', () => {
  it('называет число непрочитанного у каждого поставщика', async () => {
    stubFetch(profileRules([
      { supplierId: 'supplier-1', unread: 2 },
      { supplierId: 'supplier-2', unread: 5 },
    ]));

    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    const rows = await screen.findAllByTestId('supplier-row');
    expect(rows[0]).toHaveTextContent('2');
    expect(rows[1]).toHaveTextContent('5');
  });

  // Пустая пилюля читается как неполадка, а не как «новостей нет».
  it('ноль не рисует вовсе', async () => {
    stubFetch(profileRules([
      { supplierId: 'supplier-1', unread: 0 },
      { supplierId: 'supplier-2', unread: 3 },
    ]));

    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    expect(await screen.findByLabelText('Непрочитанных: 3')).toBeInTheDocument();
    expect(screen.queryByLabelText('Непрочитанных: 0')).not.toBeInTheDocument();
  });

  // Экран открыт и до выбора: сюда принудительно попадает тот, у кого доступ
  // отозвали, и счётчики обязаны работать без выбранного поставщика.
  it('работает без выбранного поставщика', async () => {
    stubFetch(profileRules([{ supplierId: 'supplier-2', unread: 1 }]));

    renderScreen(<ProfilePage />, { supplierId: null });

    expect(await screen.findByLabelText('Непрочитанных: 1')).toBeInTheDocument();
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

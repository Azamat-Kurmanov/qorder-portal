import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { renderScreen, renderWithRealSupplier } from '../test/render';
import { get, stubFetch } from '../test/http';
import { setCurrentSupplierId } from '../supplier/supplier';
import i18n from '../i18n';

const emptyCatalog = [
  get('/api/portal/categories', []),
  get('/api/portal/catalog', { page: 0, size: 50, totalElements: 0, items: [] }),
  get('/api/portal/cart', { lines: [], total: 0, skipped: [] }),
];

describe('поставщик в запросах кабинета', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    setCurrentSupplierId(null);
  });

  it('каждый запрос несёт выбранного поставщика', async () => {
    setCurrentSupplierId('supplier-1');
    const { calls } = stubFetch(emptyCatalog);

    renderScreen(<CatalogPage />);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    // Заголовок ставит один слой — обёртка запросов. Экран, выставляющий его
    // сам, забудет об этом на первом же новом запросе.
    calls.forEach((call) => {
      const headers = new Headers(call.init?.headers);
      expect(headers.get('X-Supplier-Id')).toBe('supplier-1');
    });
  });

  it('без выбранного поставщика заголовка нет вовсе', async () => {
    setCurrentSupplierId(null);
    const { calls } = stubFetch([get('/api/portal/suppliers', [])]);

    renderScreen(<ProfilePage />, { supplierId: null });

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const headers = new Headers(calls[0].init?.headers);
    // Пустой заголовок хуже отсутствующего: сервер разбирал бы его как мусор,
    // а список поставщиков задаётся до выбора и заголовка не требует.
    expect(headers.has('X-Supplier-Id')).toBe(false);
  });

  it('смена поставщика запоминается и уходит в следующий запрос', async () => {
    setCurrentSupplierId('supplier-1');
    const { calls } = stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'Стройбаза' },
        { supplierId: 'supplier-2', name: 'Бумага и К' },
      ]),
    ]);

    // Настоящий провайдер, а не подставленный: проверяется именно то, что
    // выбор доезжает до обёртки запросов и переживает перезагрузку.
    renderWithRealSupplier(<ProfilePage />);

    await screen.findAllByTestId('supplier-row');
    // Кнопка перехода есть только у невыбранного: предлагать перейти туда,
    // где уже находишься, — лишнее действие.
    await userEvent.click(screen.getByRole('button', { name: /перейти/i }));

    expect(window.localStorage.getItem('fo.portal.supplier')).toBe('supplier-2');
    await waitFor(() => {
      const last = calls[calls.length - 1];
      expect(new Headers(last.init?.headers).get('X-Supplier-Id')).toBe('supplier-2');
    });
  });
});

describe('язык в запросах кабинета', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    setCurrentSupplierId(null);
    await i18n.changeLanguage('ru');
  });

  it('заголовок языка равен языку интерфейса, а не константе', async () => {
    await i18n.changeLanguage('kk');
    setCurrentSupplierId('supplier-1');
    const { calls } = stubFetch(emptyCatalog);

    renderScreen(<CatalogPage />);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    // Сервер переводит тексты ошибок по этому заголовку. Останься он
    // константой — казахский экран показывал бы русские отказы.
    calls.forEach((call) => {
      const headers = new Headers(call.init?.headers);
      expect(headers.get('Accept-Language')).toBe('kk');
    });
  });
});

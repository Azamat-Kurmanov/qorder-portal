import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { SupplierPicker } from '../features/profile/SupplierPicker';
import { renderScreen, renderWithRealSupplier } from '../test/render';
import { get, method, stubFetch } from '../test/http';
import { setCurrentSupplierId } from '../supplier/supplier';
import { setPickupPoint } from '../supplier/pickupPoint';
import { markSigninCompleted, setSession } from '../auth/session';
import { apiRequest, ReauthenticationRequiredError } from './client';
import i18n from '../i18n';
import { FakeXhr } from '../test/fakeXhr';

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

  it('выбранная точка самовывоза уходит заголовком, без выбора — заголовка нет', async () => {
    setCurrentSupplierId('supplier-1');
    setPickupPoint('point-1');
    const first = stubFetch(emptyCatalog);
    renderScreen(<CatalogPage />);
    await waitFor(() => expect(first.calls.length).toBeGreaterThan(0));
    first.calls.forEach((call) => expect(new Headers(call.init?.headers).get('X-Pickup-Point')).toBe('point-1'));

    setPickupPoint(null);
    const result = await apiRequest<{ status: number }>('/api/portal/cart', { method: 'GET' });
    expect(result.status).toBe(200);
    const last = first.calls[first.calls.length - 1];
    expect(new Headers(last.init?.headers).has('X-Pickup-Point')).toBe(false);
  });

  it('свой заголовок поставщика у вызова не перезаписывается выбранным', async () => {
    setCurrentSupplierId('supplier-1');
    const { calls } = stubFetch([method('POST', '/api/portal/notifications/n-1/read', {})]);

    await apiRequest('/api/portal/notifications/n-1/read', { method: 'POST', headers: { 'X-Supplier-Id': 'supplier-9' } });

    expect(new Headers(calls[0].init?.headers).get('X-Supplier-Id')).toBe('supplier-9');
  });

  it('без выбранного поставщика заголовка нет вовсе', async () => {
    setCurrentSupplierId(null);
    const { calls } = stubFetch([get('/api/portal/suppliers', [])]);

    renderScreen(<SupplierPicker />, { supplierId: null });

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const headers = new Headers(calls[0].init?.headers);
    // Пустой заголовок хуже отсутствующего: сервер разбирал бы его как мусор,
    // а список поставщиков задаётся до выбора и заголовка не требует.
    expect(headers.has('X-Supplier-Id')).toBe(false);
  });

  it('смена поставщика запоминается и уходит в следующий запрос', async () => {
    setCurrentSupplierId('supplier-1');
    const { calls } = stubFetch([
      get('/api/portal/consents', []),
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'Стройбаза' },
        { supplierId: 'supplier-2', name: 'Бумага и К' },
      ]),
    ]);

    // Настоящий провайдер, а не подставленный: проверяется именно то, что
    // выбор доезжает до обёртки запросов и переживает перезагрузку.
    renderWithRealSupplier(<SupplierPicker />);

    await screen.findAllByTestId('supplier-row');
    // Кнопка перехода есть только у невыбранного: предлагать перейти туда,
    // где уже находишься, — лишнее действие.
    await userEvent.click(screen.getByRole('button', { name: /перейти/i }));

    expect(window.localStorage.getItem('qo.portal.supplier')).toBe('supplier-2');
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

/**
 * Отказ 401 значит «сессия истекла» только там, где сессия была. Анонимный
 * запрос — активация приглашения, единственный экран без входа, — получает
 * 401 как ответ по существу, и новый вход его не исправит: человек ушёл бы
 * на Keycloak, так и не прочитав, что приглашение недействительно.
 */
describe('отказ 401 в запросах кабинета', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    setSession(null, () => {});
  });

  const refusal = { code: 'INVITATION_INVALID', detail: 'Приглашение недействительно' };

  it('анонимный запрос не уводит на вход и отдаёт тело отказа', async () => {
    const reauthenticate = vi.fn();
    setSession(null, reauthenticate);
    stubFetch([method('POST', '/api/portal/invitation/activate', refusal, 401)]);

    const failure = await apiRequest('/api/portal/invitation/activate', { method: 'POST' })
      .catch((error: unknown) => error);

    expect(reauthenticate).not.toHaveBeenCalled();
    expect(failure).not.toBeInstanceOf(ReauthenticationRequiredError);
    expect(failure).toMatchObject({ status: 401, info: refusal });
  });

  /**
   * Пока браузер уходит на Keycloak, экрану нечего показывать: ни данных,
   * ни ошибки. Запрос так и остаётся в ожидании, и экран не успевает
   * нарисовать сбой, которого не было.
   */
  it('запрос с токеном на 401 уводит на новый вход и не завершается', async () => {
    const reauthenticate = vi.fn();
    setSession('expired-token', reauthenticate);
    stubFetch([get('/api/portal/cart', refusal, 401)]);

    const outcome = await Promise.race([
      apiRequest('/api/portal/cart').then(() => 'resolved', () => 'rejected'),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 50)),
    ]);

    expect(reauthenticate).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('pending');
  });

  /**
   * Вход только что завершился — нового входа не будет, отказ показывается
   * словами. Тело ответа при этом доезжает до экрана: код отказа нужен ему,
   * чтобы назвать причину.
   */
  it('отказ сразу после входа отдаёт тело ответа вместе с ошибкой', async () => {
    const reauthenticate = vi.fn();
    setSession('fresh-token', reauthenticate);
    markSigninCompleted();
    stubFetch([method('POST', '/api/portal/invitation/activate', refusal, 401)]);

    const failure = await apiRequest('/api/portal/invitation/activate', { method: 'POST' })
      .catch((error: unknown) => error);

    expect(reauthenticate).not.toHaveBeenCalled();
    expect(failure).toBeInstanceOf(ReauthenticationRequiredError);
    expect(failure).toMatchObject({ status: 401, info: refusal });
  });
});

describe('apiRequest: загрузка файла с прогрессом', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fileBody() {
    const body = new FormData();
    body.append('file', new Blob([new Uint8Array([1, 2, 3])]), 'a.png');
    return body;
  }

  it('сообщает долю отправленного, несёт поставщика и отдаёт ответ той же формы', async () => {
    setCurrentSupplierId('sup-1');
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const progress = vi.fn();

    const pending = apiRequest<{ status: number; data: unknown }>('/api/portal/reviews/r1/photos',
      { method: 'POST', body: fileBody(), onUploadProgress: progress });
    FakeXhr.last.progress(1, 2);
    FakeXhr.last.respond(201, { id: 'r1' });
    const result = await pending;

    expect(progress).toHaveBeenCalledWith(0.5);
    expect(result).toMatchObject({ status: 201, data: { id: 'r1' } });
    expect(FakeXhr.last.headers.get('x-supplier-id')).toBe('sup-1');
  });

  it('отказ — та же ошибка с телом', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const pending = apiRequest('/api/portal/reviews/r1/photos',
      { method: 'POST', body: fileBody(), onUploadProgress: () => {} });
    FakeXhr.last.respond(415, { detail: 'Не снимок' });

    await expect(pending).rejects.toMatchObject({ status: 415, info: { detail: 'Не снимок' } });
  });

  it('уже отменённый запрос не уходит вовсе', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const controller = new AbortController();
    controller.abort();
    FakeXhr.all = [];
    const body = new FormData();
    body.append('file', new Blob([new Uint8Array([1])]), 'a.png');

    await expect(apiRequest('/api/x', { method: 'PUT', body, signal: controller.signal, onUploadProgress: () => {} }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeXhr.all.every((xhr) => xhr.body === undefined)).toBe(true);
  });
});


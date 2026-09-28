import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { RequireSupplier } from './RequireSupplier';
import { currentSupplierId, setCurrentSupplierId } from '../../supplier/supplier';
import { renderWithRealSupplier } from '../../test/render';
import { get, stubFetch } from '../../test/http';

/**
 * Кабинет без поставщиков.
 *
 * Живой случай: поставщик доступ не открыл (или отозвал), список пуст,
 * а выбранный когда-то поставщик остался в хранилище и уходил заголовком
 * в каждом запросе. Экраны при этом рисовались, и клиент получал отказы
 * вместо объяснения.
 *
 * Провайдер здесь настоящий: проверяется как раз то, что сохранённый выбор
 * сбрасывается по-настоящему, а подставленный контекст ничего не хранит
 * и доказывал бы только то, что функция вызвана.
 */
describe('кабинет без поставщиков', () => {
  afterEach(() => {
    setCurrentSupplierId(null);
    vi.unstubAllGlobals();
  });

  it('не пускает на экран и показывает список поставщиков', async () => {
    setCurrentSupplierId('supplier-dead');
    stubFetch([
      get('/api/portal/notifications/summary', []),
      get('/api/portal/suppliers', []),
    ]);

    renderWithRealSupplier(
      <RequireSupplier><p>Витрина</p></RequireSupplier>,
    );

    expect(await screen.findByRole('heading', { name: 'Поставщики' })).toBeInTheDocument();
    expect(screen.queryByText('Витрина')).not.toBeInTheDocument();
  });

  it('забывает поставщика, которого больше нет в списке', async () => {
    setCurrentSupplierId('supplier-dead');
    stubFetch([
      get('/api/portal/notifications/summary', []),
      get('/api/portal/suppliers', []),
    ]);

    renderWithRealSupplier(
      <RequireSupplier><p>Витрина</p></RequireSupplier>,
    );

    // Пока выбор жив, он уходит заголовком `X-Supplier-Id` в каждом запросе
    // кабинета — и каждый получает отказ. Отказ ничего не объясняет клиенту,
    // поэтому мёртвый выбор обязан исчезнуть, а не сохраниться до следующего
    // открытия кабинета.
    await waitFor(() => expect(currentSupplierId()).toBeNull());
  });
});

/**
 * Сохранённый поставщик, которому сервер отказывает.
 *
 * Живой случай: выбор остался от прежнего входа — клиентом или в чужой
 * магазин, — и сервер отвечает 403 уже на сам список, потому что заголовок
 * `X-Supplier-Id` уходит и с ним. Пустого списка, по которому выбор
 * забывается, тут не будет. Проверка при этом пускала внутрь, экран внутри
 * перезапрашивал упавший список, проверка снова уходила в ожидание и снимала
 * экран — и так без конца: кабинет висел на «Смотрим, с кем вы работаете…».
 */
describe('сервер отказывает сохранённому поставщику', () => {
  afterEach(() => {
    setCurrentSupplierId(null);
    vi.unstubAllGlobals();
  });

  const forbidden = { status: 403, code: 'SUPPLIER_FORBIDDEN', detail: 'Поставщик недоступен' };

  /** Список: отказ, пока уходит чужой заголовок, и настоящий ответ без него. */
  function suppliersRule(list: unknown[]) {
    const refused = () => currentSupplierId() === 'supplier-foreign';
    return {
      match: (url: string, init?: RequestInit) => url.includes('/api/portal/suppliers')
        && (init?.method ?? 'GET') === 'GET',
      get status() { return refused() ? 403 : 200; },
      get body() { return refused() ? forbidden : list; },
    };
  }

  it('забывает отвергнутый выбор и берёт единственного поставщика', async () => {
    setCurrentSupplierId('supplier-foreign');
    stubFetch([
      get('/api/portal/notifications/summary', []),
      suppliersRule([{ supplierId: 'supplier-own', name: 'Свой магазин' }]),
    ]);

    renderWithRealSupplier(
      <RequireSupplier><p>Витрина</p></RequireSupplier>,
    );

    expect(await screen.findByText('Витрина')).toBeInTheDocument();
    expect(currentSupplierId()).toBe('supplier-own');
  });

  it('при сбое списка не пускает на экран', async () => {
    stubFetch([
      get('/api/portal/notifications/summary', []),
      get('/api/portal/suppliers', { status: 500 }, 500),
    ]);
    const Screen = vi.fn(() => <p>Витрина</p>);

    renderWithRealSupplier(
      <RequireSupplier><Screen /></RequireSupplier>,
    );

    expect(await screen.findByText('Не удалось узнать, с кем вы работаете. Обновите страницу.')).toBeInTheDocument();
    expect(Screen).not.toHaveBeenCalled();
  });
});

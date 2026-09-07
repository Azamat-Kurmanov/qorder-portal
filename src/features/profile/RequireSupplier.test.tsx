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

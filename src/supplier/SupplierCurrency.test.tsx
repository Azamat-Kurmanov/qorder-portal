import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { get, stubFetch } from '../test/http';
import { renderWithRealSupplier } from '../test/render';
import { setCurrentSupplierId } from './supplier';
import { SupplierCurrencyScope, useSupplierCurrency } from './SupplierCurrency';

function CurrencyProbe() {
  const currency = useSupplierCurrency();
  return <span data-testid="probe">{currency ?? 'нет'}</span>;
}

describe('SupplierCurrencyScope / useSupplierCurrency', () => {
  afterEach(() => setCurrentSupplierId(null));

  it('берёт валюту текущего поставщика из того же списка, что оформление', async () => {
    setCurrentSupplierId('s-2');
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 's-1', name: 'Стройка', currency: 'KZT' },
        { supplierId: 's-2', name: 'Москва-Опт', currency: 'RUB' },
      ]),
    ]);

    renderWithRealSupplier(
      <SupplierCurrencyScope>
        <CurrencyProbe />
      </SupplierCurrencyScope>,
    );

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('RUB'));
  });

  it('до ответа списка поставщиков валюта не известна', () => {
    setCurrentSupplierId('s-2');
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 's-1', name: 'Стройка', currency: 'KZT' },
        { supplierId: 's-2', name: 'Москва-Опт', currency: 'RUB' },
      ]),
    ]);

    renderWithRealSupplier(
      <SupplierCurrencyScope>
        <CurrencyProbe />
      </SupplierCurrencyScope>,
    );

    // Проверяется состояние до разрешения промиса заглушки: findBy ждало бы
    // ответа, а тут важно именно то, что показывает первый же кадр.
    expect(screen.getByTestId('probe')).toHaveTextContent('нет');
  });

  it('поставщика нет в списке — валюта не известна', async () => {
    setCurrentSupplierId('s-3');
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 's-1', name: 'Стройка', currency: 'KZT' },
        { supplierId: 's-2', name: 'Москва-Опт', currency: 'RUB' },
      ]),
    ]);

    renderWithRealSupplier(
      <SupplierCurrencyScope>
        <CurrencyProbe />
      </SupplierCurrencyScope>,
    );

    await screen.findByTestId('probe');
    expect(screen.getByTestId('probe')).toHaveTextContent('нет');
  });

  it('бэкенд без валюты — тенге, как было до валют', async () => {
    setCurrentSupplierId('s-1');
    stubFetch([get('/api/portal/suppliers', [{ supplierId: 's-1', name: 'Стройка' }])]);

    renderWithRealSupplier(
      <SupplierCurrencyScope>
        <CurrencyProbe />
      </SupplierCurrencyScope>,
    );

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('KZT'));
  });
});

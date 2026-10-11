import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderScreen } from '../../test/render';
import { AnnounceBar } from './AnnounceBar';

describe('полоса объявлений', () => {
  it('нет строк — полосы нет', () => {
    renderScreen(<AnnounceBar messages={[]} />);
    expect(document.querySelector('.qo-announce')).toBeNull();
  });

  it('одна строка стоит на месте', () => {
    renderScreen(<AnnounceBar messages={['Доставка бесплатно от 20 000 ₸']} />);
    const bar = screen.getByRole('region', { name: 'Объявления магазина' });
    expect(bar).not.toHaveAttribute('data-ticker');
    expect(screen.getAllByText('Доставка бесплатно от 20 000 ₸')).toHaveLength(1);
  });

  it('несколько строк бегут; копия для бесшовного хода не звучит для программы чтения', () => {
    renderScreen(<AnnounceBar messages={['Первая', 'Вторая']} />);
    const bar = screen.getByRole('region', { name: 'Объявления магазина' });
    expect(bar).toHaveAttribute('data-ticker');
    const copies = screen.getAllByText('Первая');
    expect(copies).toHaveLength(2);
    expect(copies.filter((node) => node.closest('[aria-hidden="true"]'))).toHaveLength(1);
  });
});

describe('полоса открытого магазина', () => {
  it('сумма — валютой магазина из области оболочки', async () => {
    const { SupplierCurrencyScope } = await import('../../supplier/SupplierCurrency');
    const { get, stubFetch } = await import('../../test/http');
    const { ShopAnnounceBar } = await import('./AnnounceBar');
    stubFetch([
      get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'СтройБаза', currency: 'KZT' }]),
      get('/api/portal/promotions', { volumeTiers: [{ from: 400000, percent: 5 }], deals: [], dealCount: 0, saleCategories: [] }),
      get('/api/portal/delivery', { mode: 'PICKUP_ONLY', methods: [], pickupPoints: [] }),
    ]);
    renderScreen(<SupplierCurrencyScope><ShopAnnounceBar enabled /></SupplierCurrencyScope>);
    expect(await screen.findByText(/400\s000 ₸/)).toBeInTheDocument();
  });
});

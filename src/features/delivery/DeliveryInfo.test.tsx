import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { DeliveryInfoPage } from './DeliveryInfoPage';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const PICKUP_ONLY = {
  mode: 'PICKUP_ONLY',
  methods: [],
  pickupPoints: [
    { id: 'p1', name: 'Склад на Вокзальной', address: 'Алматы, Вокзальная 3', workingHours: 'с 9:00 до 18:00' },
  ],
};

const WITH_DELIVERY = {
  mode: 'ENABLED',
  methods: [
    {
      id: 'm1',
      name: 'До двери',
      pickup: false,
      requiresAddress: true,
      requiresFloor: true,
      requiresTimeSlot: false,
      price: 4000,
      freeFromAmount: 150000,
      negotiable: false,
      zones: [{ id: 'z1', name: 'Талгар', price: 6000 }],
      slots: [{ id: 's1', fromTime: '10:00:00', toTime: '14:00:00' }],
    },
    {
      id: 'm2',
      name: 'Договорная',
      pickup: false,
      requiresAddress: true,
      requiresFloor: false,
      requiresTimeSlot: false,
      negotiable: true,
      zones: [],
      slots: [],
    },
  ],
  pickupPoints: [],
};

describe('условия доставки', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('поставщик, который не возит, говорит об этом прямо и называет, куда приехать', async () => {
    stubFetch([get('/api/portal/delivery', PICKUP_ONLY)]);

    renderScreen(<DeliveryInfoPage />);

    // «Доставки нет» — это ответ, а не пустой экран: клиент планирует машину.
    expect(await screen.findByText(/только самовывоз/i)).toBeInTheDocument();
    expect(screen.getByText('Склад на Вокзальной')).toBeInTheDocument();
    // Адрес и часы — одной строкой: приезжают по ним вместе.
    expect(screen.getByText(/Вокзальная 3/)).toHaveTextContent('с 9:00 до 18:00');
  });

  it('заголовок называет оба способа получить заказ и чьи это условия', async () => {
    stubFetch([get('/api/portal/delivery', WITH_DELIVERY)]);

    renderScreen(<DeliveryInfoPage />);

    expect(await screen.findByRole('heading', { name: 'Доставка и самовывоз', level: 1 }))
      .toBeInTheDocument();
    // Условия задаёт продавец и меняет их когда захочет: без этого клиент
    // считает цену обещанием кабинета.
    expect(screen.getByText('Условия продавца')).toBeInTheDocument();
    expect(screen.getByText('Продавец доставляет товар')).toBeInTheDocument();
  });

  it('цена стоит справа от способа, а условия — строкой ниже', async () => {
    stubFetch([get('/api/portal/delivery', WITH_DELIVERY)]);

    renderScreen(<DeliveryInfoPage />);

    expect(await screen.findByText('До двери')).toBeInTheDocument();
    // Цену ищут глазом по правому краю — она отдельным элементом, а не частью
    // строки условий.
    expect(screen.getByTestId('method-price-m1')).toHaveTextContent('4 000 ₸');
    const terms = screen.getByTestId('method-terms-m1');
    expect(terms).toHaveTextContent('бесплатно от 150 000 ₸');
    expect(terms).toHaveTextContent('Талгар');
    expect(terms).toHaveTextContent('6 000 ₸');
    expect(terms).toHaveTextContent('10:00–14:00');
    // Договорная цена не выдумывается нулём: «0 ₸» клиент прочитал бы
    // как бесплатно, а потом получил бы счёт.
    expect(screen.getByTestId('method-price-m2')).toHaveTextContent('договорная');
  });

  it('в другой валюте магазина цена способа и зона — с её знаком', async () => {
    stubFetch([get('/api/portal/delivery', WITH_DELIVERY)]);
    renderScreen(<DeliveryInfoPage />, { currency: 'RUB' });

    expect(await screen.findByTestId('method-price-m1')).toHaveTextContent('4 000 ₽');
    expect(screen.getByTestId('method-terms-m1')).toHaveTextContent('6 000 ₽');
  });

  it('незаполненные цены приходят как null и не читаются нулём', async () => {
    stubFetch([get('/api/portal/delivery', {
      mode: 'ENABLED',
      methods: [{
        id: 'm1', name: 'До двери', pickup: false,
        requiresAddress: false, requiresFloor: false, requiresTimeSlot: false,
        price: null, freeFromAmount: null, negotiable: false, zones: [], slots: [],
      }],
      pickupPoints: [],
    })]);

    renderScreen(<DeliveryInfoPage />);

    expect(await screen.findByTestId('method-price-m1')).toHaveTextContent('не указана');
    expect(screen.queryByText(/бесплатно от/i)).not.toBeInTheDocument();
  });

  it('условия грузчиков — в строке способа', async () => {
    stubFetch([get('/api/portal/delivery', {
      mode: 'ENABLED',
      methods: [{
        id: 'm1', name: 'До двери', pickup: false,
        requiresAddress: true, requiresFloor: false, requiresTimeSlot: false,
        price: 4000, negotiable: false, zones: [], slots: [],
        loaders: { mode: 'ON_REQUEST', tariff: 'PER_UNITS', amount: 1000, step: 10, provider: 'CREW', payee: 'DIRECT' },
      }],
      pickupPoints: [],
    })]);

    renderScreen(<DeliveryInfoPage />);

    expect(await screen.findByTestId('method-terms-m1'))
      .toHaveTextContent(/грузчики 1\s000\s₸ за каждые 10 шт\., оплачиваются напрямую/);
  });

  it('кто возит и кому платить — в строке способа', async () => {
    stubFetch([get('/api/portal/delivery', {
      mode: 'ENABLED',
      methods: [{
        id: 'm1', name: 'Межгород', pickup: false, requiresAddress: true, requiresFloor: false,
        requiresTimeSlot: false, price: 4000, negotiable: false, zones: [], slots: [],
        carriers: [{ id: 'c1', name: 'СДЭК' }, { id: 'c2', name: 'Байтерек' }],
        transportPayee: 'DIRECT', intercity: true,
      }],
      pickupPoints: [],
    })]);

    renderScreen(<DeliveryInfoPage />);

    expect(await screen.findByTestId('method-terms-m1'))
      .toHaveTextContent(/возит: СДЭК, Байтерек, оплачивается перевозчику/);
  });
});

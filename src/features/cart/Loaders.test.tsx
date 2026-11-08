import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubWideScreen } from '../../test/wideScreen';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutPage } from './CheckoutPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const cart = (unitWeightKg?: number) => ({
  lines: [{
    itemId: 'item-1', name: 'Цемент М400', quantity: 5, unit: 'мешок',
    priceAtAdding: 2500, price: 2500, priceChanged: false, total: 12500,
    ...(unitWeightKg === undefined ? {} : { unitWeightKg }),
  }],
  total: 12500,
  skipped: [],
});

const options = (loaders: Record<string, unknown>) => ({
  mode: 'ENABLED',
  methods: [{
    id: 'method-1', name: 'Доставка по городу', pickup: false,
    requiresAddress: false, requiresFloor: false, requiresTimeSlot: false,
    price: 1500, negotiable: false, zones: [], slots: [], loaders,
  }],
  pickupPoints: [{ id: 'point-1', name: 'Склад', address: 'ул. Сейфуллина, 100' }],
});

/** Грузчики на оформлении: сумма, кому платить и что уходит в заявку. */
describe('грузчики при оформлении', () => {
  afterEach(() => vi.unstubAllGlobals());
  // Монитор: оформление одним экраном. Шаги телефона — в CheckoutSteps.test.tsx.
  beforeEach(() => stubWideScreen());

  it('по запросу продавцу — входят в итог и уходят в заявке', async () => {
    const { calls } = stubFetch([
      get('/api/portal/cart', cart()),
      get('/api/portal/delivery', options({ mode: 'ON_REQUEST', tariff: 'FIXED', amount: 3000, provider: 'OWN', payee: 'SELLER' })),
      method('POST', '/api/portal/orders', { draftId: 'draft-1', revision: 1, total: 17000 }),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByLabelText('Нужны грузчики'));

    expect(screen.getByTestId('loaders-total')).toHaveTextContent(/3\s000/);
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent(/17\s000/));


    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));
    await waitFor(() => {
      const submit = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(submit?.init?.body)).delivery).toMatchObject({ methodId: 'method-1', loaders: true });
    });
  });

  it('напрямую — видно, но в итог не входит', async () => {
    stubFetch([
      get('/api/portal/cart', cart()),
      get('/api/portal/delivery', options({ mode: 'ON_REQUEST', tariff: 'FIXED', amount: 3000, provider: 'CREW', payee: 'DIRECT' })),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByLabelText('Нужны грузчики'));

    expect(screen.getByTestId('loaders-direct')).toHaveTextContent(/3\s000/);
    expect(screen.queryByTestId('loaders-total')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent(/14\s000/));
  });

  it('за вес без веса позиции — стоимость уточнит продавец', async () => {
    stubFetch([
      get('/api/portal/cart', cart()),
      get('/api/portal/delivery', options({ mode: 'ON_REQUEST', tariff: 'PER_WEIGHT', amount: 1000, step: 100, provider: 'OWN', payee: 'SELLER' })),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByLabelText('Нужны грузчики'));

    expect(screen.getByTestId('loaders-total')).toHaveTextContent('уточнит продавец');
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent(/14\s000/));
  });

  it('за этаж — спрашивает этаж и лифт', async () => {
    stubFetch([
      get('/api/portal/cart', cart(50)),
      get('/api/portal/delivery', options({ mode: 'ON_REQUEST', tariff: 'PER_FLOOR', amount: 500, liftAmount: 200, provider: 'OWN', payee: 'SELLER' })),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByLabelText('Нужны грузчики'));
    await userEvent.type(screen.getByLabelText('Этаж для подъёма'), '5');
    await userEvent.click(screen.getByLabelText('Есть грузовой лифт'));

    expect(screen.getByTestId('loaders-row')).toHaveTextContent(/1\s000/);
  });

  it('входят в доставку — строка без флажка', async () => {
    stubFetch([
      get('/api/portal/cart', cart()),
      get('/api/portal/delivery', options({ mode: 'INCLUDED', provider: 'OWN' })),
    ]);

    renderScreen(<CheckoutPage />);

    expect(await screen.findByTestId('loaders-included')).toHaveTextContent('Грузчики включены в доставку');
    expect(screen.queryByLabelText('Нужны грузчики')).not.toBeInTheDocument();
  });

  it('смена ветки сбрасывает грузчиков', async () => {
    stubFetch([
      get('/api/portal/cart', cart()),
      get('/api/portal/delivery', options({ mode: 'ON_REQUEST', tariff: 'FIXED', amount: 3000, provider: 'OWN', payee: 'SELLER' })),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByLabelText('Нужны грузчики'));
    await userEvent.click(screen.getByRole('button', { name: 'Самовывоз' }));
    await userEvent.click(screen.getByRole('button', { name: 'Доставка' }));

    expect(await screen.findByLabelText('Нужны грузчики')).not.toBeChecked();
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent(/14\s000/));
  });
});

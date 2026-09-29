import { afterEach, describe, expect, it, vi } from 'vitest';
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

const options = (patch: Record<string, unknown>) => ({
  mode: 'ENABLED',
  methods: [{
    id: 'method-1', name: 'Межгород', pickup: false, requiresAddress: false, requiresFloor: false,
    requiresTimeSlot: false, price: 4000, negotiable: false, zones: [], slots: [],
    carriers: [
      { id: 'c1', name: 'СДЭК', phone: '+7 727 000 00 00', note: 'Звонят за час', terminalAddress: 'Астана, терминал' },
      { id: 'c2', name: 'Байтерек', phone: '+7 727 111 11 11' },
    ],
    transportPayee: 'SELLER', intercity: true, ...patch,
  }],
  pickupPoints: [],
});

describe('перевозчик при оформлении', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('выбор перевозчика и «до терминала» уходят в заявке', async () => {
    const { calls } = stubFetch([
      get('/api/portal/cart', cart()),
      get('/api/portal/delivery', options({})),
      method('POST', '/api/portal/orders', { draftId: 'draft-1', revision: 1, total: 16500 }),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.selectOptions(await screen.findByLabelText('Перевозчик'), 'c1');
    expect(screen.getByTestId('carrier')).toHaveTextContent('+7 727 000 00 00');
    expect(screen.getByTestId('carrier')).toHaveTextContent('Звонят за час');
    await userEvent.click(screen.getByRole('radio', { name: /До терминала/ }));

    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));
    await waitFor(() => {
      const submit = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(submit?.init?.body)).delivery)
        .toMatchObject({ methodId: 'method-1', carrierId: 'c1', deliverTo: 'TERMINAL' });
    });
  });

  it('напрямую — видно, но в итог не входит', async () => {
    stubFetch([get('/api/portal/cart', cart()), get('/api/portal/delivery', options({ transportPayee: 'DIRECT' }))]);

    renderScreen(<CheckoutPage />);
    await userEvent.selectOptions(await screen.findByLabelText('Перевозчик'), 'c2');

    expect(screen.getByTestId('delivery-direct')).toHaveTextContent(/4\s000/);
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent(/12\s500/));
  });

  it('по тарифам перевозчика — вместо суммы', async () => {
    stubFetch([get('/api/portal/cart', cart()),
      get('/api/portal/delivery', options({ transportPayee: 'DIRECT', negotiable: true, price: undefined }))]);

    renderScreen(<CheckoutPage />);
    await userEvent.selectOptions(await screen.findByLabelText('Перевозчик'), 'c2');

    expect(screen.getByTestId('shipping-row')).toHaveTextContent('по тарифам перевозчика');
  });

  it('смена способа сбрасывает перевозчика', async () => {
    const two = options({});
    two.methods.push({ ...two.methods[0], id: 'method-2', name: 'По городу', carriers: [], transportPayee: undefined,
      intercity: false } as never);
    const { calls } = stubFetch([
      get('/api/portal/cart', cart()), get('/api/portal/delivery', two),
      method('POST', '/api/portal/orders', { draftId: 'draft-1', revision: 1, total: 14000 }),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /способ доставки/i }), 'method-1');
    await userEvent.selectOptions(screen.getByLabelText('Перевозчик'), 'c1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /способ доставки/i }), 'method-2');

    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));
    await waitFor(() => {
      const body = JSON.parse(String(calls.find((call) => call.init?.method === 'POST')?.init?.body));
      expect(body.delivery.carrierId).toBeUndefined();
      expect(body.delivery.deliverTo).toBeUndefined();
    });
  });
});

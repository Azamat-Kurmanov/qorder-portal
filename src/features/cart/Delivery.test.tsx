import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutPage } from './CheckoutPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const cart = {
  lines: [{
    itemId: 'item-1',
    name: 'Цемент М400',
    quantity: 5,
    unit: 'мешок',
    priceAtAdding: 2500,
    price: 2500,
    priceChanged: false,
    total: 12500,
  }],
  total: 12500,
  skipped: [],
};

const fixedMethod = {
  id: 'method-1',
  name: 'Доставка по городу',
  pickup: false,
  requiresAddress: true,
  requiresFloor: false,
  requiresTimeSlot: false,
  price: 1500,
  negotiable: false,
  zones: [],
  slots: [],
};

const pickupMethod = {
  id: 'method-2',
  name: 'Самовывоз со склада',
  pickup: true,
  requiresAddress: false,
  requiresFloor: false,
  requiresTimeSlot: false,
  price: 0,
  negotiable: false,
  zones: [],
  slots: [],
};

/**
 * Доставка на оформлении.
 *
 * Проверяется то, что клиент считает обещанием: названная стоимость, итог
 * с нею и вопросы, которых поставщик не задавал. Придуманная цена и лишнее
 * поле стоят одинаково дорого — на них человек принимает решение.
 */
describe('доставка при оформлении', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('у поставщика без доставки выбирать нечего, кроме точки', async () => {
    stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', {
        mode: 'PICKUP_ONLY',
        methods: [],
        pickupPoints: [{
          id: 'point-1',
          name: 'Склад на Сейфуллина',
          address: 'ул. Сейфуллина, 100',
          workingHours: 'пн-пт 9:00-18:00',
        }],
      }),
    ]);

    renderScreen(<CheckoutPage />);

    expect(await screen.findByText(/отдаёт заказ самовывозом/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Склад на Сейфуллина/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/адрес доставки/i)).not.toBeInTheDocument();
    // Переключаться некуда: доставки у поставщика нет, и кнопка это признаёт.
    expect(screen.getByRole('button', { name: 'Доставка' })).toBeDisabled();
  });

  /**
   * Доставка и самовывоз — две кнопки, а не список способов: клиент решает
   * «привезут или заберу» раньше, чем «каким тарифом», и общий список
   * заставляет прочитать все строки, чтобы принять первое решение.
   */
  it('переключатель разводит доставку и самовывоз', async () => {
    stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', {
        mode: 'ENABLED',
        methods: [fixedMethod, pickupMethod],
        pickupPoints: [{ id: 'point-1', name: 'Склад на Сейфуллина', address: 'ул. Сейфуллина, 100' }],
      }),
    ]);

    renderScreen(<CheckoutPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));
    expect(await screen.findByLabelText(/адрес доставки/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Склад на Сейфуллина/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Самовывоз' }));

    expect(await screen.findByLabelText(/Склад на Сейфуллина/)).toBeInTheDocument();
    // Адрес принадлежал прежнему способу: у самовывоза его не спрашивают,
    // и оставленный он уехал бы поставщику ответом на незаданный вопрос.
    expect(screen.queryByLabelText(/адрес доставки/i)).not.toBeInTheDocument();
  });

  it('стоимость способа входит в итог и уходит в заявку', async () => {
    const { calls } = stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', { mode: 'ENABLED', methods: [fixedMethod], pickupPoints: [] }),
      method('POST', '/api/portal/orders', { draftId: 'draft-1', revision: 1, total: 14000 }),
    ]);

    renderScreen(<CheckoutPage />);

    // Единственный способ доставки выбирается вместе с самой доставкой:
    // спрашивать «какой из одного» незачем.
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));
    await userEvent.type(await screen.findByLabelText(/адрес доставки/i), 'ул. Абая, 1');

    await waitFor(() => expect(screen.getByTestId('delivery-total')).toHaveTextContent('1 500'));
    expect(screen.getByTestId('total')).toHaveTextContent('14 000');

    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));

    await waitFor(() => {
      const submit = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(submit?.init?.body)).delivery).toEqual({
        methodId: 'method-1',
        address: 'ул. Абая, 1',
      });
    });
  });

  /** Несколько способов доставки — обычный список внутри ветки «Доставка». */
  it('способ выбирается списком, когда их несколько', async () => {
    stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', {
        mode: 'ENABLED',
        methods: [
          { ...fixedMethod, requiresAddress: false },
          { ...fixedMethod, id: 'method-3', name: 'Доставка за город', requiresAddress: false, price: 5000 },
        ],
        pickupPoints: [],
      }),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    await userEvent.selectOptions(await screen.findByLabelText(/способ доставки/i), 'method-3');

    await waitFor(() => expect(screen.getByTestId('delivery-total')).toHaveTextContent('5 000'));
  });

  /**
   * Зона — часть цены, а не справочная подробность: пока она не выбрана,
   * стоимость зонального тарифа неизвестна, и назвать её нечем.
   */
  it('цену зонального тарифа называет выбранная зона', async () => {
    const { calls } = stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', {
        mode: 'ENABLED',
        methods: [{
          ...fixedMethod,
          requiresAddress: false,
          price: undefined,
          zones: [
            { id: 'zone-1', name: 'По городу', price: 3000 },
            { id: 'zone-2', name: 'За городом', price: 7000 },
          ],
        }],
        pickupPoints: [],
      }),
      method('POST', '/api/portal/orders', { draftId: 'draft-1', revision: 1, total: 19500 }),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    // Зона не выбрана — цены нет, и ноль вместо неё был бы обещанием.
    await waitFor(() =>
      expect(screen.getByTestId('delivery-total')).toHaveTextContent(/по договорённости/i));

    await userEvent.selectOptions(await screen.findByLabelText(/зона доставки/i), 'zone-2');

    await waitFor(() => expect(screen.getByTestId('delivery-total')).toHaveTextContent('7 000'));
    expect(screen.getByTestId('total')).toHaveTextContent('19 500');

    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));
    await waitFor(() => {
      const submit = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(submit?.init?.body)).delivery).toEqual({
        methodId: 'method-1',
        zoneId: 'zone-2',
      });
    });
  });

  /** Порог виден до того, как клиент дошёл до корзины поставщика соседа. */
  it('показывает, сколько не хватает до бесплатной доставки', async () => {
    stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', {
        mode: 'ENABLED',
        methods: [{ ...fixedMethod, requiresAddress: false, freeFromAmount: 20000 }],
        pickupPoints: [],
      }),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    const plate = await screen.findByTestId('missing-to-free');
    expect(plate).toHaveTextContent('7 500');
    // Плашка — подсказка, а не тревога: тёплая заливка, а не красная.
    expect(plate.className).toContain('bg-accent-soft');
  });

  it('в другой валюте магазина цена способа и «не хватает» — с её знаком', async () => {
    stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', {
        mode: 'ENABLED',
        methods: [{ ...fixedMethod, requiresAddress: false, freeFromAmount: 20000 }],
        pickupPoints: [],
      }),
    ]);

    renderScreen(<CheckoutPage />, { currency: 'RUB' });
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    expect(await screen.findByTestId('shipping-row')).toHaveTextContent('1 500 ₽');
    expect(screen.getByTestId('missing-to-free')).toHaveTextContent('7 500 ₽');
  });

  /** Порог пройден — доставка бесплатна, и в итоге это видно. */
  it('за порогом доставка бесплатна', async () => {
    stubFetch([
      get('/api/portal/cart', { ...cart, total: 25000 }),
      get('/api/portal/delivery', {
        mode: 'ENABLED',
        methods: [{ ...fixedMethod, requiresAddress: false, freeFromAmount: 20000 }],
        pickupPoints: [],
      }),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    await waitFor(() => expect(screen.getByTestId('delivery-total')).toHaveTextContent('0 ₸'));
    expect(screen.getByTestId('total')).toHaveTextContent('25 000');
    expect(screen.queryByTestId('missing-to-free')).not.toBeInTheDocument();
  });

  /**
   * Договорную стоимость кабинет не называет и в итог не кладёт: её называет
   * человек, и подставленный ноль был бы обещанием от имени поставщика.
   */
  it('договорная стоимость в итог не подставляется', async () => {
    stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', {
        mode: 'ENABLED',
        methods: [{
          ...fixedMethod,
          requiresAddress: false,
          price: undefined,
          negotiable: true,
        }],
        pickupPoints: [],
      }),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    await waitFor(() =>
      expect(screen.getByTestId('delivery-total')).toHaveTextContent(/по договорённости/i));
    expect(screen.getByTestId('total')).toHaveTextContent('12 500');
  });

  /** Спрашивается ровно то, что требует способ: этаж и окно — не всегда. */
  it('спрашивает только обязательные поля способа', async () => {
    stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', {
        mode: 'ENABLED',
        methods: [{
          ...fixedMethod,
          requiresFloor: true,
          requiresTimeSlot: true,
          slots: [{ id: 'slot-1', fromTime: '14:00:00', toTime: '18:00:00' }],
        }],
        pickupPoints: [],
      }),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    expect(await screen.findByLabelText(/адрес доставки/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/этаж/i)).toBeInTheDocument();
    // Дата и окно стоят парой: одно без другого поставщику ничего не говорит,
    // и разнесённые по разным строкам они читаются как два вопроса подряд.
    expect(screen.getByLabelText(/дата доставки/i)).toBeInTheDocument();
    const slots = screen.getByLabelText(/окно доставки/i);
    expect(within(slots).getByRole('option', { name: '14:00–18:00' })).toBeInTheDocument();
    expect(screen.getByTestId('delivery-when').className).toContain('grid-cols-2');
  });

  /** Стоимость доставки названа строкой «подпись — сумма», а не в тексте. */
  it('стоимость доставки стоит отдельной строкой', async () => {
    stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', {
        mode: 'ENABLED',
        methods: [{ ...fixedMethod, requiresAddress: false }],
        pickupPoints: [],
      }),
    ]);

    renderScreen(<CheckoutPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    const row = await screen.findByTestId('shipping-row');
    expect(row).toHaveTextContent('Стоимость доставки');
    expect(row).toHaveTextContent('1 500 ₸');
  });
});

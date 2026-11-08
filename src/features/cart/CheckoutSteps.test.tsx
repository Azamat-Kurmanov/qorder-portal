import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutPage } from './CheckoutPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const pickupOnly = { mode: 'PICKUP_ONLY', methods: [], pickupPoints: [] };
const cart = {
  lines: [{ itemId: 'item-1', name: 'Цемент М400', quantity: 5, unit: 'мешок', priceAtAdding: 2500, price: 2500,
    priceChanged: false, total: 12500 }],
  total: 12500, skipped: [], vatPayer: true,
};

const current = () => within(screen.getByRole('list', { name: 'Шаги оформления' }))
  .getAllByRole('listitem').find((step) => step.getAttribute('aria-current') === 'step');

/** Телефон («Вариант Б»): «Товары» → «Как получить» → «Отправить», кнопкой «Дальше». */
describe('оформление по шагам на телефоне', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ведёт по трём шагам, «Назад» — на шаг раньше, «Изменить» — к способу получения', async () => {
    const { calls } = stubFetch([
      get('/api/portal/cart', cart),
      get('/api/portal/delivery', pickupOnly),
      method('POST', '/api/portal/orders', { draftId: 'draft-1', revision: 1, total: 12500 }),
    ]);
    renderScreen(<CheckoutPage />);

    // Шаг 1 — товары; отправки ещё нет.
    expect(await screen.findByRole('heading', { name: 'Корзина' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Состав заявки' })).toBeInTheDocument();
    expect(current()).toHaveTextContent('Товары');
    expect(screen.queryByRole('button', { name: /отправить заявку/i })).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: /дальше/i }));
    expect(screen.getByRole('heading', { name: 'Как получить?' })).toBeInTheDocument();
    expect(current()).toHaveTextContent('Как получить');
    expect(screen.queryByRole('region', { name: 'Состав заявки' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByRole('heading', { name: 'Корзина' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /дальше/i }));
    await userEvent.click(screen.getByRole('button', { name: /дальше/i }));
    expect(screen.getByRole('heading', { name: 'Проверьте заявку' })).toBeInTheDocument();
    expect(current()).toHaveTextContent('Отправить');
    expect(screen.getByTestId('total')).toHaveTextContent('12 500');

    await userEvent.click(screen.getByRole('button', { name: 'Изменить' }));
    expect(screen.getByRole('heading', { name: 'Как получить?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /дальше/i }));

    await userEvent.type(screen.getByLabelText(/пожелания продавцу/i), 'позвоните за час');
    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));
    await waitFor(() => {
      const submit = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(submit?.init?.body))).toEqual({ note: 'позвоните за час', credit: false });
    });
    expect(await screen.findByText(/заявка отправлена/i)).toBeInTheDocument();
  });

  it('«Как получить» — два экрана: где и когда, затем грузчики; без них — сразу к отправке', async () => {
    const delivery = {
      mode: 'ENABLED', pickupPoints: [],
      methods: [{ id: 'method-1', name: 'Доставка по городу', pickup: false, requiresAddress: false, requiresFloor: false,
        requiresTimeSlot: false, price: 1500, freeFromAmount: 20000, negotiable: false, zones: [], slots: [],
        loaders: { mode: 'ON_REQUEST', tariff: 'FIXED', amount: 3000, provider: 'OWN', payee: 'SELLER' } }],
    };
    stubFetch([get('/api/portal/cart', cart), get('/api/portal/delivery', delivery)]);
    renderScreen(<CheckoutPage />);

    // Низ корзины по макету: итог заявки и «Дальше: как получить».
    await waitFor(() => expect(screen.getByTestId('goods-total')).toHaveTextContent(/12\s500/));
    await userEvent.click(screen.getByRole('button', { name: 'Дальше: как получить' }));
    expect(screen.getByRole('heading', { name: 'Как получить?' })).toBeInTheDocument();
    // Над «Дальше» — стоимость и сколько не хватает до бесплатной.
    expect(await screen.findByTestId('delivery-foot')).toHaveTextContent(/Доставка 1\s500.*бесплатно от 20\s000.*не хватает 7\s500/);
    // Единственный способ выбирается сам; грузчики — не здесь, а на следующем экране.
    await waitFor(() => expect(screen.queryByLabelText('Нужны грузчики')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /дальше/i }));

    expect(screen.getByRole('heading', { name: 'Грузчики и перевозчик' })).toBeInTheDocument();
    expect(current()).toHaveTextContent('Как получить');
    await userEvent.click(screen.getByLabelText('Нужны грузчики'));

    await userEvent.click(screen.getByRole('button', { name: /дальше/i }));
    expect(screen.getByRole('heading', { name: 'Проверьте заявку' })).toBeInTheDocument();
    expect(screen.getByTestId('loaders-total')).toHaveTextContent(/3\s000/);

    // «Назад» с проверки — на экран грузчиков, а с него — к «где и когда».
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByRole('heading', { name: 'Грузчики и перевозчик' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByRole('heading', { name: 'Как получить?' })).toBeInTheDocument();
  });
});

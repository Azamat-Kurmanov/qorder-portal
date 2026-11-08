import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DebtPage } from './DebtPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const coat = {
  orderLineId: 'line-coat', name: 'Пальто', unit: 'шт', price: 15000, quantity: 2, returnedQuantity: 0,
  amount: 30000, paid: 0, debt: 30000, pending: 0,
};
const jacket = {
  orderLineId: 'line-jacket', name: 'Куртка', unit: 'шт', price: 8000, quantity: 3, returnedQuantity: 1,
  amount: 24000, paid: 16000, debt: 0, pending: 0,
};
const debt = {
  total: 54000, returned: 8000, paid: 16000, debt: 30000, pending: 0, claims: [], plan: [],
  // Справочник платформы: скрытый Jusan в выборе не показывается.
  banks: [['KASPI', 'Kaspi'], ['HALYK', 'Halyk'], ['FREEDOM', 'Freedom'], ['JUSAN', 'Jusan']].map(([code, name], index) => ({
    id: `b${index}`, country: 'KZ', code, name, sortOrder: index, visible: code !== 'JUSAN' })),
  orders: [{ orderId: 'o1', orderNumber: '2026-0007', issuedAt: '2026-10-20T10:00:00Z', total: 54000,
    returned: 8000, paid: 16000, debt: 30000, pending: 0, lines: [coat, jacket], payments: [] }],
};

describe('раздел «Долг»', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('показывает остаток и по товарам — что взял, вернул и оплатил', async () => {
    stubFetch([get('/api/portal/debt', debt)]);
    renderScreen(<DebtPage />);
    expect(await screen.findByTestId('debt-left')).toHaveTextContent(/30\s?000/);
    expect(screen.getByText('Пальто')).toBeInTheDocument();
    expect(screen.getByText(/вернул 1/)).toBeInTheDocument();
  });

  it('«Я оплатил» — сумма за выбранный товар уходит продавцу на подтверждение', async () => {
    const { calls } = stubFetch([
      get('/api/portal/debt', debt),
      method('POST', '/api/portal/debt/claims', { ...debt, pending: 12000 }),
    ]);
    renderScreen(<DebtPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Я оплатил' }));
    const form = screen.getByRole('heading', { name: 'Я оплатил' }).parentElement!;
    await userEvent.click(within(form).getByRole('button', { name: 'Оплатил за определённые товары' }));
    // Оплаченный целиком товар выбрать нельзя — в списке только «Пальто».
    expect(within(form).queryByText('Куртка')).not.toBeInTheDocument();
    await userEvent.click(within(form).getByRole('checkbox'));
    const amount = within(form).getByRole('spinbutton', { name: 'Сумма за «Пальто»' });
    await userEvent.clear(amount);
    await userEvent.type(amount, '12000');
    expect(within(form).getByText(/Частичная оплата: после неё останется 18\s?000/)).toBeInTheDocument();
    await userEvent.click(within(form).getByRole('button', { name: /Сообщить об оплате/ }));

    const sent = calls.find((call) => call.init?.method === 'POST');
    expect(JSON.parse(String(sent?.init?.body))).toEqual({ lines: [{ orderLineId: 'line-coat', amount: 12000 }] });
  });

  it('часть суммой раскладывается по товарам; картой — с банком карты', async () => {
    const shirt = { ...coat, orderLineId: 'line-shirt', name: 'Рубашка', debt: 5000, amount: 5000, price: 5000, quantity: 1 };
    const two = { ...debt, debt: 35000, orders: [{ ...debt.orders[0], lines: [shirt, coat] }] };
    const { calls } = stubFetch([
      get('/api/portal/debt', two),
      method('POST', '/api/portal/debt/claims', { ...two, pending: 15000 }),
    ]);
    renderScreen(<DebtPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Я оплатил' }));
    const form = screen.getByRole('heading', { name: 'Я оплатил' }).parentElement!;
    await userEvent.click(within(form).getByRole('radio', { name: 'Часть' }));
    await userEvent.type(within(form).getByRole('textbox', { name: 'Сумма' }), '15000');
    expect(within(form).getByText(/После этого останется 20\s?000/)).toBeInTheDocument();
    await userEvent.click(within(form).getByRole('radio', { name: 'Картой' }));
    // У карты не спрашиваем «куда перевели».
    const banks = within(within(form).getByRole('radiogroup', { name: 'Банк' }));
    expect(banks.queryByRole('radio', { name: 'Jusan' })).not.toBeInTheDocument();
    await userEvent.click(banks.getByRole('radio', { name: 'Freedom' }));
    expect(within(form).queryByRole('group', { name: 'Куда перевели' })).not.toBeInTheDocument();
    await userEvent.click(within(form).getByRole('button', { name: /Сообщить об оплате/ }));

    const sent = calls.find((call) => call.init?.method === 'POST');
    expect(JSON.parse(String(sent?.init?.body))).toEqual({
      lines: [{ orderLineId: 'line-shirt', amount: 5000 }, { orderLineId: 'line-coat', amount: 10000 }],
      method: 'KASPI', bank: 'FREEDOM',
    });
  });

  // Перевод: банк и, по желанию, куда в нём — на карту или на депозитный счёт.
  it('перевод — весь долг, банк и куда перевели уходят продавцу', async () => {
    const { calls } = stubFetch([
      get('/api/portal/debt', debt),
      method('POST', '/api/portal/debt/claims', { ...debt, pending: 30000 }),
    ]);
    renderScreen(<DebtPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Я оплатил' }));
    const form = screen.getByRole('heading', { name: 'Я оплатил' }).parentElement!;
    await userEvent.click(within(form).getByRole('radio', { name: 'Переводом' }));
    // Пока банк не выбран, спрашивать «куда» не о чем.
    expect(within(form).queryByRole('group', { name: 'Куда перевели' })).not.toBeInTheDocument();
    await userEvent.click(within(form).getByRole('radio', { name: 'Halyk' }));
    await userEvent.click(within(form).getByRole('radio', { name: 'На депозитный счёт' }));
    await userEvent.click(within(form).getByRole('button', { name: /Сообщить об оплате/ }));

    const sent = calls.find((call) => call.init?.method === 'POST');
    expect(JSON.parse(String(sent?.init?.body))).toEqual({
      lines: [{ orderLineId: 'line-coat', amount: 30000 }], method: 'TRANSFER', bank: 'HALYK', bankTarget: 'DEPOSIT',
    });
  });

  it('фото и описание товара; сообщение на подтверждении — частичное, сколько останется', async () => {
    const withClaim = {
      ...debt, pending: 12000,
      orders: [{ ...debt.orders[0], lines: [{ ...coat, description: 'Шерсть, серое', photo: 'https://cdn.example/coat.jpg', pending: 12000 }, jacket] }],
      claims: [{ id: 'cl1', customerId: 'c1', amount: 12000, status: 'PENDING', createdAt: '2026-11-01T10:00:00Z',
        lines: [{ orderId: 'o1', orderNumber: '2026-0007', orderLineId: 'line-coat', name: 'Пальто', amount: 12000 }] }],
    };
    stubFetch([get('/api/portal/debt', withClaim)]);
    renderScreen(<DebtPage />);
    expect(await screen.findByText('Шерсть, серое')).toBeInTheDocument();
    expect(screen.getAllByTestId('line-thumb-photo')[0]).toHaveAttribute('src', 'https://cdn.example/coat.jpg');
    expect(screen.getByText(/Частичная оплата · после подтверждения останется 18\s?000/)).toBeInTheDocument();
    expect(screen.getByText(/частично, останется 18\s?000/)).toBeInTheDocument();
  });

  it('всё оплачено — так и сказано, без «Осталось вернуть 0» и без «Я оплатил»', async () => {
    const paidLine = { ...coat, paid: 30000, debt: 0 };
    stubFetch([get('/api/portal/debt', { ...debt, paid: 46000, debt: 0,
      orders: [{ ...debt.orders[0], paid: 46000, debt: 0, lines: [paidLine, jacket] }] })]);
    renderScreen(<DebtPage />);
    expect(await screen.findByTestId('debt-left')).toHaveTextContent('Всё оплачено, долгов нет');
    expect(screen.queryByText('Осталось вернуть')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Я оплатил' })).not.toBeInTheDocument();
  });

  it('история выплат: свежие сверху, чем и кто принял, за какие товары; подтверждённые сообщения — только там', async () => {
    const pay = (id: string, amount: number, createdAt: string, extra = {}) => ({
      id, amount, createdAt, createdByName: 'Кассир', method: 'CASH', fromClient: false, linesByOrder: false,
      lines: [{ orderLineId: 'line-jacket', name: 'Куртка', quantity: 3, unit: 'шт', amount, total: 24000 }], ...extra });
    stubFetch([get('/api/portal/debt', { ...debt,
      orders: [{ ...debt.orders[0], payments: [pay('p1', 6000, '2026-10-21T10:00:00Z'),
        pay('p2', 10000, '2026-10-25T10:00:00Z', { method: 'KASPI', fromClient: true })] }],
      claims: [{ id: 'cl1', customerId: 'c1', amount: 10000, status: 'CONFIRMED', createdAt: '2026-10-25T09:00:00Z',
        lines: [{ orderId: 'o1', orderNumber: '2026-0007', orderLineId: 'line-jacket', name: 'Куртка', amount: 10000 }] }] })]);
    renderScreen(<DebtPage />);
    const history = within(await screen.findByRole('region', { name: 'История выплат' }));
    const cards = history.getAllByRole('list', { name: 'За что оплачено:' });
    expect(cards).toHaveLength(2);
    expect(history.getAllByText(/Оплата картой|Наличные/).map((n) => n.textContent)).toEqual([
      expect.stringMatching(/Оплата картой/), expect.stringMatching(/Наличные/)]);
    expect(history.getByText(/вы сообщили в кабинете/)).toBeInTheDocument();
    expect(history.getAllByText(/принял Кассир/)).toHaveLength(2);
    expect(within(cards[0]).getByText(/из 24\s000/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Сообщения об оплате' })).not.toBeInTheDocument();
  });

  it('график платежей продавца: оплаченный зачёркнут, у следующего — сколько осталось', async () => {
    stubFetch([get('/api/portal/debt', { ...debt, plan: [
      { id: 'i1', dueDate: '2099-11-10', amount: 10000, left: 0 },
      { id: 'i2', dueDate: '2099-12-10', amount: 20000, left: 15000 },
    ] })]);
    renderScreen(<DebtPage />);
    const plan = within(await screen.findByRole('list', { name: 'График платежей' }));
    const [first, second] = plan.getAllByRole('listitem');
    expect(first).toHaveTextContent('Оплачен');
    expect(second).toHaveTextContent(/осталось\s15\s?000/);
  });

  it('без заказов под реализацию — пусто', async () => {
    stubFetch([get('/api/portal/debt', { ...debt, orders: [], total: 0, paid: 0, returned: 0, debt: 0 })]);
    renderScreen(<DebtPage />);
    expect(await screen.findByText(/Долгов нет/)).toBeInTheDocument();
  });
});

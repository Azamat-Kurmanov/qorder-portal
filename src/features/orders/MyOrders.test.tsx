import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyOrdersPage } from './MyOrdersPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  orderNumber: '2026-00042',
  state: 'IN_REVIEW',
  needsAnswer: false,
  cancellable: true,
  createdAt: '2026-09-01T10:00:00Z',
  total: 12500,
  submitted: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2500, amount: 12500 }],
  diff: [],
  ...overrides,
});

/** Заявка, по которой ход за клиентом: изменённый состав и две кнопки. */
const needsAnswer = order({
  id: 'order-need',
  state: 'AWAITING_CONFIRMATION',
  needsAnswer: true,
  createdAt: '2026-09-04T10:00:00Z',
  total: 61500,
  diff: [
    { kind: 'QUANTITY_CHANGED', name: 'Песок', was: 1, now: 0.8 },
    { kind: 'PRICE_CHANGED', name: 'Цемент М400', was: 2500, now: 2450 },
  ],
});

const atSupplier = order({
  id: 'order-review',
  state: 'IN_REVIEW',
  createdAt: '2026-09-03T10:00:00Z',
  total: 128400,
  submitted: Array.from({ length: 6 }, (_, index) => ({
    name: `Позиция ${index + 1}`,
    quantity: 1,
    unit: 'шт',
    price: 100,
    amount: 100,
  })),
});

const accepted = order({
  id: 'order-accepted',
  state: 'ACCEPTED',
  cancellable: false,
  createdAt: '2026-08-28T10:00:00Z',
  total: 44000,
});

const closed = order({
  id: 'order-closed',
  state: 'CLOSED',
  cancellable: false,
  createdAt: '2026-08-21T10:00:00Z',
  total: 9800,
});

/** Список приходит в порядке сервера: ждущая ответа первой. */
const wholeList = [needsAnswer, atSupplier, accepted, closed];

function openOrders(orders: unknown[] = wholeList, extra: ReturnType<typeof method>[] = []) {
  // Точные адреса выше общего списка: совпадение идёт по вхождению подстроки,
  // и правило списка перехватило бы подтверждение с отказом.
  const stub = stubFetch([...extra, get('/api/portal/orders', orders)]);
  renderScreen(<MyOrdersPage />);
  return stub;
}

/** Карточка заявки — по видимой дате: она же ссылка на саму заявку. */
const cardOf = (day: RegExp): HTMLElement =>
  screen.getByRole('link', { name: day }).closest('[data-testid="order-row"]') as HTMLElement;

/**
 * Список заявок.
 *
 * Клиент приходит сюда с одним вопросом: что с моей заявкой. Ответ — группы
 * по тому, за кем ход: сначала то, где ждут его, потом то, что у продавца,
 * потом решённое. Внутри группы порядок задаёт сервер.
 */
describe('мои заявки', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('делит заявки на группы по тому, за кем ход', async () => {
    openOrders();

    // Заголовками, а не цветом: «нужен ваш ответ» стоит первым по месту
    // на экране, и это видно, ещё не начав читать карточки.
    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Нужен ваш ответ',
      'У продавца',
      'Решённые',
    ]);
  });

  it('в группе «нужен ваш ответ» видно, что изменил продавец, прямо в строке', async () => {
    openOrders();

    const [card] = await screen.findAllByTestId('order-row');
    expect(within(card).getByText(/заявка от 4 сентября/i)).toBeInTheDocument();
    expect(within(card).getByText(/61 500/)).toBeInTheDocument();
    // Ради этого клиент сюда и зашёл: что именно поменяли, не открывая заявку.
    expect(within(card).getByTestId('diff')).toHaveTextContent(
      'Продавец изменил состав: Песок — количество 1 → 0,8, Цемент М400 — цена 2 500 ₸ → 2 450 ₸',
    );
  });

  it('согласие уходит кнопкой прямо из списка', async () => {
    const { calls } = openOrders(wholeList, [
      method('POST', '/api/portal/orders/order-need/confirm', {
        ...needsAnswer, state: 'ACCEPTED', needsAnswer: false,
      }),
    ]);

    await userEvent.click(await screen.findByRole('button', { name: /^согласен/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/order-need/confirm'))).toBe(true);
    });
  });

  it('отказ уходит своей кнопкой', async () => {
    const { calls } = openOrders(wholeList, [
      method('POST', '/api/portal/orders/order-need/decline', {
        ...needsAnswer, state: 'CLOSED', needsAnswer: false,
      }),
    ]);

    await userEvent.click(await screen.findByRole('button', { name: /^отменить/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/order-need/decline'))).toBe(true);
    });
  });

  /**
   * Согласие и отказ необратимы. Названы они вместе с заявкой: «Согласен»
   * без даты в списке из четырёх заявок не отличить от соседнего — ни на
   * слух, ни в перечне ссылок экранного диктора.
   */
  it('необратимые кнопки названы вместе с заявкой', async () => {
    openOrders();

    expect(
      await screen.findByRole('button', { name: /согласен с изменениями в заявке от 4 сентября/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /отменить заявку от 4 сентября/i }),
    ).toBeInTheDocument();
  });

  it('состояние показано пилюлей словами клиента', async () => {
    openOrders();

    expect(within(await screen.findByTestId('group-supplier')).getByText(/на проверке/i))
      .toBeInTheDocument();
    expect(within(cardOf(/заявка от 28 августа/i)).getByText(/принята/i)).toBeInTheDocument();
    expect(within(cardOf(/заявка от 21 августа/i)).getByText(/закрыта/i)).toBeInTheDocument();
    // Внутренние статусы наружу не выходят: они про работу менеджера.
    expect(screen.queryByText(/READY_FOR_CHECK|AWAITING_STOCK/)).not.toBeInTheDocument();
  });

  it('под датой стоит состав заявки', async () => {
    openOrders();
    await screen.findAllByTestId('order-row');

    expect(within(cardOf(/заявка от 3 сентября/i)).getByText(/6 позиций/i)).toBeInTheDocument();
  });

  /**
   * Повтор берётся у принятой заявки: у закрытой повторять нечего — за
   * ней может стоять отказ, то есть набор, от которого отказались.
   */
  it('повторить предлагает принятая заявка, и только она', async () => {
    openOrders();

    const repeat = await screen.findAllByRole('button', { name: /повторить/i });
    expect(repeat).toHaveLength(1);
    expect(cardOf(/заявка от 28 августа/i)).toContainElement(repeat[0]);
  });

  /** Внутри группы порядок задаёт сервер, а не дата на клиенте. */
  it('сохраняет порядок сервера внутри группы', async () => {
    openOrders([
      order({ id: 'order-a', createdAt: '2026-09-02T10:00:00Z', total: 100 }),
      order({ id: 'order-b', createdAt: '2026-09-03T10:00:00Z', total: 200 }),
    ]);

    const rows = await screen.findAllByTestId('order-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText(/заявка от 2 сентября/i)).toBeInTheDocument();
  });

  it('пустой список отвечает словами, а не пустым экраном', async () => {
    openOrders([]);

    expect(await screen.findByText(/заявок пока нет/i)).toBeInTheDocument();
  });
});

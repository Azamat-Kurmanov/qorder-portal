import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyOrdersPage } from './MyOrdersPage';
import { renderScreen } from '../../test/render';
import { stubWideScreen } from '../../test/wideScreen';
import { get, method, stubFetch } from '../../test/http';
import type { Currency } from '../../shared/currency';
import { setCurrentSupplierId } from '../../supplier/supplier';

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  orderNumber: '1041',
  state: 'IN_REVIEW',
  needsAnswer: false,
  cancellable: true,
  createdAt: '2026-09-01T10:00:00Z',
  total: 12500,
  currency: 'KZT',
  submitted: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2500, amount: 12500 }],
  diff: [],
  invoiceAvailable: false,
  messages: [],
  ...overrides,
});

/** Заявка, по которой ход за клиентом: изменённый состав и две кнопки. */
const needsAnswer = order({
  id: 'order-need',
  orderNumber: '1046',
  state: 'AWAITING_CONFIRMATION',
  needsAnswer: true,
  createdAt: '2026-09-04T10:00:00Z',
  total: 62500,
  proposedTotal: 61500,
  proposed: [
    { name: 'Песок', quantity: 0.8, unit: 'т', price: 5000, amount: 4000 },
    { name: 'Цемент М400', quantity: 23, unit: 'мешок', price: 2500, amount: 57500 },
  ],
  diff: [
    { kind: 'QUANTITY_CHANGED', name: 'Песок', was: 1, now: 0.8 },
    { kind: 'PRICE_CHANGED', name: 'Цемент М400', was: 2500, now: 2450 },
  ],
});

const atSupplier = order({
  id: 'order-review',
  orderNumber: '1043',
  createdAt: '2026-09-03T10:00:00Z',
  total: 128400,
  submitted: Array.from({ length: 6 }, (_, index) => ({
    name: `Позиция ${index + 1}`, quantity: 1, unit: 'шт', price: 100, amount: 100,
  })),
});

const accepted = order({
  id: 'order-accepted', orderNumber: '1040', state: 'ACCEPTED', cancellable: false,
  createdAt: '2026-08-28T10:00:00Z', total: 44000,
});

const ready = order({
  id: 'order-ready', orderNumber: '1045', state: 'READY', cancellable: false, pickup: true,
  readyAt: '2026-09-05T10:00:00Z',
  pickupPoint: { name: 'Барахолка «Кенжехан-2»', address: 'ряд 4', workingHours: '7:00–17:00' },
  pickupCode: '4821',
});

const closed = order({
  id: 'order-closed', orderNumber: '1039', state: 'CLOSED', cancellable: false,
  createdAt: '2026-08-21T10:00:00Z', total: 9800, closedBy: 'SELLER', cancelReason: 'Товар снят с производства',
});

const wholeList = [needsAnswer, atSupplier, accepted, ready, closed];

/** Новое по заявкам, где ход за клиентом: такие открыты сразу. */
const fresh = [
  { id: 'n-need', draftId: 'order-need', kind: 'RENEGOTIATION', createdAt: '2026-09-06T09:00:00Z' },
  { id: 'n-ready', draftId: 'order-ready', kind: 'ACCEPTED', createdAt: '2026-09-06T09:30:00Z' },
];

/** Телефон показывает короткие строки, монитор — список и панель заявки справа. */
let cards = true;
/** Магазин принимает отзывы и оценки (R-17); тест на выключенные снимает признак сам. */
let shopReviews: boolean | undefined = true;

function openOrders(
  orders: unknown[] = wholeList,
  extra: ReturnType<typeof method>[] = [],
  notifications: unknown[] = fresh,
  shopCurrency?: Currency | null,
) {
  // Точные адреса выше общего списка: совпадение идёт по вхождению подстроки.
  if (cards) {
    stubWideScreen();
    setCurrentSupplierId('supplier-1');
  }
  const stub = stubFetch([
    ...extra,
    get('/api/portal/notifications', notifications),
    get('/api/portal/orders', orders),
    ...(cards ? [get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'Магазин', currency: 'KZT',
      reviews: shopReviews}])] : []),
  ]);
  renderScreen(<MyOrdersPage />, shopCurrency === undefined ? {} : { currency: shopCurrency });
  return stub;
}

/** Строка заявки в списке слева. */
const rowOf = (number: string): HTMLElement => {
  const row = screen.getAllByTestId('order-row').find((element) => element.textContent?.includes(`№${number}`));
  if (!row) throw new Error(`нет строки заявки №${number}`);
  return row;
};
/** Заявка в панели справа: если открыта другая, нажатие строки открывает эту. */
const card = (number: string): HTMLElement => {
  if (screen.queryByTestId('order-pane')?.getAttribute('aria-label') !== `Заявка №${number}`) fireEvent.click(rowOf(number));
  return screen.getByTestId('order-pane');
};
const chip = (name: RegExp) => within(screen.getByRole('group', { name: 'Какие заявки показать' }))
  .getByRole('button', { name });

/**
 * Мои заявки v2: одна лента с чипами, поиском и сортировкой. Где ход
 * за клиентом, заявка открыта сразу и отвечает прямо из списка.
 */
describe('мои заявки', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('чипы считают заявки по видам; «Принята» — у продавца', async () => {
    openOrders();
    await screen.findAllByTestId('order-row');

    expect(chip(/^Все/)).toHaveTextContent('5');
    expect(chip(/Нужен ваш ответ/)).toHaveTextContent('1');
    expect(chip(/Можно забирать/)).toHaveTextContent('1');
    expect(chip(/У продавца/)).toHaveTextContent('2');
    expect(chip(/Отменены/)).toHaveTextContent('1');

    await userEvent.click(chip(/У продавца/));
    expect(screen.getAllByTestId('order-row')).toHaveLength(2);
    expect(rowOf('1040')).toHaveTextContent('Принята');
  });

  it('в заявке, ждущей ответа, — тот же ответ на изменения, что на экране заявки', async () => {
    openOrders();
    await screen.findAllByTestId('order-row');
    const need = card('1046');

    const changes = within(need).getByTestId('line-answers');
    expect(changes).toHaveTextContent('Поставщик предлагает изменения');
    expect(within(changes).getByTestId('diff')).toHaveTextContent('Песок — количество 1 → 0,8');
    expect(within(changes).getByTestId('diff')).toHaveTextContent('Цемент М400 — цена 2 500 ₸ → 2 450 ₸');
    // Составом показано предложенное: согласие относится к нему.
    expect(within(need).getByText('Песок')).toBeInTheDocument();
    expect(within(need).getByText(/23 мешка × 2 500/)).toBeInTheDocument();
    expect(within(need).getByText('Нужно: ответить продавцу')).toBeInTheDocument();
  });

  it('сумма было → стало и разбор изменений — в валюте заявки, а не открытого магазина', async () => {
    openOrders([{ ...needsAnswer, currency: 'RUB' }, atSupplier, accepted, ready, closed], [], fresh, 'USD');
    await screen.findAllByTestId('order-row');
    const need = card('1046');

    expect(within(need).getByTestId('diff')).toHaveTextContent('Цемент М400 — цена 2 500 ₽ → 2 450 ₽');
    expect(need.textContent).not.toContain('$');
  });

  it('заявка в своей валюте, даже когда открытый магазин — в другой', async () => {
    const rub = order({
      id: 'order-rub',
      orderNumber: '1050',
      currency: 'RUB',
      total: 3500,
      submitted: [
        { name: 'Цемент М400', quantity: 2, unit: 'мешок', price: 1000, amount: 2000 },
        { name: 'Песок', quantity: 1, unit: 'т', price: 1500, amount: 1500 },
      ],
    });
    openOrders([rub], [], [], 'USD');
    await screen.findAllByTestId('order-row');
    card('1050');
    const row = card('1050');

    // Цена за единицу.
    expect(within(row).getByText(/2 мешка × 1 000 ₽/)).toBeInTheDocument();
    // Сумма строки.
    expect(within(row).getByText('2 000 ₽')).toBeInTheDocument();
    // Итог заявки.
    expect(within(row).getAllByText('3 500 ₽').length).toBeGreaterThan(0);
    expect(row.textContent).not.toContain('$');
  });

  it('оптовая строка называет и упаковки, и штуки', async () => {
    const packs = order({
      id: 'order-packs',
      orderNumber: '1051',
      total: 5400,
      submitted: [
        { name: 'Цемент М400', quantity: 3, unit: 'упаковка', price: 1800, amount: 5400, packQty: 20, pieceUnit: 'мешок' },
        // Позиции больше нет в каталоге — единица штук неизвестна, остаётся вложение числом.
        { name: 'Гвозди', quantity: 2, unit: 'коробка', price: 900, amount: 1800, packQty: 50 },
        { name: 'Худи — пресс', quantity: 1, unit: 'пресс', price: 45000, amount: 45000, pack: [{ name: 'Худи · S', quantity: 1, unit: 'шт' }] },
      ],
    });
    openOrders([packs], [], [], 'KZT');
    await screen.findAllByTestId('order-row');
    card('1051');
    const row = card('1051');

    expect(within(row).getByText(/3 упаковки × 1\s800 ₸ · 60 мешков/)).toBeInTheDocument();
    expect(within(row).getByText(/2 коробки × 900 ₸ · по 50/)).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Что внутри' }));
    expect(within(row).getByTestId('pack-contents')).toHaveTextContent('Худи · S');
  });

  it('согласие уходит кнопкой прямо из списка', async () => {
    const { calls } = openOrders(wholeList, [
      method('POST', '/api/portal/orders/order-need/confirm', { ...needsAnswer, state: 'ACCEPTED', needsAnswer: false }),
    ]);

    await screen.findAllByTestId('order-row');
    card('1046');
    await userEvent.click(screen.getByRole('button', { name: 'Согласен со всем' }));
    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/order-need/confirm'))).toBe(true);
    });
  });

  it('после «Согласен» строка заявки не сворачивается', async () => {
    const answered = { ...needsAnswer, state: 'ACCEPTED', needsAnswer: false, proposed: undefined, diff: [] };
    let list: unknown[] = wholeList;
    stubFetch([
      {
        match: (url, init) => url.includes('/order-need/confirm') && init?.method === 'POST',
        get body() {
          list = [answered, atSupplier, accepted, ready, closed];
          return answered;
        },
      },
      get('/api/portal/notifications', fresh),
      { match: (url, init) => url.includes('/api/portal/orders') && (init?.method ?? 'GET') === 'GET', get body() { return list; } },
      get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'Магазин', currency: 'KZT'}]),
    ]);
    stubWideScreen();
    setCurrentSupplierId('supplier-1');
    renderScreen(<MyOrdersPage />);

    await screen.findAllByTestId('order-row');
    card('1046');
    await userEvent.click(screen.getByRole('button', { name: 'Согласен со всем' }));
    await waitFor(() => expect(card('1046')).toHaveTextContent('Ничего делать не нужно — собираем заявку'));
  });

  it('отказа одним касанием в списке нет — только через окно с причиной', async () => {
    const { calls } = openOrders(wholeList);

    await screen.findAllByTestId('order-row');
    card('1046');
    await userEvent.click(screen.getByRole('button', { name: 'Отказаться от заявки…' }));
    const dialog = screen.getByTestId('decline-dialog');
    expect(within(dialog).getByRole('button', { name: 'Остаться' })).toHaveFocus();
    expect(calls.some((call) => call.url.includes('/decline'))).toBe(false);
  });

  it('собранная заявка говорит, где забрать', async () => {
    openOrders();
    await screen.findAllByTestId('order-row');

    expect(within(card('1045')).getByText('Нужно: забрать в магазине')).toBeInTheDocument();
    expect(within(card('1045')).getByText('Барахолка «Кенжехан-2» · ряд 4 · 7:00–17:00')).toBeInTheDocument();
  });

  it('у идущей заявки — «Задать вопрос», у завершённой — «Заказать то же ещё раз»', async () => {
    openOrders([atSupplier, order({ id: 'order-issued', orderNumber: '1030', state: 'ISSUED', cancellable: false })]);
    await screen.findAllByTestId('order-row');

    expect(within(card('1043')).getByRole('button', { name: 'Задать вопрос' })).toBeInTheDocument();
    expect(within(card('1043')).queryByRole('button', { name: /заказать то же ещё раз/i })).not.toBeInTheDocument();
    expect(within(card('1030')).getByRole('button', { name: /заказать то же ещё раз/i })).toBeInTheDocument();
    expect(within(card('1030')).queryByRole('button', { name: 'Задать вопрос' })).not.toBeInTheDocument();
  });

  it('отменённая заявка говорит, кто её закрыл и почему', async () => {
    openOrders();
    await screen.findAllByTestId('order-row');
    card('1039');

    expect(within(card('1039')).getAllByText('Продавец отменил заявку').length).toBeGreaterThan(0);
    expect(within(card('1039')).getByText(/Товар снят с производства/)).toBeInTheDocument();
  });

  it('поиск — по номеру и по названию товара', async () => {
    openOrders();
    await screen.findAllByTestId('order-row');
    const search = screen.getByRole('searchbox', { name: /Номер заявки/ });
    expect(search).toHaveClass('placeholder:text-ink-subtle');

    await userEvent.type(search, 'позиция 3');
    expect(screen.getAllByTestId('order-row')).toHaveLength(1);
    expect(card('1043')).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, '1040');
    expect(screen.getAllByTestId('order-row')).toHaveLength(1);

    await userEvent.type(search, '999');
    expect(screen.getByText('Ничего не нашли')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    expect(search).toHaveValue('');
    expect(screen.getAllByTestId('order-row').length).toBeGreaterThan(1);
  });

  it('новое по заявке — метка у строки и наверху списка; открытие читает уведомления', async () => {
    const { calls } = openOrders(wholeList, [
      method('POST', '/api/portal/notifications/n-1/read', null, 204),
    ], [
      { id: 'n-1', draftId: 'order-review', kind: 'ORDER_ANSWERED', createdAt: '2026-09-06T10:00:00Z' },
    ]);

    await screen.findAllByTestId('order-row');
    // Заявка с новым поднимается наверх.
    expect(screen.getAllByTestId('order-row')[0]).toBe(rowOf('1043'));
    expect(within(rowOf('1043')).getByRole('img', { name: 'Новое' })).toBeInTheDocument();

    await userEvent.click(rowOf('1043'));
    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/notifications/n-1/read'))).toBe(true);
    });
  });
  it('последнее сообщение переписки — строкой в карточке', async () => {
    openOrders([order({
      messages: [
        { author: 'CUSTOMER', text: 'Можно после шести?', createdAt: '2026-09-02T10:00:00Z' },
        { author: 'MANAGER', text: 'Да, до девяти', createdAt: '2026-09-02T11:00:00Z' },
      ],
    })]);

    expect(await screen.findByText('Да, до девяти')).toBeInTheDocument();
  });

  it('вопрос по заявке уходит в её переписку', async () => {
    const { calls } = openOrders([atSupplier], [
      method('POST', '/api/portal/orders/order-review/questions', {
        ...atSupplier, messages: [{ author: 'CUSTOMER', text: 'Когда будет?', createdAt: '2026-09-03T12:00:00Z' }],
      }),
    ]);

    await screen.findAllByTestId('order-row');
    card('1043');
    await userEvent.click(within(card('1043')).getByRole('button', { name: 'Задать вопрос' }));
    expect(screen.getByRole('textbox', { name: 'Ваш вопрос продавцу' })).toHaveClass('placeholder:text-ink-subtle');
    await userEvent.type(screen.getByRole('textbox', { name: 'Ваш вопрос продавцу' }), 'Когда будет?');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => {
      const call = calls.find((candidate) => candidate.url.includes('/order-review/questions'));
      expect(call?.init?.body).toBe(JSON.stringify({ text: 'Когда будет?' }));
    });
  });

  it('у полученной заявки — «Сообщить о проблеме»: вид, товар, сколько и подробности уходят в переписку', async () => {
    const issued = order({ id: 'order-issued', orderNumber: '1030', state: 'ISSUED', cancellable: false });
    const { calls } = openOrders([issued], [
      method('POST', '/api/portal/orders/order-issued/questions', issued),
    ]);

    await screen.findAllByTestId('order-row');
    card('1030');
    await userEvent.click(within(card('1030')).getByRole('button', { name: 'Сообщить о проблеме' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Брак' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Цемент М400' }));
    const howMany = screen.getByRole('spinbutton', { name: /сколько/ });
    expect(howMany).toHaveValue(5);
    await userEvent.clear(howMany);
    await userEvent.type(howMany, '50');
    // Больше, чем в заказе, не вводится.
    expect(howMany).toHaveValue(5);
    await userEvent.clear(howMany);
    await userEvent.type(howMany, '2');
    await userEvent.type(screen.getByRole('textbox', { name: 'Подробности' }), 'Порваны');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить продавцу' }));

    await waitFor(() => {
      const call = calls.find((candidate) => candidate.url.includes('/order-issued/questions'));
      expect(call?.init?.body).toBe(JSON.stringify({ text: 'Проблема с заказом: Брак\n— Цемент М400: 2 мешка\nПорваны' }));
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Продавец получил сообщение');
  });

  it('полученный заказ оценивается: «всё хорошо» — одним касанием, «были проблемы» — с причиной', async () => {
    const issued = order({ id: 'order-issued', orderNumber: '1030', state: 'ISSUED', cancellable: false });
    const { calls } = openOrders([issued], [
      method('PUT', '/api/portal/orders/order-issued/rating', { ...issued, rating: { good: false, reason: 'LATE' } }),
    ]);

    await screen.findAllByTestId('order-row');
    card('1030');
    await userEvent.click(await within(card('1030')).findByRole('button', { name: 'Были проблемы' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Опоздали' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Пара слов продавцу' }), 'На день позже');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить оценку' }));

    await waitFor(() => {
      const call = calls.find((candidate) => candidate.url.includes('/order-issued/rating'));
      expect(call?.init?.body).toBe(JSON.stringify({ good: false, reason: 'LATE', comment: 'На день позже' }));
    });
  });

  it('магазин без отзывов: ни оценки заказа, ни «Оценить товар» (R-17)', async () => {
    shopReviews = undefined;
    try {
      openOrders([order({ id: 'order-issued', orderNumber: '1030', state: 'ISSUED', cancellable: false,
        lines: [{ lineNo: 1, name: 'Цемент', itemId: 'item-1', quantity: 1, unit: 'шт', unitPrice: 100, amount: 100 }] })]);
      await screen.findAllByTestId('order-row');
    card('1030');
      expect(within(card('1030')).queryByRole('button', { name: 'Были проблемы' })).not.toBeInTheDocument();
      expect(within(card('1030')).queryByText('Оценить товар')).not.toBeInTheDocument();
    } finally {
      shopReviews = true;
    }
  });

  it('поставленная оценка видна словами, и её можно изменить', async () => {
    openOrders([order({ id: 'order-issued', orderNumber: '1030', state: 'ISSUED', cancellable: false, rating: { good: false, reason: 'INCOMPLETE' } })]);
    await screen.findAllByTestId('order-row');
    card('1030');

    expect(await within(card('1030')).findByTestId('order-rating')).toHaveTextContent('Ваша оценка: были проблемы — привезли не всё');
    await userEvent.click(within(card('1030')).getByRole('button', { name: 'Изменить' }));
    expect(within(card('1030')).getByRole('button', { name: 'Всё хорошо' })).toBeInTheDocument();
  });

  it('у идущей заявки сообщить о проблеме нельзя — товар ещё не получен', async () => {
    openOrders([atSupplier]);
    await screen.findAllByTestId('order-row');
    card('1043');

    expect(within(card('1043')).queryByRole('button', { name: 'Сообщить о проблеме' })).toBeNull();
  });

  it('Enter в вопросе по заявке отправляет его продавцу', async () => {
    const { calls } = openOrders([atSupplier], [
      method('POST', '/api/portal/orders/order-review/questions', {
        ...atSupplier, messages: [{ author: 'CUSTOMER', text: 'Когда будет?', createdAt: '2026-09-03T12:00:00Z' }],
      }),
    ]);

    await screen.findAllByTestId('order-row');
    card('1043');
    await userEvent.click(within(card('1043')).getByRole('button', { name: 'Задать вопрос' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Ваш вопрос продавцу' }), 'Когда будет?{Enter}');

    await waitFor(() => {
      const call = calls.find((candidate) => candidate.url.includes('/order-review/questions'));
      expect(call?.init?.body).toBe(JSON.stringify({ text: 'Когда будет?' }));
    });
  });

  it('по десять на странице и переход между страницами', async () => {
    openOrders(Array.from({ length: 12 }, (_, index) => order({
      id: `o-${index}`, orderNumber: String(2000 + index),
      createdAt: `2026-09-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
    })));
    await screen.findAllByTestId('order-row');

    expect(screen.getAllByTestId('order-row')).toHaveLength(10);
    expect(screen.getAllByText('Показано 1–10 из 12').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Страница 2' }));
    expect(screen.getAllByTestId('order-row')).toHaveLength(2);
    expect(screen.getAllByText('Показано 11–12 из 12').length).toBeGreaterThan(0);
  });

  describe('этапы заявки, подсказка о статусах и звонок продавцу', () => {
    const shop = (phone?: string) => get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'ИП «Мухамедиева»', phone,
      currency: 'KZT'}]);

    it('у идущей заявки шкала из четырёх этапов и отмечено, где она сейчас', async () => {
      openOrders([atSupplier]);
      await screen.findAllByTestId('order-row');
    card('1043');

      const stages = within(card('1043')).getByRole('list', { name: 'Этапы заявки' });
      expect(within(stages).getAllByRole('listitem')).toHaveLength(4);
      const now = within(stages).getByText('Продавец проверяет').closest('li');
      expect(now).toHaveAttribute('aria-current', 'step');
      expect(now).toHaveTextContent('Сейчас здесь');
    });

    it('у собранной с доставкой последний этап — «Собрана»', async () => {
      openOrders([{ ...ready, pickup: false, pickupPoint: undefined, pickupCode: undefined }], [], []);
      await screen.findAllByTestId('order-row');
    card('1045');

      const stages = within(card('1045')).getByRole('list', { name: 'Этапы заявки' });
      expect(within(stages).getByText('Собрана').closest('li')).toHaveAttribute('aria-current', 'step');
    });

    it('у полученной и отменённой заявки шкалы нет', async () => {
      openOrders([closed], [], []);
      await screen.findAllByTestId('order-row');
    card('1039');
      expect(within(card('1039')).queryByRole('list', { name: 'Этапы заявки' })).not.toBeInTheDocument();
    });

    it('«Позвонить продавцу» набирает номер магазина у идущей заявки', async () => {
      openOrders([atSupplier], [shop('+7 701 000 00 11')]);
      await screen.findAllByTestId('order-row');
    card('1043');

      const call = await within(card('1043')).findByRole('link', { name: 'Позвонить продавцу' });
      expect(call).toHaveAttribute('href', 'tel:+77010000011');
    });

    it('без телефона магазина звонить некуда — кнопки нет', async () => {
      openOrders([atSupplier], [shop(undefined)]);
      await screen.findAllByTestId('order-row');
    card('1043');
      await screen.findByRole('list', { name: 'Этапы заявки' });
      expect(within(card('1043')).queryByRole('link', { name: 'Позвонить продавцу' })).not.toBeInTheDocument();
    });
  });

  it('по двадцать на странице — все двенадцать сразу, без листания', async () => {
    openOrders(Array.from({ length: 12 }, (_, index) => order({
      id: `o-${index}`, orderNumber: String(2000 + index),
      createdAt: `2026-09-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
    })));
    await screen.findAllByTestId('order-row');

    await userEvent.selectOptions(screen.getByLabelText('На странице'), '20');

    expect(screen.getAllByTestId('order-row')).toHaveLength(12);
    expect(screen.queryByRole('navigation', { name: 'Страницы' })).not.toBeInTheDocument();
  });

  it('«Заказать то же ещё раз» у отменённой кладёт в корзину состав этой заявки', async () => {
    const { calls } = openOrders(wholeList, [
      method('POST', '/api/portal/cart/from-order/order-closed', { lines: [], total: 0, skipped: [] }),
    ]);
    await screen.findAllByTestId('order-row');

    card('1039');
    await userEvent.click(screen.getByRole('button', { name: 'Заказать то же ещё раз: Заявка №1039' }));
    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/cart/from-order/order-closed'))).toBe(true);
    });
  });

  it('у заявки «Можно забирать» — место и код для получения', async () => {
    openOrders();
    await screen.findAllByTestId('order-row');

    const code = within(card('1045')).getByTestId('pickup-code');
    expect(code).toHaveTextContent('Код для получения');
    expect(code).toHaveTextContent('4821');
    expect(within(card('1045')).getByText(/Кенжехан-2/)).toBeInTheDocument();
  });

  it('у полученной заявки с одним товаром «Оценить товар» ведёт к отзывам в его карточке', async () => {
    openOrders([order({
      id: 'order-issued', orderNumber: '1030', state: 'ISSUED', cancellable: false,
      submitted: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2500, amount: 12500, itemId: 'item-1' }],
    })]);
    await screen.findAllByTestId('order-row');
    card('1030');

    expect(await within(card('1030')).findByRole('link', { name: 'Оценить товар' }))
      .toHaveAttribute('href', '/catalog/item-1#reviews');
  });

  it('у полученной заявки с несколькими товарами «Оценить товар» раскрывает их список', async () => {
    openOrders([order({
      id: 'order-issued', orderNumber: '1030', state: 'ISSUED', cancellable: false,
      submitted: [
        { name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2500, amount: 12500, itemId: 'item-1' },
        { name: 'Песок', quantity: 1, unit: 'т', price: 5000, amount: 5000, itemId: 'item-2' },
        { name: 'Ротбанд', quantity: 1, unit: 'мешок', price: 3000, amount: 3000 },
      ],
    })]);
    await screen.findAllByTestId('order-row');
    card('1030');

    const rate = await within(card('1030')).findByRole('button', { name: 'Оценить товар' });
    expect(rate).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(rate);
    expect(rate).toHaveAttribute('aria-expanded', 'true');

    const list = within(card('1030')).getByRole('list', { name: 'Какой товар оценить' });
    expect(within(list).getByRole('link', { name: 'Оценить: Цемент М400' }))
      .toHaveAttribute('href', '/catalog/item-1#reviews');
    expect(within(list).getByRole('link', { name: 'Оценить: Песок' }))
      .toHaveAttribute('href', '/catalog/item-2#reviews');
    // Снятый с продажи — назван, но без ссылки: оценивать негде.
    expect(within(list).getByText('Ротбанд')).toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: /Ротбанд/ })).not.toBeInTheDocument();
  });

  it('пустой список отвечает словами, а не пустым экраном', async () => {
    openOrders([]);

    expect(await screen.findByText(/заявок пока нет/i)).toBeInTheDocument();
  });
});

describe('снимки товаров в заявке', () => {
  afterEach(() => vi.unstubAllGlobals());

  const pictured = order({
    submitted: [
      { name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2500, amount: 12500,
        itemId: 'item-1', imageUrl: 'https://cdn.example.kz/cement.jpg' },
      { name: 'Песок', quantity: 1, unit: 'т', price: 5000, amount: 5000, itemId: 'item-2' },
      { name: 'Ротбанд', quantity: 1, unit: 'мешок', price: 3000, amount: 3000 },
    ],
  });

  it('«Что вы заказали» — строка со снимком ведёт на карточку, без снимка — заглушка', async () => {
    openOrders([pictured], [], []);
    await screen.findAllByTestId('order-row');
    card('1041');
    const row = card('1041');

    const cement = within(row).getByRole('link', { name: 'Открыть товар: Цемент М400' });
    expect(cement).toHaveAttribute('href', '/catalog/item-1');
    expect(within(cement).getByTestId('line-thumb-photo'))
      .toHaveAttribute('src', 'https://cdn.example.kz/cement.jpg');

    // Снимка нет, а позиция жива: заглушка, но карточка открывается.
    const sand = within(row).getByRole('link', { name: 'Открыть товар: Песок' });
    expect(within(sand).queryByTestId('line-thumb-photo')).not.toBeInTheDocument();
    expect(within(sand).getByTestId('line-thumb')).toBeInTheDocument();

    // Позиции больше нет в каталоге: открывать нечего.
    expect(within(row).queryByRole('link', { name: 'Открыть товар: Ротбанд' })).not.toBeInTheDocument();
    expect(within(row).getAllByTestId('line-thumb')).toHaveLength(3);
  });
});

/**
 * Из чего сложился итог — как в сводке оформления: «Товары», скидка
 * на заявку цветом скидки, «Доставка» и «Итого». Строки есть только
 * у отправленной редакции: у предложенной продавцом разбивки нет.
 */
describe('итог заявки в списке', () => {
  afterEach(() => vi.unstubAllGlobals());

  const discounted = order({
    total: 13125,
    goodsTotal: 12500,
    discount: { kind: 'VOLUME', percent: 5, amount: 625 },
    deliveryPrice: 1250,
  });

  it('строки «Товары / Скидка за объём / Доставка / Итого»', async () => {
    openOrders([discounted], [], []);
    await screen.findAllByTestId('order-row');
    card('1041');
    const totals = within(card('1041')).getByTestId('order-totals');

    expect(within(totals).getByTestId('order-goods')).toHaveTextContent(/Товары\s*12\s500\s₸/);
    const discount = within(totals).getByTestId('order-discount');
    expect(discount).toHaveTextContent(/Скидка за объём −5%\s*−625\s₸/);
    expect(discount).toHaveClass('text-sale-ink');
    expect(within(totals).getByTestId('order-delivery')).toHaveTextContent(/Доставка\s*1\s250\s₸/);
    expect(within(totals).getByTestId('order-total')).toHaveTextContent(/Итого\s*13\s125\s₸/);
  });

  it('скидка на первую заявку и бесплатная доставка', async () => {
    openOrders([order({
      total: 11250, goodsTotal: 12500, discount: { kind: 'FIRST_ORDER', percent: 10, amount: 1250 }, deliveryPrice: 0,
    })], [], []);
    await screen.findAllByTestId('order-row');
    card('1041');
    const totals = within(card('1041')).getByTestId('order-totals');

    expect(within(totals).getByTestId('order-discount')).toHaveTextContent(/Скидка на первую заявку −10%\s*−1\s250\s₸/);
    expect(within(totals).getByTestId('order-delivery')).toHaveTextContent(/Доставка\s*0\s₸/);
  });

  it('без разбивки — одна строка «Итого», без «Товары», скидки и доставки', async () => {
    openOrders([order()], [], []);
    await screen.findAllByTestId('order-row');
    card('1041');
    const totals = within(card('1041')).getByTestId('order-totals');

    expect(within(totals).queryByTestId('order-goods')).not.toBeInTheDocument();
    expect(within(totals).queryByTestId('order-discount')).not.toBeInTheDocument();
    expect(within(totals).queryByTestId('order-delivery')).not.toBeInTheDocument();
    expect(within(totals).getByTestId('order-total')).toHaveTextContent(/Итого\s*12\s500\s₸/);
  });

  it('разбивка итога — в валюте заявки, а не открытого магазина', async () => {
    openOrders([{ ...discounted, currency: 'RUB' }], [], [], 'USD');
    await screen.findAllByTestId('order-row');
    card('1041');
    const totals = within(card('1041')).getByTestId('order-totals');

    expect(within(totals).getByTestId('order-goods')).toHaveTextContent(/Товары\s*12\s500\s₽/);
    expect(within(totals).getByTestId('order-discount')).toHaveTextContent(/Скидка за объём −5%\s*−625\s₽/);
    expect(within(totals).getByTestId('order-delivery')).toHaveTextContent(/Доставка\s*1\s250\s₽/);
    expect(within(totals).getByTestId('order-total')).toHaveTextContent(/Итого\s*13\s125\s₽/);
    expect(totals.textContent).not.toContain('$');
  });

  it('у заявки, ждущей ответа, под предложенным составом разбивки отправленного нет', async () => {
    openOrders([{
      ...needsAnswer, goodsTotal: 62500, discount: { kind: 'VOLUME', percent: 3, amount: 1875 },
    }], [], fresh);
    await screen.findAllByTestId('order-row');
    const totals = within(card('1046')).getByTestId('order-totals');

    expect(within(totals).queryByTestId('order-discount')).not.toBeInTheDocument();
    expect(within(totals).getByTestId('order-total')).toHaveTextContent(/61\s500\s₸/);
  });
});

/** Монитор без шаблона — макет ПК-К5: список слева, выбранная заявка справа. */
describe('мои заявки на мониторе', () => {
  beforeEach(() => { cards = false; });
  afterEach(() => { vi.unstubAllGlobals(); cards = true; });

  it('справа открыта первая заявка, нажатие в списке открывает другую', async () => {
    stubWideScreen();
    openOrders();

    const pane = await screen.findByTestId('order-pane');
    const first = screen.getAllByTestId('order-row')[0];
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(pane).toHaveAccessibleName(/^Заявка №\d+$/);

    await userEvent.click(screen.getByRole('button', { name: /^Заявка №1039/ }));
    expect(await screen.findByRole('article', { name: 'Заявка №1039' })).toHaveTextContent('Товар снят с производства');
    expect(screen.getByRole('button', { name: /^Заявка №1039/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('мои заявки на телефоне', () => {
  beforeEach(() => { cards = false; });
  afterEach(() => { vi.unstubAllGlobals(); cards = true; });

  it('короткие строки: непрочитанные — самым верхом, свежие первыми; строка ведёт на экран заявки', async () => {
    openOrders();

    const regions = await screen.findAllByRole('region');
    expect(regions[0]).toHaveAccessibleName('Новые сообщения');
    const rows = within(regions[0]).getAllByRole('link');
    // По дате последнего сообщения: «собрана» (9:30) новее «изменений» (9:00).
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(['/orders/order-ready', '/orders/order-need']);
    expect(within(screen.getByRole('region', { name: 'Остальные' })).getAllByTestId('order-row')).toHaveLength(3);
    // Раскрывать в списке нечего — всё на экране заявки.
    expect(screen.queryByRole('button', { name: /^Подробнее о заявке/ })).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { OrderPage } from './OrderPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';
import type { Currency } from '../../shared/currency';

const renegotiated = {
  id: 'order-1',
  state: 'AWAITING_CONFIRMATION',
  needsAnswer: true,
  cancellable: true,
  createdAt: '2026-09-01T10:00:00Z',
  total: 12500,
  currency: 'KZT',
  submitted: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2500, amount: 12500 }],
  proposed: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2700, amount: 13500 }],
  proposedTotal: 13500,
  diff: [{ kind: 'PRICE_CHANGED', name: 'Цемент М400', was: 2500, now: 2700 }],
};

function openOrder(shopCurrency?: Currency | null) {
  renderScreen(
    <Routes>
      <Route path="/orders/:id" element={<OrderPage />} />
    </Routes>,
    { route: '/orders/order-1', ...(shopCurrency === undefined ? {} : { currency: shopCurrency }) },
  );
}

/**
 * Пересогласование глазами клиента.
 *
 * Главное здесь — две редакции рядом и названное отличие: подтверждение
 * относится к предложенному составу, и согласиться вслепую человек не должен.
 */
describe('заявка на пересогласовании', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('показывает обе редакции и что именно изменилось', async () => {
    stubFetch([get('/api/portal/orders/order-1', renegotiated)]);

    openOrder();

    expect(await screen.findByText('Вы отправляли')).toBeInTheDocument();
    // Полное совпадение, а не вхождение: те же слова стоят в заголовке
    // предупреждения о правках, и вхождение нашло бы оба.
    expect(screen.getByText('Поставщик предлагает')).toBeInTheDocument();
    expect(within(screen.getByTestId('submitted')).getAllByText('12 500 ₸')).not.toHaveLength(0);
    expect(within(screen.getByTestId('proposed')).getAllByText('13 500 ₸')).not.toHaveLength(0);
    expect(screen.getByTestId('diff')).toHaveTextContent('цена 2 500 ₸ → 2 700 ₸');
    // Количество с единицей читается по-русски: «5 мешков», а не «5 мешок».
    expect(screen.getByTestId('submitted')).toHaveTextContent('5 мешков');
  });

  it('пока ход за продавцом — до какого времени он ответит', async () => {
    const due = new Date();
    due.setHours(15, 30, 0, 0);
    stubFetch([get('/api/portal/orders/order-1', {
      ...renegotiated, state: 'SUBMITTED', needsAnswer: false, answerExpectedBy: due.toISOString(),
    })]);

    openOrder();

    expect(await screen.findByTestId('order-answer-by')).toHaveTextContent('Продавец ответит сегодня до 15:30');
  });

  it('называет, оптовая это заявка или розничная', async () => {
    stubFetch([get('/api/portal/orders/order-1', { ...renegotiated, saleMode: 'WHOLESALE' })]);

    openOrder();

    expect(await screen.findByTestId('order-sale-mode')).toHaveTextContent('Оптовая заявка');
  });

  it('называет, кто ведёт заявку, — именем', async () => {
    stubFetch([get('/api/portal/orders/order-1', { ...renegotiated, managerName: 'Жанар' })]);

    openOrder();

    expect(await screen.findByTestId('order-manager')).toHaveTextContent('Вашу заявку ведёт Жанар');
  });

  it('без срока от сервера строки о сроке нет', async () => {
    stubFetch([get('/api/portal/orders/order-1', renegotiated)]);

    openOrder();

    expect(await screen.findByText('Вы отправляли')).toBeInTheDocument();
    expect(screen.queryByTestId('order-answer-by')).toBeNull();
  });

  it('позиция, которую продавец ждёт к дате, помечена «будет …»', async () => {
    stubFetch([get('/api/portal/orders/order-1', {
      ...renegotiated,
      proposed: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2700, amount: 13500, expectedOn: '2026-10-27' }],
    })]);

    openOrder();

    expect(await within(await screen.findByTestId('proposed')).findByTestId('order-line-expected'))
      .toHaveTextContent('будет 27 октября');
    expect(within(screen.getByTestId('submitted')).queryByTestId('order-line-expected')).toBeNull();
  });

  it('карточка заявки — в валюте заявки, а не открытого магазина', async () => {
    stubFetch([get('/api/portal/orders/order-1', { ...renegotiated, currency: 'EUR' })]);

    openOrder('USD');

    expect(await screen.findByTestId('diff')).toHaveTextContent('цена 2 500 € → 2 700 €');
    expect(within(screen.getByTestId('submitted')).getAllByText('12 500 €')).not.toHaveLength(0);
    expect(within(screen.getByTestId('proposed')).getAllByText('13 500 €')).not.toHaveLength(0);
    expect(document.body.textContent).not.toContain('$');
  });

  it('ответ уходит кнопкой', async () => {
    const { calls } = stubFetch([
      get('/api/portal/orders/order-1', renegotiated),
      method('POST', '/api/portal/orders/order-1/confirm', {
        ...renegotiated, state: 'ACCEPTED', needsAnswer: false, cancellable: false,
      }),
    ]);

    openOrder();

    // Кнопка названа вместе с заявкой: действие необратимо, и «Согласен»
    // само по себе не говорит, с чем именно.
    await userEvent.click(await screen.findByRole('button', { name: /согласен со всем/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/confirm'))).toBe(true);
    });
    expect(await screen.findByText(/ответ отправлен/i)).toBeInTheDocument();
  });

  /** Пока поставщик ничего не предложил, отвечать нечего — можно только отменить. */
  it('без предложения показывает один состав и отмену', async () => {
    stubFetch([get('/api/portal/orders/order-1', {
      ...renegotiated,
      state: 'IN_REVIEW',
      needsAnswer: false,
      proposed: undefined,
      proposedTotal: undefined,
      diff: [],
    })]);

    openOrder();

    expect(await screen.findByText(/состав заявки/i)).toBeInTheDocument();
    expect(screen.queryByTestId('proposed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^согласен/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /отменить заявку/i })).toBeInTheDocument();
  });

  /** Принятую заявку отменять нечем: заказ мог уйти в учётную систему. */
  it('у принятой заявки отмены нет', async () => {
    stubFetch([get('/api/portal/orders/order-1', {
      ...renegotiated,
      state: 'ACCEPTED',
      needsAnswer: false,
      cancellable: false,
      proposed: undefined,
      diff: [],
    })]);

    openOrder();

    expect(await screen.findByText(/принята/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /отменить заявку/i })).not.toBeInTheDocument();
  });
});

/**
 * Ответ продавца по заявке.
 *
 * Клиент кабинета в мессенджер поставщику обычно не писал, и ответ на свой
 * вопрос он может прочитать только здесь.
 */
describe('ответ продавца в заявке', () => {
  afterEach(() => vi.unstubAllGlobals());

  const answered = {
    id: 'order-1',
    state: 'IN_REVIEW',
    needsAnswer: false,
    cancellable: true,
    createdAt: '2026-09-01T10:00:00Z',
    total: 5000,
    currency: 'KZT',
    submitted: [{ name: 'Цемент М-400', quantity: 2, unit: 'мешок', price: 2500, amount: 5000 }],
    diff: [],
    sellerAnswer: 'В бумажных мешках по 50 кг',
    answeredAt: '2026-09-05T08:00:00Z',
  };

  it('показывает ответ поставщика и говорит, что это он', async () => {
    stubFetch([get('/api/portal/orders/order-1', answered)]);

    openOrder();

    expect(await screen.findByText('В бумажных мешках по 50 кг')).toBeInTheDocument();
    // Без подписи ответ читается как ещё одна строка заявки.
    expect(screen.getByText(/ответ продавца/i)).toBeInTheDocument();
  });

  it('без ответа блока нет: пустая рамка читается как потерянное сообщение', async () => {
    stubFetch([get('/api/portal/orders/order-1', { ...answered, sellerAnswer: null, answeredAt: null })]);

    openOrder();

    expect(await screen.findByText('Состав заявки')).toBeInTheDocument();
    expect(screen.queryByText(/ответ продавца/i)).not.toBeInTheDocument();
  });

  /**
   * Заявка с лентой сообщений — новый формат: старую карточку с одним
   * ответом показывать незачем, ведёт к тому же разговору лента.
   */
  it('при наличии переписки показывает ленту, а не карточку ответа', async () => {
    stubFetch([get('/api/portal/orders/order-1', {
      ...answered,
      messages: [
        { author: 'CUSTOMER', text: 'Размер 44 будет?', createdAt: '2026-09-04T10:00:00Z' },
        { author: 'MANAGER', text: 'В бумажных мешках по 50 кг', createdAt: '2026-09-05T08:00:00Z' },
      ],
    })]);

    openOrder();

    expect(await screen.findByText('Размер 44 будет?')).toBeInTheDocument();
    expect(screen.getByText('В бумажных мешках по 50 кг')).toBeInTheDocument();
    expect(screen.queryByText(/^ответ продавца$/i)).not.toBeInTheDocument();
  });
});

describe('снимки товаров на странице заявки', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('миниатюра поданной и предложенной позиции ведёт на карточку товара', async () => {
    stubFetch([get('/api/portal/orders/order-1', {
      ...renegotiated,
      submitted: [{ ...renegotiated.submitted[0], itemId: 'item-1', imageUrl: 'https://cdn.example.kz/cement.jpg' }],
      proposed: [{ ...renegotiated.proposed[0], itemId: 'item-1', imageUrl: 'https://cdn.example.kz/cement.jpg' }],
    })]);
    renderScreen(
      <Routes>
        <Route path="/orders/:id" element={<OrderPage />} />
        <Route path="/catalog/:itemId" element={<p>Карточка товара</p>} />
      </Routes>,
      { route: '/orders/order-1' },
    );

    const submitted = await screen.findByTestId('submitted');
    expect(within(submitted).getByTestId('line-thumb-photo'))
      .toHaveAttribute('src', 'https://cdn.example.kz/cement.jpg');
    expect(within(screen.getByTestId('proposed')).getByTestId('line-thumb-photo'))
      .toHaveAttribute('src', 'https://cdn.example.kz/cement.jpg');

    await userEvent.click(within(submitted).getByRole('link', { name: 'Открыть товар: Цемент М400' }));

    expect(await screen.findByText('Карточка товара')).toBeInTheDocument();
  });

  it('у строки без позиции — заглушка без ссылки', async () => {
    stubFetch([get('/api/portal/orders/order-1', renegotiated)]);
    openOrder();

    const submitted = await screen.findByTestId('submitted');
    expect(within(submitted).getByTestId('line-thumb')).toBeInTheDocument();
    expect(within(submitted).queryByTestId('line-thumb-photo')).not.toBeInTheDocument();
    expect(within(submitted).queryByRole('link')).not.toBeInTheDocument();
  });
});

/** Разбивка итога отправленной редакции — как в сводке оформления. */
describe('итог заявки на её странице', () => {
  afterEach(() => vi.unstubAllGlobals());

  const sent = {
    id: 'order-1',
    state: 'IN_REVIEW',
    needsAnswer: false,
    cancellable: true,
    createdAt: '2026-09-01T10:00:00Z',
    total: 13125,
    currency: 'KZT',
    goodsTotal: 12500,
    discount: { kind: 'VOLUME', percent: 5, amount: 625 },
    deliveryPrice: 1250,
    submitted: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2500, amount: 12500 }],
    diff: [],
    invoiceAvailable: false,
  };

  it('под составом — «Товары», «Скидка за объём −5%», «Доставка» и «Итого»', async () => {
    stubFetch([get('/api/portal/orders/order-1', sent)]);
    openOrder();

    const submitted = await screen.findByTestId('submitted');
    expect(within(submitted).getByTestId('order-goods')).toHaveTextContent(/Товары\s*12\s500\s₸/);
    expect(within(submitted).getByTestId('order-discount')).toHaveTextContent(/Скидка за объём −5%\s*−625\s₸/);
    expect(within(submitted).getByTestId('order-delivery')).toHaveTextContent(/Доставка\s*1\s250\s₸/);
    expect(within(submitted).getByTestId('order-total')).toHaveTextContent(/Итого\s*13\s125\s₸/);
  });

  it('разбивка итога — в валюте заявки, а не открытого магазина', async () => {
    stubFetch([get('/api/portal/orders/order-1', { ...sent, currency: 'EUR' })]);
    openOrder('USD');

    const submitted = await screen.findByTestId('submitted');
    expect(within(submitted).getByTestId('order-goods')).toHaveTextContent(/Товары\s*12\s500\s€/);
    expect(within(submitted).getByTestId('order-discount')).toHaveTextContent(/Скидка за объём −5%\s*−625\s€/);
    expect(within(submitted).getByTestId('order-delivery')).toHaveTextContent(/Доставка\s*1\s250\s€/);
    expect(within(submitted).getByTestId('order-total')).toHaveTextContent(/Итого\s*13\s125\s€/);
    expect(document.body.textContent).not.toContain('$');
  });

  it('у предложенной продавцом редакции — только «Итого»', async () => {
    stubFetch([get('/api/portal/orders/order-1', { ...renegotiated, goodsTotal: 12500, deliveryPrice: 0 })]);
    openOrder();

    const proposed = await screen.findByTestId('proposed');
    expect(within(proposed).queryByTestId('order-goods')).not.toBeInTheDocument();
    expect(within(proposed).queryByTestId('order-delivery')).not.toBeInTheDocument();
    expect(within(proposed).getByTestId('order-total')).toHaveTextContent(/13\s500\s₸/);
    expect(within(screen.getByTestId('submitted')).getByTestId('order-delivery')).toHaveTextContent(/0\s₸/);
  });
});

describe('где забрать', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('у самовывоза — пункт с адресом, часами и картой', async () => {
    stubFetch([get('/api/portal/orders/order-1', {
      ...renegotiated, state: 'READY', needsAnswer: false, proposed: undefined, diff: [], pickup: true, pickupCode: '4821',
      pickupPoint: { name: 'Склад', address: 'Барахолка «Кенжехан-2», ряд 4', workingHours: '7:00–17:00' },
    })]);
    openOrder();

    const point = await screen.findByTestId('order-pickup-point');
    expect(point).toHaveTextContent('Склад');
    expect(point).toHaveTextContent('Барахолка «Кенжехан-2», ряд 4 · 7:00–17:00');
    expect(within(point).getByRole('button', { name: 'Склад — открыть карту' })).toBeInTheDocument();
  });
});

/** Ответ продавца пришёл — в этой же заявке на него можно ответить или спросить (решение владельца 2026-10-31). */
describe('ответ продавцу в заявке', () => {
  afterEach(() => vi.unstubAllGlobals());

  const answered = {
    ...renegotiated,
    state: 'AWAITING_CONFIRMATION',
    messages: [{ author: 'MANAGER', text: 'Цемента М400 нет, предлагаем М500 по той же цене.', createdAt: '2026-09-01T11:00:00Z' }],
  };

  it('«Ответить» у ответа продавца — вопрос уходит с цитатой этого ответа', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/orders/order-1/questions', answered),
      get('/api/portal/orders/order-1', answered),
    ]);
    openOrder();

    await userEvent.click(await screen.findByRole('button', { name: /Ответить продавцу на «Цемента М400 нет/ }));
    expect(screen.getByTestId('reply-quote')).toHaveTextContent('Цемента М400 нет, предлагаем М500 по той же цене.');
    await userEvent.type(screen.getByLabelText('Ваш ответ продавцу'), 'А М500 есть 10 мешков?');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({
        text: 'В ответ на «Цемента М400 нет, предлагаем М500 по той же цене.»\n\nА М500 есть 10 мешков?',
      });
    });
  });

  it('«Задать вопрос» — без цитаты; цитату можно убрать', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/orders/order-1/questions', answered),
      get('/api/portal/orders/order-1', answered),
    ]);
    openOrder();

    await userEvent.click(await screen.findByRole('button', { name: /Ответить продавцу/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Убрать цитату' }));
    expect(screen.queryByTestId('reply-quote')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Ваш вопрос продавцу'), 'Когда привезёте?');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ text: 'Когда привезёте?' });
    });
  });
});

/**
 * Замена и ответ по строке — в одном окне (W2-04, W2-05).
 *
 * Замена показана как замена, ответ — по каждой строке, а отказ от всей заявки —
 * только через подтверждение с причиной.
 */
describe('ответ по строкам', () => {
  afterEach(() => vi.unstubAllGlobals());

  const substituted = {
    ...renegotiated,
    proposed: [
      { name: 'Чинос City', quantity: 1, unit: 'шт', price: 31990, amount: 31990 },
      { name: 'Джинсы Denim', quantity: 3, unit: 'шт', price: 10000, amount: 30000 },
    ],
    proposedTotal: 61990,
    diff: [
      { kind: 'LINE_REPLACED', name: 'Чинос City', replacedName: 'Брюки Motion', was: 24990, now: 31990,
        lineId: 'l1', restock: 'NEVER', note: 'Есть аналог, по посадке ближе всего', itemId: 'item-city' },
      { kind: 'QUANTITY_CHANGED', name: 'Джинсы Denim', was: 10, now: 3, lineId: 'l2',
        restock: 'DATE', expectedOn: '2026-11-10' },
    ],
  };

  it('замена — одной строкой с причиной склада и словами продавца', async () => {
    stubFetch([get('/api/portal/orders/order-1', substituted)]);

    openOrder();

    const rows = await screen.findAllByTestId('line-answer');
    expect(within(rows[0]).getByTestId('replacement-badge')).toHaveTextContent('Предлагаемая замена товара');
    expect(rows[0]).toHaveTextContent('Вы выбрали: Брюки Motion — закончились, больше не будет');
    expect(rows[0]).toHaveTextContent('Продавец предлагает вместо него: Чинос City, 31 990 ₸ (+7 000 ₸)');
    expect(rows[0]).toHaveTextContent('«Есть аналог, по посадке ближе всего»');
    // Полная карточка предложенного товара — фото и описание — по ссылке из строки.
    expect(within(rows[0]).getByTestId('replacement-card')).toHaveAttribute('href', '/catalog/item-city');
    expect(rows[1]).toHaveTextContent('Джинсы Denim — есть 3 из 10');
    expect(within(rows[1]).getByRole('button', { name: 'Подожду все 10' })).toBeInTheDocument();
    // «Подожду» — только у строки со сроком склада.
    expect(within(rows[0]).queryByRole('button', { name: /подожду/i })).not.toBeInTheDocument();
  });

  it('в «Поставщик предлагает» замена выделена оттенком и подписана, что заменяет', async () => {
    stubFetch([get('/api/portal/orders/order-1', substituted)]);
    openOrder();

    const offered = await screen.findByTestId('proposed');
    const [replacement, same] = within(offered).getAllByTestId('order-line');
    expect(replacement).toHaveAttribute('data-offered', 'LINE_REPLACED');
    expect(replacement.className).toContain('bg-accent-soft');
    expect(replacement).toHaveTextContent('Вместо «Брюки Motion»');
    // Изменённое количество — не замена: строка без выделения.
    expect(same).not.toHaveAttribute('data-offered');
  });

  it('«Отправить ответ» — когда решение есть по каждой строке; итог пересчитывается сразу', async () => {
    const { calls } = stubFetch([
      get('/api/portal/orders/order-1', substituted),
      method('POST', '/api/portal/orders/order-1/answer', { ...substituted, needsAnswer: false, state: 'IN_REVIEW' }),
    ]);

    openOrder();

    const rows = await screen.findAllByTestId('line-answer');
    const send = screen.getByRole('button', { name: 'Отправить ответ' });
    expect(send).toBeDisabled();
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Беру замену' }));
    expect(send).toBeDisabled();
    await userEvent.click(within(rows[1]).getByRole('button', { name: 'Подожду все 10' }));
    expect(screen.getByTestId('line-answers-total')).toHaveTextContent('31 990 ₸');
    expect(send).toBeEnabled();

    await userEvent.click(send);

    await waitFor(() => {
      const call = calls.find((c) => c.url.includes('/answer'));
      expect(call).toBeDefined();
      expect(JSON.parse(String(call!.init?.body))).toEqual({
        lines: [{ lineId: 'l1', decision: 'ACCEPT' }, { lineId: 'l2', decision: 'WAIT' }],
      });
    });
  });

  it('«Спросить» открывает вопрос с цитатой строки', async () => {
    stubFetch([get('/api/portal/orders/order-1', substituted)]);

    openOrder();

    const rows = await screen.findAllByTestId('line-answer');
    await userEvent.click(within(rows[1]).getByRole('button', { name: 'Спросить' }));
    expect(await screen.findByTestId('reply-quote')).toHaveTextContent('Джинсы Denim — есть 3 из 10');
  });

  it('отказ от заявки — через окно, «Остаться» в фокусе, причина уходит продавцу', async () => {
    const { calls } = stubFetch([
      get('/api/portal/orders/order-1', substituted),
      method('POST', '/api/portal/orders/order-1/decline', { ...substituted, needsAnswer: false, state: 'CLOSED' }),
    ]);

    openOrder();

    await userEvent.click(await screen.findByRole('button', { name: 'Отказаться от заявки…' }));
    const dialog = screen.getByTestId('decline-dialog');
    expect(dialog).toHaveTextContent('Заявка будет закрыта целиком');
    expect(within(dialog).getByRole('button', { name: 'Остаться' })).toHaveFocus();
    expect(calls.some((c) => c.url.includes('/decline'))).toBe(false);

    await userEvent.click(within(dialog).getByRole('radio', { name: 'Дорого' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отказаться' }));

    await waitFor(() => {
      const call = calls.find((c) => c.url.includes('/decline'));
      expect(JSON.parse(String(call!.init?.body))).toEqual({ reason: 'PRICE' });
    });
  });

  it('«Отменить заявку» до принятия — тоже через окно', async () => {
    const { calls } = stubFetch([get('/api/portal/orders/order-1', {
      ...renegotiated, state: 'IN_REVIEW', needsAnswer: false, proposed: undefined, diff: [],
    })]);

    openOrder();

    await userEvent.click(await screen.findByRole('button', { name: /отменить заявку/i }));
    await userEvent.click(within(screen.getByTestId('decline-dialog')).getByRole('button', { name: 'Остаться' }));
    expect(screen.queryByTestId('decline-dialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/cancel'))).toBe(false);
  });
});

describe('открытая заявка гасит свои новости', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('уведомления о заявке отмечаются прочитанными, ответ на вопрос — нет', async () => {
    const { calls } = stubFetch([
      get('/api/portal/orders/order-1', renegotiated),
      get('/api/portal/notifications', [
        { id: 'n1', kind: 'RENEGOTIATION', draftId: 'order-1', createdAt: '2026-11-03T10:00:00Z' },
        { id: 'n2', kind: 'QUESTION_ANSWERED', draftId: 'order-1', createdAt: '2026-11-03T10:00:00Z' },
        { id: 'n3', kind: 'ACCEPTED', draftId: 'order-2', createdAt: '2026-11-03T10:00:00Z' },
      ]),
      method('POST', '/api/portal/notifications/n1/read', undefined, 204),
    ]);

    openOrder();

    await waitFor(() => expect(calls.some((c) => c.url.includes('/notifications/n1/read'))).toBe(true));
    expect(calls.some((c) => c.url.includes('/notifications/n2/read') || c.url.includes('/notifications/n3/read'))).toBe(false);
  });
});

describe('шапка заявки называет способ получения только известным', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('способ ещё не определён — «самовывоз» не пишется', async () => {
    stubFetch([get('/api/portal/orders/order-1', { ...renegotiated, orderNumber: '2026-00045', pickup: undefined })]);
    openOrder();
    expect(await screen.findByText('Вы отправляли')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/самовывоз/i);
  });

  it('с доставкой — «доставка», а не «самовывоз»', async () => {
    stubFetch([get('/api/portal/orders/order-1', { ...renegotiated, orderNumber: '2026-00045', pickup: false })]);
    openOrder();
    expect(await screen.findByText('Вы отправляли')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/самовывоз/i);
  });
});

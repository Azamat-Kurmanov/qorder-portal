import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubWideScreen } from '../../test/wideScreen';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutPage } from './CheckoutPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

/** Поставщик, который только отдаёт самовывозом и точек не завёл. */
const pickupOnly = { mode: 'PICKUP_ONLY', methods: [], pickupPoints: [] };

const cartWith = (overrides: Record<string, unknown> = {}) => ({
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
  vatPayer: true,
  ...overrides,
});

/** Телефон — шаги; снять заглушку монитора до stubFetch (она тоже снимается unstubAllGlobals). */
function phone() {
  vi.unstubAllGlobals();
}

describe('оформление заявки', () => {
  afterEach(() => vi.unstubAllGlobals());
  // Монитор: оформление одним экраном. Шаги телефона — в CheckoutSteps.test.tsx.
  beforeEach(() => stubWideScreen());

  it('при пустой корзине сводка не пишет «0 позиций · 0 ₸» и НДС, а пустоту называет тихо', async () => {
    phone();
    stubFetch([
      get('/api/portal/cart', cartWith({ lines: [], total: 0, goodsTotal: 0, vatAmount: 0 })),
      get('/api/portal/delivery', pickupOnly),
    ]);

    renderScreen(<CheckoutPage />);

    // Сводка о пустоте молчит; пустой состав — обычная подпись корзины.
    expect((await screen.findAllByText(/Корзина пуста/)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('cart-goods')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cart-vat')).not.toBeInTheDocument();
    // На телефоне дальше первого шага с пустой корзиной не пройти.
    expect(screen.getByRole('button', { name: /дальше/i })).toBeDisabled();
  });

  it('показывает итог и отправляет комментарий', async () => {
    const { calls } = stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
      method('POST', '/api/portal/orders', { draftId: 'draft-1', revision: 1, total: 12500 }),
    ]);

    renderScreen(<CheckoutPage />);

    // Итог появляется, когда пришла корзина: элемент есть на экране сразу,
    // поэтому ждать надо значения, а не элемента.
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('12 500'));

    // Пожелание — поле на виду («можно не писать»), как в макете.
    await userEvent.type(screen.getByLabelText(/пожелания продавцу/i), 'позвоните за час');
    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));

    await waitFor(() => {
      const submit = calls.find((call) => call.init?.method === 'POST');
      expect(submit).toBeDefined();
      expect(JSON.parse(String(submit?.init?.body))).toEqual({ note: 'позвоните за час', credit: false });
    });
    expect(await screen.findByText(/заявка отправлена/i)).toBeInTheDocument();
  });

  it('снятая галочкой позиция в заявку не идёт: итог и отправка — только отмеченных', async () => {
    const sand = { itemId: 'item-2', name: 'Песок', quantity: 2, unit: 'мешок', priceAtAdding: 900, price: 900, priceChanged: false, total: 1800 };
    const { calls } = stubFetch([
      get('/api/portal/cart', cartWith({ lines: [cartWith().lines[0], sand], total: 14300 })),
      get('/api/portal/delivery', pickupOnly),
      method('POST', '/api/portal/orders', { draftId: 'draft-1', revision: 1, total: 12500 }),
    ]);

    // Песок снят галочкой в корзине.
    window.localStorage.setItem('qo.cartUnpicked.supplier-1', JSON.stringify(['item-2:RETAIL']));
    renderScreen(<CheckoutPage />);

    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('12 500'));
    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));
    await waitFor(() => {
      const submit = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(submit?.init?.body))).toEqual({ credit: false, itemIds: ['item-1'] });
    });
  });

  it('в рознице «Как будете платить?» не спрашивают — заявка уходит за оплату', async () => {
    stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
    ]);

    renderScreen(<CheckoutPage />);
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('12 500'));

    expect(screen.queryByRole('radio', { name: /возьму в долг/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /отправить заявку/i })).toBeEnabled();
  });

  it('оптом без выбора оплаты не отправить; «Возьму в долг» уходит продавцу просьбой', async () => {
    const { calls } = stubFetch([
      get('/api/portal/cart', cartWith({ lines: [{ ...cartWith().lines[0], mode: 'WHOLESALE' }] })),
      get('/api/portal/delivery', pickupOnly),
      method('POST', '/api/portal/orders', { draftId: 'draft-1', revision: 1, total: 12500 }),
    ]);

    renderScreen(<CheckoutPage />);
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('12 500'));

    expect(screen.getByRole('button', { name: /отправить заявку/i })).toBeDisabled();
    expect(screen.getByText(/выберите выше, как будете платить/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /возьму в долг/i }));
    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));

    await waitFor(() => {
      const submit = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(submit?.init?.body))).toEqual({ credit: true });
    });
  });

  it('в другой валюте магазина итог и доставка показывают её знак', async () => {
    stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
    ]);

    renderScreen(<CheckoutPage />, { currency: 'RUB' });

    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('12 500 ₽'));
    expect(screen.getByTestId('total')).not.toHaveTextContent('₸');
  });

  it('расхождение цены показывается, а заявка не создаётся', async () => {
    const changed = cartWith({
      lines: [{ itemId: 'item-1', name: 'Цемент М400', quantity: 5, unit: 'мешок',
        priceAtAdding: 2500, price: 2700, priceChanged: true, total: 13500 }],
      total: 13500,
    });
    // После отказа сервер отдаёт уже пересчитанную корзину — как и в теле 409.
    let refused = false;
    stubFetch([
      { match: (_url, init) => { if (init?.method === 'POST') refused = true; return false; } },
      { match: (url, init) => refused && url.includes('/api/portal/cart') && (init?.method ?? 'GET') === 'GET', body: changed },
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
      method('POST', '/api/portal/orders', {
        code: 'CART_STALE',
        detail: 'Состав корзины изменился: проверьте цены и наличие',
        cart: cartWith({
          lines: [{
            itemId: 'item-1',
            name: 'Цемент М400',
            quantity: 5,
            unit: 'мешок',
            priceAtAdding: 2500,
            price: 2700,
            priceChanged: true,
            total: 13500,
          }],
          total: 13500,
        }),
      }, 409),
    ]);

    renderScreen(<CheckoutPage />);
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('12 500'));
    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));

    // Клиент отправлял другую сумму: решение принимает он, а не система.
    expect(await screen.findByText(/состав изменился/i)).toBeInTheDocument();
    // На мониторе при расхождении состав раскрывается прямо на странице.
    expect((await screen.findAllByText(/было 2 500 ₸, стало 2 700 ₸/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/заявка отправлена/i)).not.toBeInTheDocument();
  });

  /** Приостановленный поставщик: причина названа, корзина не пропадает. */
  it('поставщик на паузе — причина названа, заявка не создаётся', async () => {
    stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
      method('POST', '/api/portal/orders', {
        code: 'TENANT_INTAKE_CLOSED',
        detail: 'Поставщик временно не принимает заявки.',
      }, 409),
    ]);

    renderScreen(<CheckoutPage />);
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('12 500'));
    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));

    expect(await screen.findByText(/временно не принимает заявки/i)).toBeInTheDocument();
    expect(screen.getByText(/корзина сохранена/i)).toBeInTheDocument();
    expect(screen.queryByText(/заявка отправлена/i)).not.toBeInTheDocument();
  });

  /** QA-008: сбой сервера раньше оставлял экран немым — ушла ли заявка, было не понять. */
  it('сбой сервера — «Заявка не отправлена», корзина на месте', async () => {
    stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
      method('POST', '/api/portal/orders', { code: 'INTERNAL_ERROR', detail: 'Внутренняя ошибка сервера' }, 500),
    ]);

    renderScreen(<CheckoutPage />);
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('12 500'));
    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/заявка не отправлена/i);
    expect(screen.getByTestId('total')).toHaveTextContent('12 500');
  });

  /** QA-009: ответ на подачу потерян, повтор получает «корзина пуста» — заявка, скорее всего, ушла. */
  it('«корзина пуста» на отправке — «Возможно, заявка уже отправлена» и ссылка на «Мои заявки»', async () => {
    stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
      method('POST', '/api/portal/orders', { code: 'PORTAL_CART_EMPTY', detail: 'Корзина пуста' }, 400),
    ]);

    renderScreen(<CheckoutPage />);
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('12 500'));
    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/возможно, заявка уже отправлена/i);
    expect(within(alert).getByRole('link', { name: 'Мои заявки' })).toHaveAttribute('href', '/orders');
  });

  it('позиция, снятая с продажи, названа отдельным списком', async () => {
    stubFetch([
      get('/api/portal/cart', cartWith({
        skipped: [{ itemId: 'item-2', name: 'Щебень', reason: 'Позиция больше недоступна' }],
      })),
      get('/api/portal/delivery', pickupOnly),
    ]);

    renderScreen(<CheckoutPage />);

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent(/не добавлено/i);
    expect(notice).toHaveTextContent(/Щебень/);
  });

  /**
   * Строка заявки — то, что клиент сверяет с накладной: сколько, почём
   * и на какую сумму. Количество, спрятанное в поле ввода, при сверке
   * не читается.
   */
  it('строка заявки называет количество, цену и сумму', async () => {
    phone();
    stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
    ]);

    renderScreen(<CheckoutPage />);

    const block = await screen.findByRole('region', { name: 'Состав заявки' });
    const line = await within(block).findByTestId('cart-line');
    expect(line).toHaveTextContent('Цемент М400');
    expect(within(line).getByTestId('line-total')).toHaveTextContent('12 500 ₸');
  });

  /**
   * Снимков корзина не отдаёт, но место под них занято всегда: строки без
   * миниатюры и с нею расходятся по высоте, и список начинает прыгать
   * на каждой позиции. Заполнитель выбирается по позиции, а не наугад —
   * иначе он менялся бы при каждой перерисовке.
   */
  it('у строки есть миниатюра, и она не меняется от перерисовки', async () => {
    phone();
    stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
    ]);

    const { rerender } = renderScreen(<CheckoutPage />);

    const block = await screen.findByRole('region', { name: 'Состав заявки' });
    const before = (await within(block).findByTestId('line-thumb')).getAttribute('style');
    expect(before).toContain('linear-gradient');

    rerender(<CheckoutPage />);
    expect(within(screen.getByRole('region', { name: 'Состав заявки' })).getByTestId('line-thumb').getAttribute('style')).toBe(before);
  });

  /**
   * На телефоне сводка прилипает к низу и обязана оставаться низкой — состав
   * в ней спрятан. Поэтому на телефоне он стоит отдельным блоком наверху
   * страницы: что заказываешь, видно со снимками, а не только суммой.
   */
  it('состав заявки со снимками стоит отдельным блоком', async () => {
    phone();
    stubFetch([
      get('/api/portal/cart', cartWith({
        lines: [{ ...cartWith().lines[0], imageUrl: 'https://cdn.test/cement.jpg' }],
      })),
      get('/api/portal/delivery', pickupOnly),
    ]);

    renderScreen(<CheckoutPage />);

    const block = await screen.findByRole('region', { name: 'Состав заявки' });
    expect(await within(block).findByTestId('cart-line')).toHaveTextContent('Цемент М400');
    // Снимок декоративный (alt=""): название стоит рядом, поэтому ищется по разметке, а не по роли.
    expect(block.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/cement.jpg');
    expect(within(block).getByRole('link', { name: 'Добавить ещё товары' })).toHaveAttribute('href', '/catalog');
  });

  /** На мониторе итог стоит колонкой справа и не уезжает при прокрутке. */
  it('итог прибит колонкой справа', async () => {
    stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
    ]);

    renderScreen(<CheckoutPage />);

    const summary = await screen.findByTestId('checkout-summary');
    expect(summary.className).toContain('sticky');
    expect(screen.getByTestId('checkout-layout').className).toContain('grid-cols-[');
  });

  it('пустая корзина не отправляется', async () => {
    stubFetch([
      get('/api/portal/cart', { lines: [], total: 0, skipped: [] }),
      get('/api/portal/delivery', pickupOnly),
    ]);

    renderScreen(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /отправить заявку/i })).toBeDisabled();
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
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
  ...overrides,
});

describe('оформление заявки', () => {
  afterEach(() => vi.unstubAllGlobals());

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

    await userEvent.type(screen.getByLabelText(/комментарий/i), 'позвоните за час');
    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));

    await waitFor(() => {
      const submit = calls.find((call) => call.init?.method === 'POST');
      expect(submit).toBeDefined();
      expect(JSON.parse(String(submit?.init?.body))).toEqual({ note: 'позвоните за час' });
    });
    expect(await screen.findByText(/заявка отправлена/i)).toBeInTheDocument();
  });

  it('расхождение цены показывается, а заявка не создаётся', async () => {
    stubFetch([
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
    expect(await screen.findByText(/было 2 500 ₸, стало 2 700 ₸/i)).toBeInTheDocument();
    expect(screen.queryByText(/заявка отправлена/i)).not.toBeInTheDocument();
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
    stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
    ]);

    renderScreen(<CheckoutPage />);

    const line = await screen.findByTestId('cart-line');
    expect(line).toHaveTextContent('Цемент М400');
    expect(line).toHaveTextContent('5 мешок × 2 500 ₸');
    expect(within(line).getByTestId('line-total')).toHaveTextContent('12 500 ₸');
  });

  /**
   * Снимков корзина не отдаёт, но место под них занято всегда: строки без
   * миниатюры и с нею расходятся по высоте, и список начинает прыгать
   * на каждой позиции. Заполнитель выбирается по позиции, а не наугад —
   * иначе он менялся бы при каждой перерисовке.
   */
  it('у строки есть миниатюра, и она не меняется от перерисовки', async () => {
    stubFetch([
      get('/api/portal/cart', cartWith()),
      get('/api/portal/delivery', pickupOnly),
    ]);

    const { rerender } = renderScreen(<CheckoutPage />);

    const before = (await screen.findByTestId('line-thumb')).getAttribute('style');
    expect(before).toContain('linear-gradient');

    rerender(<CheckoutPage />);
    expect(screen.getByTestId('line-thumb').getAttribute('style')).toBe(before);
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
    expect(screen.getByTestId('checkout-layout').className).toContain('lg:grid-cols-');
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

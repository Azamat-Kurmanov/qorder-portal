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
  vatPayer: true,
  ...overrides,
});

describe('оформление заявки', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('при пустой корзине сводка не пишет «0 позиций · 0 ₸» и НДС, а пустоту называет тихо', async () => {
    stubFetch([
      get('/api/portal/cart', cartWith({ lines: [], total: 0, goodsTotal: 0, vatAmount: 0 })),
      get('/api/portal/delivery', pickupOnly),
    ]);

    renderScreen(<CheckoutPage />);

    // Сводка о пустоте молчит; пустой состав — обычная подпись корзины.
    expect((await screen.findAllByText(/Корзина пуста/)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('cart-goods')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cart-vat')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /отправить заявку/i })).toBeDisabled();
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

    // Пожелание свёрнуто в строку и раскрывается по нажатию.
    await userEvent.click(screen.getByRole('button', { name: /пожелания продавцу/i }));
    await userEvent.type(screen.getByLabelText(/пожелания продавцу/i), 'позвоните за час');
    await userEvent.click(screen.getByRole('button', { name: /отправить заявку/i }));

    await waitFor(() => {
      const submit = calls.find((call) => call.init?.method === 'POST');
      expect(submit).toBeDefined();
      expect(JSON.parse(String(submit?.init?.body))).toEqual({ note: 'позвоните за час' });
    });
    expect(await screen.findByText(/заявка отправлена/i)).toBeInTheDocument();
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
    // Строка стоит дважды: в блоке состава для телефона и в сводке монитора.
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
    expect(within(block).getByRole('link', { name: 'Изменить товары' })).toHaveAttribute('href', '/catalog');
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

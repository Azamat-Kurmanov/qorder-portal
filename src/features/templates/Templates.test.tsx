import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplatesPage } from './TemplatesPage';
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

/**
 * Шаблоны и повтор заказа.
 *
 * Ради этого кабинет и строился: закупки повторяются, и набирать тот же список
 * руками каждую неделю человек не станет.
 */
describe('шаблоны закупки', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('сохраняет корзину под названием', async () => {
    const { calls } = stubFetch([
      get('/api/portal/templates', [], 200),
      method('POST', '/api/portal/templates', { id: 'tpl-1', name: 'Объект на Абая', lineCount: 1 }, 201),
    ]);

    renderScreen(<TemplatesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Сохранить корзину как шаблон' }));
    await userEvent.type(await screen.findByLabelText(/название/i), 'Объект на Абая');
    await userEvent.click(screen.getByRole('button', { name: /^сохранить$/i }));

    await waitFor(() => {
      const save = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(save?.init?.body))).toEqual({ name: 'Объект на Абая' });
    });
  });

  /** Шаблон наполняет корзину, а не отправляет заявку: цены могли измениться. */
  it('шаблон наполняет корзину, а не отправляет заявку', async () => {
    const { calls } = stubFetch([
      get('/api/portal/templates', [{ id: 'tpl-1', name: 'Объект на Абая', lineCount: 3 }]),
      method('POST', '/api/portal/cart/from-template/tpl-1', cart),
    ]);

    renderScreen(<TemplatesPage />);

    await userEvent.click(await screen.findByRole('button', { name: /в корзину/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/cart/from-template/tpl-1'))).toBe(true);
    });
    expect(calls.some((call) => call.url.endsWith('/api/portal/orders') && call.init?.method === 'POST')).toBe(false);
  });

  it('повторяет прошлый заказ одним касанием', async () => {
    const { calls } = stubFetch([
      get('/api/portal/templates', []),
      method('POST', '/api/portal/cart/from-last-order', cart),
    ]);

    renderScreen(<TemplatesPage />);

    await userEvent.click(await screen.findByRole('button', { name: /повторить прошлый заказ/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/cart/from-last-order'))).toBe(true);
    });
  });

  it('шаблон удаляется по названию', async () => {
    const { calls } = stubFetch([
      get('/api/portal/templates', [{ id: 'tpl-1', name: 'Объект на Абая', lineCount: 3 }]),
      method('DELETE', '/api/portal/templates/tpl-1', undefined, 204),
    ]);

    renderScreen(<TemplatesPage />);

    await userEvent.click(await screen.findByRole('button', { name: /удалить шаблон Объект на Абая/i }));
    // Сначала спрашиваем: удаление без вопроса легко сделать случайно.
    expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(false);
    expect(screen.getByText(/Удалить шаблон «Объект на Абая»\?/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Да, удалить' }));

    await waitFor(() => {
      expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(true);
    });
  });

  it('шаблон правят: количество, убрать позицию, название', async () => {
    const { calls } = stubFetch([
      get('/api/portal/templates/tpl-1/lines', [
        { itemId: 'i-1', name: 'Цемент М400', unit: 'мешок', quantity: 5 },
        { itemId: 'i-2', name: 'Песок речной', unit: 'т', quantity: 2 },
      ]),
      get('/api/portal/templates', [{ id: 'tpl-1', name: 'Объект на Абая', lineCount: 2 }]),
      method('PUT', '/api/portal/templates/tpl-1', { id: 'tpl-1', name: 'Абая, 2 этаж', lineCount: 1 }),
    ]);
    renderScreen(<TemplatesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить шаблон' }));
    const name = await screen.findByDisplayValue('Объект на Абая');
    await userEvent.clear(name);
    await userEvent.type(name, 'Абая, 2 этаж');
    const quantity = screen.getByDisplayValue('5');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '8');
    await userEvent.click(screen.getByRole('button', { name: 'Убрать из шаблона: Песок речной' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      const put = calls.find((call) => call.init?.method === 'PUT');
      expect(JSON.parse(String(put?.init?.body))).toEqual({ name: 'Абая, 2 этаж', lines: [{ itemId: 'i-1', quantity: 8 }] });
    });
  });

  describe('автозаказ', () => {
    const plain = { id: 'tpl-1', name: 'Овощи', lineCount: 3 };
    const scheduled = { ...plain, repeatKind: 'WEEKLY', repeatDay: 4, repeatTime: '15:00:00', nextRunAt: '2026-10-29T10:00:00Z' };

    it('без расписания — «выключен»; включение уходит днём недели и временем', async () => {
      const { calls } = stubFetch([
        get('/api/portal/templates', [plain]),
        method('PUT', '/api/portal/templates/tpl-1/schedule', scheduled),
        method('POST', '/api/portal/templates/tpl-1/schedule', scheduled),
      ]);
      renderScreen(<TemplatesPage />);

      expect(await screen.findByTestId('template-schedule')).toHaveTextContent('Автозаказ выключен');
      await userEvent.click(screen.getByRole('button', { name: 'Включить автозаказ' }));
      await userEvent.selectOptions(screen.getByLabelText('День'), 'четверг');
      await userEvent.clear(screen.getByLabelText('Время'));
      await userEvent.type(screen.getByLabelText('Время'), '15:00');
      await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

      await waitFor(() => expect(calls.some((call) => call.url.includes('/schedule'))).toBe(true));
      const sent = calls.find((call) => call.url.includes('/schedule'));
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ kind: 'WEEKLY', day: 4, time: '15:00' });
    });

    it('с расписанием — день, время и следующий раз; выключение — DELETE', async () => {
      const { calls } = stubFetch([
        get('/api/portal/templates', [scheduled]),
        method('DELETE', '/api/portal/templates/tpl-1/schedule', null, 204),
      ]);
      renderScreen(<TemplatesPage />);

      expect(await screen.findByTestId('template-schedule')).toHaveTextContent('Автозаказ: по четвергам в 15:00 · следующий раз 29 октября');
      await userEvent.click(screen.getByRole('button', { name: 'Изменить' }));
      await userEvent.click(screen.getByRole('button', { name: 'Выключить автозаказ' }));

      await waitFor(() => expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(true));
    });
  });

  it('отменённая заявка из прошлых — в корзину', async () => {
    const { calls } = stubFetch([
      get('/api/portal/templates', []),
      get('/api/portal/orders', [{
        id: 'd-1', orderNumber: '2026-00027', state: 'CLOSED', needsAnswer: false, createdAt: '2026-11-05T10:00:00Z',
        total: 14000, currency: 'KZT', submitted: [{ name: 'Абрикосы', quantity: 10, price: 1400, amount: 14000 }], diff: [],
      }]),
      method('POST', '/api/portal/cart/from-order/d-1', cart),
    ]);

    renderScreen(<TemplatesPage />);

    const row = await screen.findByTestId('past-order');
    expect(row).toHaveTextContent('Отменена');
    await userEvent.click(within(row).getByRole('button', { name: /в корзину/i }));
    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/cart/from-order/d-1'))).toBe(true);
    });
  });

  it('в шаблон добавляют товар поиском по каталогу — с минимумом заказа', async () => {
    const { calls } = stubFetch([
      get('/api/portal/templates/tpl-1/lines', [{ itemId: 'i-1', name: 'Цемент М400', unit: 'мешок', quantity: 5 }]),
      get('/api/portal/templates', [{ id: 'tpl-1', name: 'Объект на Абая', lineCount: 1 }]),
      get('/api/portal/catalog', { items: [{ id: 'i-3', name: 'Картофель', unit: 'кг', price: 300, favorite: false,
        vatIncluded: true, terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 10, quantityStep: 10 } }], total: 1 }),
      method('PUT', '/api/portal/templates/tpl-1', { id: 'tpl-1', name: 'Объект на Абая', lineCount: 2 }),
    ]);
    renderScreen(<TemplatesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить шаблон' }));
    await userEvent.type(await screen.findByPlaceholderText(/Название товара/), 'карт');
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить в шаблон: Картофель' }));
    expect(screen.getByText('Не меньше 10 кг, по 10 кг')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      const put = calls.find((call) => call.init?.method === 'PUT');
      expect(JSON.parse(String(put?.init?.body)).lines).toEqual([
        { itemId: 'i-1', quantity: 5 }, { itemId: 'i-3', quantity: 10 },
      ]);
    });
  });

  it('шаблон удаляют и изнутри правки — с вопросом', async () => {
    const { calls } = stubFetch([
      get('/api/portal/templates/tpl-1/lines', [{ itemId: 'i-1', name: 'Цемент М400', unit: 'мешок', quantity: 5 }]),
      get('/api/portal/templates', [{ id: 'tpl-1', name: 'Объект на Абая', lineCount: 1 }]),
      method('DELETE', '/api/portal/templates/tpl-1', undefined, 204),
    ]);
    renderScreen(<TemplatesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить шаблон' }));
    await screen.findByTestId('template-editor');
    await userEvent.click(screen.getByRole('button', { name: /удалить шаблон Объект на Абая/i }));
    expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Да, удалить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(true));
  });
});

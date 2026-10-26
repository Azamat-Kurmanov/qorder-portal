import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
    expect(calls.some((call) => call.url.endsWith('/api/portal/orders'))).toBe(false);
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

    await waitFor(() => {
      expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(true);
    });
  });
});

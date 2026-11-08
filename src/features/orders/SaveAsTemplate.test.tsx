import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveAsTemplate } from './SaveAsTemplate';
import { method, stubFetch } from '../../test/http';
import { renderScreen } from '../../test/render';

const order = {
  id: 'd-1', orderNumber: '2026-00027', state: 'CLOSED', needsAnswer: false, createdAt: '2026-11-05T10:00:00Z',
  total: 14000, currency: 'KZT', submitted: [{ name: 'Абрикосы', quantity: 10, price: 1400, amount: 14000 }], diff: [],
} as never;

describe('сохранить заявку шаблоном', () => {
  it('отменённая заявка уходит в шаблоны под предложенным названием', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/templates/from-order/d-1', { id: 't-1', name: 'Как заявка №2026-00027', lineCount: 1 }, 201),
    ]);
    renderScreen(<SaveAsTemplate order={order} />);

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить шаблоном' }));
    expect(screen.getByRole('textbox')).toHaveValue('Как заявка №2026-00027');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Сохранено в шаблоны.'));
    const call = calls.find((c) => c.url.includes('/templates/from-order/d-1'));
    expect(String(call?.init?.body)).toContain('Как заявка №2026-00027');
  });

  it('заявка без товаров каталога — причина от сервера, а не «попробуйте ещё раз»', async () => {
    const reason = 'В этой заявке нет товаров из каталога магазина — только то, что вы вписали словами.';
    stubFetch([
      method('POST', '/api/portal/templates/from-order/d-1',
        { status: 400, code: 'PORTAL_TEMPLATE_NO_CATALOG_ITEMS', detail: reason }, 400),
    ]);
    renderScreen(<SaveAsTemplate order={order} />);

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить шаблоном' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(reason));
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransportPayment } from './TransportPayment';
import { renderScreen } from '../../test/render';
import { method, stubFetch } from '../../test/http';

describe('оплата перевозки у клиента', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('квитанция видна, «Я оплатил» уходит с номером операции', async () => {
    const { calls } = stubFetch([method('POST', '/api/portal/orders/draft-1/transport-payment', { id: 'draft-1' })]);
    renderScreen(<TransportPayment orderId="draft-1" currency="KZT" payment={{
      status: 'AWAITING_PAYMENT', control: 'MARK', shipmentBlocked: false,
      receipt: { id: 'r1', amount: 4500, payee: 'ТОО «СДЭК»', requisites: 'KZ12 3456',
        payUrl: 'https://pay.example/abc', dueDate: '2026-10-05', createdAt: '2026-09-29T10:00:00Z' },
    }} />);

    expect(screen.getByTestId('transport-receipt')).toHaveTextContent(/4\s500/);
    expect(screen.getByRole('link', { name: 'Оплатить онлайн' })).toHaveAttribute('href', 'https://pay.example/abc');
    await userEvent.click(screen.getByRole('button', { name: 'Я оплатил' }));
    await userEvent.type(screen.getByLabelText('Номер операции'), 'OP-1');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => {
      const post = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(post?.init?.body))).toMatchObject({ paymentRef: 'OP-1' });
    });
  });

  it('отклонённая оплата — с причиной и кнопкой сообщить снова', () => {
    renderScreen(<TransportPayment orderId="draft-1" currency="KZT" payment={{
      status: 'REJECTED', control: 'MARK', shipmentBlocked: false, rejectionReason: 'Платёж не найден',
      receipt: { id: 'r1', amount: 4500, payee: 'СДЭК', createdAt: '2026-09-29T10:00:00Z' },
    }} />);

    expect(screen.getByText(/Платёж не найден/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Я оплатил' })).toBeInTheDocument();
  });

  it('до квитанции — только ожидание', () => {
    renderScreen(<TransportPayment orderId="draft-1" currency="KZT"
      payment={{ status: 'AWAITING_RECEIPT', control: 'MARK', shipmentBlocked: false }} />);

    expect(screen.getByText('Продавец пришлёт квитанцию на оплату перевозки')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Я оплатил' })).not.toBeInTheDocument();
  });

  it('отказ сервера на «Я оплатил» виден его словами', async () => {
    stubFetch([method('POST', '/api/portal/orders/draft-1/transport-payment',
      { detail: 'Сообщать об оплате сейчас нечего' }, 409)]);
    renderScreen(<TransportPayment orderId="draft-1" currency="KZT" payment={{
      status: 'AWAITING_PAYMENT', control: 'MARK', shipmentBlocked: false,
      receipt: { id: 'r1', amount: 4500, payee: 'СДЭК', createdAt: '2026-09-29T10:00:00Z' },
    }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Я оплатил' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Сообщать об оплате сейчас нечего');
  });
});

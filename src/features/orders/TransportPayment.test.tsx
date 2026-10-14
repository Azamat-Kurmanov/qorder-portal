import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransportPayment } from './TransportPayment';
import { renderScreen } from '../../test/render';
import { file, method, stubFetch } from '../../test/http';

/** Квитанции файлом нет: только переписка и кабинет — как у большинства заказов. */
const NO_FILES = { receiptFiles: [], fileToChat: false, fileToCabinet: true };

describe('оплата перевозки у клиента', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('квитанция видна, «Я оплатил» уходит с номером операции', async () => {
    const { calls } = stubFetch([method('POST', '/api/portal/orders/draft-1/transport-payment', { id: 'draft-1' })]);
    renderScreen(<TransportPayment orderId="draft-1" currency="KZT" payment={{
      status: 'AWAITING_PAYMENT', control: 'MARK', shipmentBlocked: false, ...NO_FILES,
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
      status: 'REJECTED', control: 'MARK', shipmentBlocked: false, ...NO_FILES, rejectionReason: 'Платёж не найден',
      receipt: { id: 'r1', amount: 4500, payee: 'СДЭК', createdAt: '2026-09-29T10:00:00Z' },
    }} />);

    expect(screen.getByText(/Платёж не найден/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Я оплатил' })).toBeInTheDocument();
  });

  it('квитанция посредника файлом скачивается через свой заказ, и по ней можно сообщить об оплате', async () => {
    const link = '/api/portal/orders/draft-1/transport-receipts/f1';
    const { calls } = stubFetch([file(link, '%PDF-1.4 квитанция', 'f1.pdf')]);
    const saved: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:receipt');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    renderScreen(<TransportPayment orderId="draft-1" currency="KZT" payment={{
      status: 'AWAITING_PAYMENT', control: 'BLOCK_SHIPMENT', shipmentBlocked: true, ...NO_FILES,
      receiptFiles: [link],
    }} />);

    // Квитанция — персональные данные: ссылкой без токена её не открыть.
    expect(screen.queryByRole('link', { name: 'скачать файл 1' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'скачать файл 1' }));

    await waitFor(() => expect(saved).toEqual(['f1.pdf']));
    expect(calls.some((call) => call.url.includes(link))).toBe(true);
    expect(screen.getByRole('button', { name: 'Я оплатил' })).toBeInTheDocument();
  });

  it('не скачалась квитанция — отказ виден', async () => {
    stubFetch([{ match: (url) => url.includes('/transport-receipts/'), status: 404, body: {} }]);
    renderScreen(<TransportPayment orderId="draft-1" currency="KZT" payment={{
      status: 'AWAITING_PAYMENT', control: 'MARK', shipmentBlocked: false, ...NO_FILES,
      receiptFiles: ['/api/portal/orders/draft-1/transport-receipts/f1'],
    }} />);

    await userEvent.click(screen.getByRole('button', { name: 'скачать файл 1' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось скачать квитанцию');
  });

  it('до квитанции — только ожидание', () => {
    renderScreen(<TransportPayment orderId="draft-1" currency="KZT"
      payment={{ status: 'AWAITING_RECEIPT', control: 'MARK', shipmentBlocked: false, ...NO_FILES }} />);

    expect(screen.getByText('Продавец пришлёт квитанцию на оплату перевозки')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Я оплатил' })).not.toBeInTheDocument();
  });

  it('отказ сервера на «Я оплатил» виден его словами', async () => {
    stubFetch([method('POST', '/api/portal/orders/draft-1/transport-payment',
      { detail: 'Сообщать об оплате сейчас нечего' }, 409)]);
    renderScreen(<TransportPayment orderId="draft-1" currency="KZT" payment={{
      status: 'AWAITING_PAYMENT', control: 'MARK', shipmentBlocked: false, ...NO_FILES,
      receipt: { id: 'r1', amount: 4500, payee: 'СДЭК', createdAt: '2026-09-29T10:00:00Z' },
    }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Я оплатил' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Сообщать об оплате сейчас нечего');
  });
});

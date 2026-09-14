import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { OrderPage } from './OrderPage';
import { renderScreen } from '../../test/render';
import { file, get, stubFetch } from '../../test/http';

const accepted = {
  id: 'order-7',
  state: 'ACCEPTED',
  needsAnswer: false,
  cancellable: false,
  createdAt: '2026-09-01T10:00:00Z',
  total: 12500,
  submitted: [{ name: 'Цемент М400', quantity: 5, unit: 'мешок', price: 2500, amount: 12500 }],
  invoiceAvailable: true,
};

function openOrder() {
  renderScreen(
    <Routes>
      <Route path="/orders/:id" element={<OrderPage />} />
    </Routes>,
    { route: '/orders/order-7' },
  );
}

/**
 * Скачивание в jsdom: браузерной ссылки на содержимое здесь нет, а нажатие
 * на ссылку никуда не ведёт. Подменяются ровно эти две вещи — что кабинет
 * положил в файл и под каким именем отдал, проверяется по-настоящему.
 */
function captureDownloads() {
  const saved: { name: string; blob: Blob }[] = [];
  let last: Blob | undefined;

  URL.createObjectURL = vi.fn((blob: Blob) => {
    last = blob;
    return 'blob:invoice';
  });
  URL.revokeObjectURL = vi.fn();

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    saved.push({ name: this.download, blob: last as Blob });
  });

  return saved;
}

/**
 * Счёт в карточке заявки.
 *
 * Документ тот же, что ушёл в переписку, и клиенту он нужен там, где лежит
 * сама заявка: искать его в мессенджере через месяц — значит не найти.
 */
describe('счёт в карточке заявки', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('кнопки нет, пока счёт не выписан', async () => {
    stubFetch([get('/api/portal/orders/order-7', { ...accepted, invoiceAvailable: false })]);

    openOrder();

    await screen.findByTestId('submitted');
    // Кнопка, ведущая в пустоту, хуже её отсутствия: сервер ответил бы отказом,
    // а человек решил бы, что счёт потерялся.
    expect(screen.queryByTestId('order-invoice')).not.toBeInTheDocument();
  });

  it('скачивает счёт и называет файл так, как назвал сервер', async () => {
    const { calls } = stubFetch([
      file('/api/portal/orders/order-7/invoice.pdf', '%PDF-1.4 счёт', 'schet-2026-00042.pdf'),
      get('/api/portal/orders/order-7', accepted),
    ]);
    const saved = captureDownloads();

    openOrder();

    await userEvent.click(await screen.findByTestId('order-invoice'));

    await waitFor(() => expect(saved).toHaveLength(1));
    // Имя приходит заголовком ответа: счёт называет свой номер, и придуманное
    // кабинетом имя в папке загрузок назвало бы другой документ.
    expect(saved[0].name).toBe('schet-2026-00042.pdf');
    // Документ, разобранный как JSON, не документ.
    expect(saved[0].blob.type).toBe('application/pdf');
    expect(await saved[0].blob.text()).toContain('%PDF');

    expect(calls.some((call) => call.url.includes('/api/portal/orders/order-7/invoice.pdf')))
      .toBe(true);
  });

  it('отказ сервера виден человеку, а не проглатывается', async () => {
    // Правило счёта стоит первым намеренно: адрес заявки — начало адреса
    // счёта, и правило заявки перехватило бы запрос документа, ответив
    // на него телом заявки со статусом 200.
    stubFetch([
      { match: (url) => url.includes('/invoice.pdf'), status: 500, body: {} },
      get('/api/portal/orders/order-7', accepted),
    ]);
    captureDownloads();

    openOrder();

    await userEvent.click(await screen.findByTestId('order-invoice'));

    // Молчаливая кнопка хуже отказа: человек нажимает второй раз и решает,
    // что кабинет сломан.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

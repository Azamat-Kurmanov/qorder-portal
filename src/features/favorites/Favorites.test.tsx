import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FavoritesPage } from './FavoritesPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const CEMENT = { itemId: 'item-1', name: 'Цемент М400', unit: 'мешок', price: 2500, available: true };
const GONE = { itemId: 'item-2', name: 'Ротбанд', available: false };

const emptyCart = { lines: [], total: 0, skipped: [] };

describe('избранное', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('снятая с продажи позиция остаётся в списке, но погашенной', async () => {
    stubFetch([get('/api/portal/favorites', [CEMENT, GONE]), get('/api/portal/cart', emptyCart)]);

    renderScreen(<FavoritesPage />);

    expect(await screen.findByText('Цемент М400')).toBeInTheDocument();
    // Исчезни она молча — клиент решил бы, что сам её не отмечал, и стал бы
    // искать заново. Пометка называет виновника: решение принял продавец,
    // а не кабинет.
    expect(screen.getByText('Ротбанд')).toBeInTheDocument();
    expect(screen.getByText('Продавец снял с витрины')).toBeInTheDocument();
  });

  it('подзаголовок считает отмеченное и напоминает, чей это выбор', async () => {
    stubFetch([get('/api/portal/favorites', [CEMENT, GONE]), get('/api/portal/cart', emptyCart)]);

    renderScreen(<FavoritesPage />);

    // «Сколько я отложил» — первый вопрос на этом экране, и мерить длину
    // списка прокруткой клиент не должен.
    // Число — в заголовке, как в макете: «Избранное · 2».
    expect(await screen.findByRole('heading', { level: 1, name: /^Избранное\s*·\s*2$/ })).toBeInTheDocument();
    expect(screen.getByText('отложено вами')).toBeInTheDocument();
  });

  it('«Очистить» снимает отметку с каждой позиции', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/favorites/item-1/toggle', { itemId: 'item-1', favorite: false }),
      method('POST', '/api/portal/favorites/item-2/toggle', { itemId: 'item-2', favorite: false }),
      get('/api/portal/favorites', [CEMENT, GONE]),
      get('/api/portal/cart', emptyCart),
    ]);

    renderScreen(<FavoritesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Очистить избранное' }));

    // Отдельной операции «очистить всё» у сервера нет: список снимается
    // по одной позиции, и не остаться отмеченной должна ни одна.
    await waitFor(() => {
      expect(calls.filter((call) => call.url.includes('/toggle')).map((call) => call.url)).toEqual([
        expect.stringContaining('/favorites/item-1/toggle'),
        expect.stringContaining('/favorites/item-2/toggle'),
      ]);
    });
  });

  it('доступное уходит в заявку одним нажатием, а недоступное называется отдельно', async () => {
    const { calls } = stubFetch([
      get('/api/portal/favorites', [CEMENT, GONE]),
      get('/api/portal/cart', emptyCart),
      method('POST', '/api/portal/favorites/to-cart', {
        lines: [{
          itemId: 'item-1', name: 'Цемент М400', quantity: 1, unit: 'мешок',
          priceAtAdding: 2500, price: 2500, priceChanged: false, total: 2500,
        }],
        total: 2500,
        skipped: [{ name: 'Ротбанд', reason: 'UNAVAILABLE' }],
      }),
    ]);

    renderScreen(<FavoritesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить доступное в заявку' }));

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/favorites/to-cart'))).toBe(true);
    });
    // Пропущенное называется поимённо: «добавлено не всё» без списка
    // заставляет пересчитывать корзину руками.
    expect(await screen.findByTestId('skipped-notice')).toHaveTextContent('Ротбанд');
    expect(await screen.findByTestId('cart-bar')).toHaveTextContent('2 500');
  });

  it('позиция со скидкой: старая цена зачёркнута, метка «−N%», цена цветом скидки', async () => {
    const onSale = { ...CEMENT, price: 2000, oldPrice: 2500, discountPercent: 20 };
    stubFetch([get('/api/portal/favorites', [onSale, { ...CEMENT, itemId: 'item-3', name: 'Песок' }]), get('/api/portal/cart', emptyCart)]);

    renderScreen(<FavoritesPage />);

    const [sale, plain] = await screen.findAllByTestId('favorite-row');
    expect(within(sale).getByText('−20%')).toBeInTheDocument();
    const old = sale.querySelector('s');
    expect(old?.textContent).toMatch(/2\s500 ₸/);
    expect(within(sale).getByText(/2\s000 ₸/)).toHaveClass('text-sale');
    // Без скидки — ни метки, ни старой цены, цена обычным цветом.
    expect(within(plain).queryByText(/^−\d+%$/)).not.toBeInTheDocument();
    expect(plain.querySelector('s')).toBeNull();
    expect(within(plain).getByText(/2\s500 ₸/)).not.toHaveClass('text-sale');
  });

  it('в другой валюте магазина цена показывается с её знаком', async () => {
    stubFetch([get('/api/portal/favorites', [CEMENT]), get('/api/portal/cart', emptyCart)]);
    renderScreen(<FavoritesPage />, { currency: 'RUB' });

    const [row] = await screen.findAllByTestId('favorite-row');
    expect(within(row).getByText(/2\s500 ₽/)).toBeInTheDocument();
    expect(row).not.toHaveTextContent('₸');
  });

  it('пустой список объясняет, зачем отмечать', async () => {
    stubFetch([get('/api/portal/favorites', []), get('/api/portal/cart', emptyCart)]);

    renderScreen(<FavoritesPage />);

    expect(await screen.findByText(/отмечайте позиции сердечком/i)).toBeInTheDocument();
    // Очищать нечего — и кнопки нет: она обещала бы действие над пустотой.
    expect(screen.queryByRole('button', { name: 'Очистить избранное' })).not.toBeInTheDocument();
  });
});

describe('снимки в избранном', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('у доступной позиции снимок — ссылка на карточку, у снятой — без ссылки', async () => {
    stubFetch([
      get('/api/portal/favorites', [
        { ...CEMENT, imageUrl: 'https://cdn.example.kz/cement.jpg' },
        { ...GONE, imageUrl: 'https://cdn.example.kz/rotband.jpg' },
      ]),
      get('/api/portal/cart', emptyCart),
    ]);
    renderScreen(<FavoritesPage />);

    const [cement, gone] = await screen.findAllByTestId('favorite-row');
    const photo = within(cement).getByTestId('line-thumb-photo');
    expect(photo).toHaveAttribute('src', 'https://cdn.example.kz/cement.jpg');
    expect(photo.closest('a')).toHaveAttribute('href', '/catalog/item-1');

    const gonePhoto = within(gone).getByTestId('line-thumb-photo');
    expect(gonePhoto).toHaveAttribute('src', 'https://cdn.example.kz/rotband.jpg');
    expect(gonePhoto.closest('a')).toBeNull();
  });

  it('без снимка — заглушка', async () => {
    stubFetch([get('/api/portal/favorites', [CEMENT]), get('/api/portal/cart', emptyCart)]);
    renderScreen(<FavoritesPage />);

    const [row] = await screen.findAllByTestId('favorite-row');
    expect(within(row).getByTestId('line-thumb')).toBeInTheDocument();
    expect(within(row).queryByTestId('line-thumb-photo')).not.toBeInTheDocument();
  });
});

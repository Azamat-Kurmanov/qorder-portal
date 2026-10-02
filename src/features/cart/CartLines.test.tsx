import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartLines } from './CartLines';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const line = (itemId: string, name: string, unit = 'мешок') => ({
  itemId,
  name,
  quantity: 2,
  unit,
  priceAtAdding: 2500,
  price: 2500,
  priceChanged: false,
  total: 5000,
});

const cart = {
  lines: [line('item-1', 'Цемент М400'), line('item-2', 'Гвозди 100 мм', 'шт')],
  total: 10000,
  skipped: [],
};

describe('строки корзины', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Крестик у строки убирает её той же операцией количества: ноль — это
   * «убрать». Отдельного удаления у сервера нет, и итог пересчитывает
   * тот же ответ.
   */
  it('крестик убирает строку нулевым количеством', async () => {
    const { calls } = stubFetch([
      get('/api/portal/cart', cart),
      method('PUT', '/api/portal/cart/lines/item-1', { ...cart, lines: [cart.lines[1]], total: 5000 }),
    ]);
    renderScreen(<CartLines />);

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить Цемент М400' }));

    await waitFor(() => expect(screen.queryByText('Цемент М400')).not.toBeInTheDocument());
    const put = calls.find((call) => call.init?.method === 'PUT');
    expect(put?.url).toContain('/api/portal/cart/lines/item-1');
    expect(JSON.parse(String(put?.init?.body))).toEqual({ quantity: 0 });
    // Соседняя строка на месте: крестик убирает одну, а не всё.
    expect(screen.getByText('Гвозди 100 мм')).toBeInTheDocument();
  });

  it('название товара ведёт на его карточку', async () => {
    stubFetch([get('/api/portal/cart', cart)]);
    renderScreen(<CartLines />);

    const link = await screen.findByRole('link', { name: 'Цемент М400' });
    expect(link).toHaveAttribute('href', '/catalog/item-1');
  });

  /**
   * Положили до акции — сервер помечает `priceChanged`, но обычная цена та же.
   * Это скидка, а не смена цены: «было — стало» здесь вводило бы в заблуждение.
   */
  it('началась акция — показана скидка, а не «Цена изменилась»', async () => {
    const sale = {
      ...line('item-1', 'Брюки чинос City', 'шт'), quantity: 1,
      priceAtAdding: 31990, price: 28791, priceChanged: true, total: 28791,
      listPrice: 31990, discountPercent: 10,
    };
    stubFetch([get('/api/portal/cart', { ...cart, lines: [sale] })]);
    renderScreen(<CartLines />);

    const [row] = await screen.findAllByTestId('cart-line');
    expect(row).not.toHaveTextContent('Цена изменилась');
    expect(row).toHaveTextContent('−10%');
    expect(row).toHaveTextContent(/без скидки 31\s990 ₸/);
  });

  it('продавец сменил обычную цену во время акции — «Цена изменилась»', async () => {
    const changed = {
      ...line('item-1', 'Брюки чинос City', 'шт'), quantity: 1,
      priceAtAdding: 31990, price: 30591, priceChanged: true, total: 30591,
      listPrice: 33990, discountPercent: 10,
    };
    stubFetch([get('/api/portal/cart', { ...cart, lines: [changed] })]);
    renderScreen(<CartLines />);

    const [row] = await screen.findAllByTestId('cart-line');
    expect(row).toHaveTextContent(/Цена изменилась: было 31\s990 ₸, стало 30\s591 ₸/);
  });

  /**
   * Варианты — отдельные позиции с одним названием: две строки разных
   * цветов без подписи читались бы одной позицией, положенной дважды.
   */
  it('у пресса по нажатию — состав и итог', async () => {
    const press = {
      ...line('item-9', 'Худи — пресс', 'пресс'), quantity: 1,
      pack: [
        { itemId: 's', name: 'Худи', variantLabel: 'S', quantity: 1, unit: 'шт' },
        { itemId: 'm', name: 'Худи', variantLabel: 'M', quantity: 2, unit: 'шт' },
      ],
    };
    stubFetch([get('/api/portal/cart', { ...cart, lines: [press] })]);
    renderScreen(<CartLines />);

    await userEvent.click(await screen.findByRole('button', { name: 'Что в прессе' }));
    const list = screen.getByTestId('pack-contents');
    expect(list).toBeVisible();
    expect(list).toHaveTextContent(/Худи · M\s*2 шт\./);
    expect(list).toHaveTextContent(/Всего\s*3 шт\./);
  });

  describe('строка с упаковками', () => {
    const packs = {
      ...line('item-1', 'Цемент М400', 'мешок'),
      quantity: 45, price: 100, priceAtAdding: 100, total: 4100,
      split: { packs: 2, packUnit: 'упаковка', packQty: 20, packPrice: 1800, rest: 5 },
      hint: { addPieces: 15, packs: 3, packPrice: 1800, saving: 200 },
    };

    it('в корзине — разбиение и что сделать ради следующей упаковки', async () => {
      stubFetch([get('/api/portal/cart', { ...cart, lines: [packs] })]);
      renderScreen(<CartLines />);

      const [row] = await screen.findAllByTestId('cart-line');
      expect(row).toHaveTextContent(/2 упаковки \(по 20 мешков\) × 1\s800 ₸ \+ 5 мешков × 100 ₸/);
      expect(within(row).getByTestId('next-tier'))
        .toHaveTextContent(/Добавьте ещё 15 мешков — и будет 3 упаковки по 1\s800 ₸, выгода 200 ₸/);
    });

    it('в сверке при оформлении — «45 мешков = 2 упаковки … + 5 мешков × 100 ₸»', async () => {
      stubFetch([get('/api/portal/cart', { ...cart, lines: [packs] })]);
      renderScreen(<CartLines editable={false} />);

      const [row] = await screen.findAllByTestId('cart-line');
      expect(row).toHaveTextContent(/45 мешков = 2 упаковки \(по 20 мешков\) × 1\s800 ₸ \+ 5 мешков × 100 ₸/);
    });

    it('крестик и «Вернуть» работают со штуками', async () => {
      const { calls } = stubFetch([
        get('/api/portal/cart', { ...cart, lines: [packs] }),
        method('PUT', '/api/portal/cart/lines/item-1', { ...cart, lines: [] }),
      ]);
      renderScreen(<CartLines />);

      await userEvent.click(await screen.findByRole('button', { name: 'Удалить Цемент М400' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Вернуть' }));

      const puts = calls.filter((call) => call.init?.method === 'PUT').map((call) => JSON.parse(String(call.init?.body)));
      expect(puts).toEqual([{ quantity: 0 }, { quantity: 45 }]);
    });

    it('продавец поднял цену ступени — «Цена упаковки изменилась», розница та же', async () => {
      const changed = {
        ...packs, priceChanged: true, total: 4300,
        split: { ...packs.split, packPrice: 1900, packPriceAtAdding: 1800 },
      };
      stubFetch([get('/api/portal/cart', { ...cart, lines: [changed] })]);
      renderScreen(<CartLines />);

      const [row] = await screen.findAllByTestId('cart-line');
      expect(row).toHaveTextContent(/Цена упаковки изменилась: было 1\s800 ₸, стало 1\s900 ₸/);
      expect(row).not.toHaveTextContent('Цена изменилась');
    });
  });

  it('цена за единицу в корзине — «за упаковку»', async () => {
    stubFetch([get('/api/portal/cart', { ...cart, lines: [{ ...line('item-1', 'Салфетки', 'упаковка'), price: 500, priceAtAdding: 500 }] })]);
    renderScreen(<CartLines />);

    const [row] = await screen.findAllByTestId('cart-line');
    expect(row).toHaveTextContent(/500 ₸ за упаковку/);
  });

  it('вариант назван перед ценой — и в корзине, и в сверке при оформлении', async () => {
    const hoodie = (itemId: string, variantLabel: string) => ({
      ...line(itemId, 'Худи', 'шт'), quantity: 1, price: 29990, priceAtAdding: 29990, total: 29990, variantLabel,
    });
    stubFetch([get('/api/portal/cart', { ...cart, lines: [hoodie('item-1', 'чёрный'), hoodie('item-2', 'белый · L')] })]);
    const { unmount } = renderScreen(<CartLines />);

    const [black, white] = await screen.findAllByTestId('cart-line');
    expect(black).toHaveTextContent(/чёрный · 29\s990 ₸ за шт\./);
    expect(white).toHaveTextContent(/белый · L · 29\s990 ₸ за шт\./);
    unmount();

    renderScreen(<CartLines editable={false} />);
    const [summaryBlack] = await screen.findAllByTestId('cart-line');
    expect(summaryBlack).toHaveTextContent(/чёрный · 1 шт\. × 29\s990 ₸/);
  });

  it('в другой валюте магазина строка и итог показывают её знак', async () => {
    stubFetch([get('/api/portal/cart', {
      ...cart,
      lines: [{ ...line('item-1', 'Цемент М400'), quantity: 20, total: 50000 }],
    })]);
    renderScreen(<CartLines editable={false} />, { currency: 'RUB' });

    const [row] = await screen.findAllByTestId('cart-line');
    expect(row).toHaveTextContent('20 мешков × 2 500 ₽');
    expect(within(row).getByTestId('line-total')).toHaveTextContent('50 000 ₽');
    expect(row).not.toHaveTextContent('₸');
  });

  it('«шт» у количества пишется с точкой', async () => {
    stubFetch([get('/api/portal/cart', cart)]);
    renderScreen(<CartLines />);

    expect(await screen.findByText('шт.')).toBeInTheDocument();
  });

  it('строка со снимком показывает его, без снимка — заглушку', async () => {
    stubFetch([get('/api/portal/cart', {
      ...cart,
      lines: [{ ...cart.lines[0], imageUrl: 'https://cdn.example.kz/cement.jpg' }, cart.lines[1]],
    })]);
    renderScreen(<CartLines />);

    const [first, second] = await screen.findAllByTestId('cart-line');
    expect(within(first).getByTestId('line-thumb-photo'))
      .toHaveAttribute('src', 'https://cdn.example.kz/cement.jpg');
    expect(within(second).queryByTestId('line-thumb-photo')).not.toBeInTheDocument();
    expect(within(second).getByTestId('line-thumb')).toBeInTheDocument();
  });

  it('в сверке при оформлении строка тоже со снимком', async () => {
    stubFetch([get('/api/portal/cart', {
      ...cart,
      lines: [{ ...cart.lines[0], imageUrl: 'https://cdn.example.kz/cement.jpg' }, cart.lines[1]],
    })]);
    renderScreen(<CartLines editable={false} />);

    const [first] = await screen.findAllByTestId('cart-line');
    expect(within(first).getByTestId('line-thumb-photo'))
      .toHaveAttribute('src', 'https://cdn.example.kz/cement.jpg');
  });
});

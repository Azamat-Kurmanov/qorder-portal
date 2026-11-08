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

  it('строка по условию клиента подписана «ваша цена»', async () => {
    stubFetch([get('/api/portal/cart', { ...cart, lines: [{ ...line('item-1', 'Цемент М400'), yourPrice: true }] })]);
    renderScreen(<CartLines />);

    expect(await screen.findByText(/ваша цена/)).toBeInTheDocument();
  });

  it('у строки нет «В розницу / Оптом»: в корзине — строки открытой заявки, способ выбирают в каталоге', async () => {
    const both = { ...line('item-1', 'Брюки Elegance', 'шт'), mode: 'WHOLESALE' };
    stubFetch([get('/api/portal/cart', { ...cart, lines: [both, cart.lines[1]] })]);
    renderScreen(<CartLines />);

    // В корзине и оптовая строка, и штучная: открыта розничная — оптовой строки на экране нет.
    const shown = await screen.findAllByTestId('cart-line');
    expect(shown).toHaveLength(1);
    expect(within(shown[0]).queryByRole('button', { name: 'Оптом' })).not.toBeInTheDocument();
  });

  it('у каждой строки написано, как она продаётся: оптом или в розницу', async () => {
    const packs = { ...line('item-1', 'Брюки Elegance', 'шт'), split: { packs: 1, packUnit: 'пачка', packQty: 5, packPrice: 9000, rest: 0 } };
    stubFetch([get('/api/portal/cart', { ...cart, lines: [packs] })]);
    renderScreen(<CartLines />);
    expect(await screen.findByTestId('cart-line-mode')).toHaveTextContent('Оптом');
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

    await userEvent.click(await screen.findByRole('button', { name: 'Что внутри' }));
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

    it('в корзине — цена одной упаковки и одной штуки, без расчёта и подсказки «добавьте ещё»', async () => {
      stubFetch([get('/api/portal/cart', { ...cart, lines: [packs] })]);
      renderScreen(<CartLines />);

      const [row] = await screen.findAllByTestId('cart-line');
      const rows = within(row).getByTestId('channel-rows');
      expect(rows).not.toHaveTextContent('Оптом:');
      expect(rows).toHaveTextContent(/1\s800 ₸ \/ упаковка \(20 мешков\)/);
      expect(rows).toHaveTextContent(/^1\s800 ₸ \/ упаковка \(20 мешков\)100 ₸ \/ мешок$/);
      expect(rows).not.toHaveTextContent('×');
      expect(within(row).getByTestId('line-saving')).toHaveTextContent(/^выгода 400 ₸$/);
      expect(within(row).queryByTestId('line-saving-why')).not.toBeInTheDocument();
      // Из чего выгода — по нажатию.
      await userEvent.click(within(row).getByTestId('line-saving'));
      expect(within(row).getByTestId('line-saving-why'))
        .toHaveTextContent(/По обычной цене: 45 мешков × 100 ₸ = 4\s500 ₸\. У вас 4\s100 ₸ — на 400 ₸ меньше\./);
      expect(within(row).queryByText(/Добавьте ещё/)).not.toBeInTheDocument();
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

  describe('опт по модели (размеры одной модели вместе)', () => {
    const size = (itemId: string, label: string, quantity: number, wholesale: boolean) => ({
      ...line(itemId, 'Брюки Elegance', 'шт'), variantLabel: label, quantity,
      price: 29990, priceAtAdding: 29990, total: quantity * (wholesale ? 22000 : 29990), modelKey: 'm1',
      ...(wholesale ? { split: { packs: quantity, packUnit: 'шт', packQty: 1, packPrice: 22000, rest: 0 } } : {}),
    });

    it('не добрали порог — подсказки «добавьте ещё» в корзине нет', async () => {
      const hint = { addPieces: 1, packs: 10, packPrice: 22000, saving: 71910 };
      stubFetch([get('/api/portal/cart', { ...cart, lines: [
        { ...size('s44', '44', 5, false), hint }, { ...size('s46', '46', 4, false), hint },
      ] })]);
      renderScreen(<CartLines />);

      await screen.findAllByTestId('cart-line');
      expect(screen.queryByText(/Добавьте ещё/)).not.toBeInTheDocument();
    });

    it('набрали порог — у размера оптовая цена без «упаковок по 1 шт»', async () => {
      stubFetch([get('/api/portal/cart', { ...cart, lines: [size('s44', '44', 5, true), size('s46', '46', 5, true)] })]);
      renderScreen(<CartLines />);

      const [row] = await screen.findAllByTestId('cart-line');
      expect(row).toHaveTextContent(/22\s000 ₸ \/ шт\./);
      expect(row).not.toHaveTextContent(/по 1 шт\./);
    });
  });
});

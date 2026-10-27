import { stubWideScreen } from '../../test/wideScreen';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogPage } from './CatalogPage';
import { ItemThumb } from './ItemThumb';
import { TemplateTile } from './tiles/TemplateTile';
import { Route, Routes } from 'react-router-dom';
import { renderScreen } from '../../test/render';
import { AgeGateDialog } from '../cart/ageGate';
import { AddedToast } from '../cart/CartPanel';
import { get, method, stubFetch, type StubbedResponse } from '../../test/http';

const CEMENT = {
  id: 'item-1',
  name: 'Цемент М400',
  unit: 'мешок',
  price: 2500,
  priceAsOf: '2026-08-29T10:00:00Z',
  vatRate: 12,
  stock: 'IN_STOCK',
};

const SAND = {
  id: 'item-2',
  name: 'Песок строительный',
  unit: 'м³',
  price: 12000,
  vatRate: 12,
  stock: 'IN_STOCK',
};

const emptyCart = { lines: [], total: 0, skipped: [] };

/** Корзина с одной строкой: позиция уже взята, и в строке стоит счётчик. */
function cartWith(itemId: string, quantity: number) {
  return {
    lines: [{
      itemId, name: 'Цемент М400', quantity, unit: 'мешок',
      priceAtAdding: 2500, price: 2500, priceChanged: false, total: 2500 * quantity,
    }],
    total: 2500 * quantity,
    skipped: [],
  };
}

/**
 * Корзина, которая помнит положенное.
 *
 * Плоское правило отдавало бы пустую корзину и на перезапрос сразу после
 * добавления — витрина честно вернула бы кнопку, и проверка ловила бы
 * заглушку, а не экран. Тело читается на момент ответа, поэтому состояние
 * успевает смениться между запросами.
 */
function cartServer(afterAdding: unknown): StubbedResponse[] {
  let state: unknown = emptyCart;

  return [
    {
      match: (url, init) => url.includes('/api/portal/cart/lines/') && init?.method === 'PUT',
      get body() {
        state = afterAdding;
        return state;
      },
    },
    {
      match: (url, init) => url.includes('/api/portal/cart') && (init?.method ?? 'GET') === 'GET',
      get body() {
        return state;
      },
    },
  ];
}

function catalogRules(items: unknown[] = [CEMENT], cart: unknown = emptyCart) {
  return [
    get('/api/portal/categories', []),
    get('/api/portal/catalog', { page: 0, size: 50, totalElements: items.length, items }),
    get('/api/portal/cart', cart),
  ];
}

/**
 * Ширина КОЛОНКИ витрины — то, по чему она выбирает раскладку.
 *
 * Витрина меряет своё место сама (`useColumnWidth`), а jsdom размеров
 * не считает и отдаёт нули: без подмены любой экран здесь узкий. Подменяется
 * измерение, а не медиа-запрос, — ровно то, на что витрина и смотрит.
 */
function stubColumnWidth(width: number) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

/**
 * Витрина и заглушка карточки на одном роутере.
 *
 * Переход проверяется появлением другого экрана, а не адресом в памяти:
 * ссылка, ведущая в никуда, оставила бы адрес правильным.
 */
function renderCatalogWithCard() {
  return renderScreen(
    <Routes>
      <Route path="/" element={<CatalogPage />} />
      <Route path="/catalog/:itemId" element={<h1>Карточка позиции</h1>} />
    </Routes>,
  );
}

describe('витрина кабинета', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * Снимок берётся у сервера, когда он есть.
   *
   * Заполнитель — не оформление, а признание, что картинки нет: подставлять
   * его поверх присланного адреса значило бы прятать товар за узором.
   */
  it('карточка показывает снимок позиции, а заполнитель остаётся позициям без него', async () => {
    stubFetch(catalogRules([
      { ...CEMENT, thumbnailUrl: 'https://cdn.example.kz/cement.jpg' },
      { ...CEMENT, id: 'item-2', name: 'Песок', thumbnailUrl: undefined },
    ]));

    const { container } = renderScreen(<CatalogPage />);

    await screen.findByText('Цемент М400');
    // Не по роли: снимок подписан пустым `alt` — он украшает строку, а имя
    // позиции стоит рядом ссылкой, и второй раз диктору его читать незачем.
    // Пустой `alt` убирает картинку из дерева доступности, поэтому ищется она
    // разметкой.
    const images = container.querySelectorAll('img');
    // Ровно один снимок на две позиции: у второй его нет, и подставлять туда
    // нечего — там остаётся заполнитель.
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', 'https://cdn.example.kz/cement.jpg');
  });

  /*
   * Стык витрины с шапкой оболочки.
   *
   * На мониторе поиск стоит в верхней полосе и отправляет запрос адресом
   * (`/catalog?q=…`). Витрина обязана этот адрес прочитать, иначе поиск из
   * шапки не находит ничего, а два поля с одинаковым именем «Поиск по
   * каталогу» в одном дереве — это два разных ответа на вопрос «что я ищу»,
   * и человек не знает, какое из них считается.
   */
  it('на мониторе запрос берётся из адреса, а второго поля поиска нет', async () => {
    stubWideScreen();
    const { calls } = stubFetch(catalogRules());

    renderScreen(<CatalogPage />, { route: '/catalog?q=цемент' });

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('query=%D1%86%D0%B5%D0%BC%D0%B5%D0%BD%D1%82'))).toBe(true);
    });
    expect(screen.queryByLabelText('Поиск по каталогу')).not.toBeInTheDocument();
  });

  it('в распродаже набранный поиск не пропадает: уходит вместе с «Со скидкой»', async () => {
    const { calls } = stubFetch(catalogRules());

    renderScreen(<CatalogPage />, { route: '/catalog?q=цемент&sale=1' });

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('onSale=true')
        && call.url.includes('query=%D1%86%D0%B5%D0%BC%D0%B5%D0%BD%D1%82'))).toBe(true);
    });
    // Порядок у распродажи свой — сначала с большей скидкой.
    expect(calls.filter((call) => call.url.includes('onSale=true')).every((call) => !call.url.includes('sort='))).toBe(true);
  });

  it('на телефоне запрос тоже берётся из адреса: поле поиска стоит в шапке', async () => {
    const { calls } = stubFetch(catalogRules());

    renderScreen(<CatalogPage />, { route: '/catalog?q=цемент' });

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('query=%D1%86%D0%B5%D0%BC%D0%B5%D0%BD%D1%82'))).toBe(true);
    });
    expect(screen.queryByLabelText('Поиск по каталогу')).not.toBeInTheDocument();
  });

  it('позиция вне корзины предлагает кнопку, а не поле количества', async () => {
    // Поле количества у каждой строки означало бы, что в корзине уже лежит
    // весь каталог по нулю: витрина обязана отличать «не брал» от «взял ноль».
    stubFetch(catalogRules());
    renderScreen(<CatalogPage />);

    expect(await screen.findByRole('button', { name: 'В корзину' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Количество, /)).not.toBeInTheDocument();
    // Карточка открывается по желанию — с имени, — но на пути к корзине не стоит.
    expect(screen.getByRole('link', { name: /цемент/i })).toHaveAttribute(
      'href', '/catalog/item-1',
    );
  });

  it('«В корзину» кладёт одну единицу и уступает место счётчику', async () => {
    const { calls } = stubFetch([
      ...cartServer(cartWith('item-1', 1)),
      get('/api/portal/categories', []),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 1, items: [CEMENT] }),
    ]);

    renderScreen(<CatalogPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'В корзину' }));

    const put = await waitFor(() => {
      const found = calls.find((call) => call.init?.method === 'PUT');
      expect(found).toBeDefined();
      return found!;
    }, { timeout: 3000 });
    expect(JSON.parse(String(put.init?.body))).toEqual({ quantity: 1 });

    // Взятая позиция дальше набирается счётчиком: кнопка, оставшаяся на месте,
    // добавляла бы одну и ту же единицу второй раз.
    expect(await screen.findByLabelText(/^Количество, /)).toHaveValue(1);
    expect(screen.queryByRole('button', { name: 'В корзину' })).not.toBeInTheDocument();
  });

  it('количество взятой позиции набирается на витрине, без перехода на карточку', async () => {
    const { calls } = stubFetch([
      ...catalogRules([CEMENT], cartWith('item-1', 1)),
      method('PUT', '/api/portal/cart/lines/item-1', {
        lines: [{
          itemId: 'item-1', name: 'Цемент М400', quantity: 5, unit: 'мешок',
          priceAtAdding: 2500, price: 2500, priceChanged: false, total: 12500,
        }],
        total: 12500,
        skipped: [],
      }),
    ]);

    renderScreen(<CatalogPage />);

    const field = await screen.findByLabelText(/^Количество, /);
    await userEvent.clear(field);
    await userEvent.type(field, '5');

    await waitFor(() => {
      expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true);
    }, { timeout: 3000 });
    expect(await screen.findByTestId('cart-bar')).toHaveTextContent('12 500');
  });

  it('набор количества не порождает запрос на каждую цифру', async () => {
    const { calls } = stubFetch([
      ...catalogRules([CEMENT], cartWith('item-1', 1)),
      method('PUT', '/api/portal/cart/lines/item-1', { ...emptyCart }),
    ]);

    renderScreen(<CatalogPage />);
    const field = await screen.findByLabelText(/^Количество, /);
    await userEvent.clear(field);
    await userEvent.type(field, '125');

    await waitFor(() => {
      expect(calls.filter((call) => call.init?.method === 'PUT')).toHaveLength(1);
    }, { timeout: 3000 });
  });

  it('пустой остаток приходит как null и не превращается в ноль', async () => {
    // «Свободно: 0» — это обещание, что товара нет. Сервер же сказал только,
    // что точного количества не показывает.
    stubFetch(catalogRules([{ ...CEMENT, available: null }]));

    renderScreen(<CatalogPage />);

    // «В наличии» плитка молчит (макеты «Кабинет клиента 2.0») — и не выдумывает «Свободно: 0».
    await screen.findByTestId('item-tile');
    expect(screen.queryByText(/Свободно/)).not.toBeInTheDocument();
  });

  it('сердечко на карточке закрашивается сразу и не перезапрашивает каталог', async () => {
    const { calls } = stubFetch([
      ...catalogRules([{ ...CEMENT, favorite: false }]),
      get('/api/portal/favorites', []),
      method('POST', '/api/portal/favorites/item-1/toggle', { itemId: 'item-1', favorite: true }),
    ]);

    renderScreen(<CatalogPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'В избранное' }));

    expect(await screen.findByRole('button', { name: 'Убрать из избранного' })).toBeInTheDocument();
    // Перезапрос витрины ради одного флага стоил бы клиенту полусотни строк
    // на мобильной сети — и мигания списка под пальцем.
    expect(calls.filter((call) => /\/api\/portal\/catalog(\?|$)/.test(call.url))).toHaveLength(1);
  });

  it('единица после «за» — в винительном падеже, «шт» — с точкой', async () => {
    stubFetch(catalogRules([
      { ...CEMENT, id: 'item-1', unit: 'упаковка' },
      { ...CEMENT, id: 'item-2', name: 'Гвозди', unit: 'шт' },
    ]));
    renderScreen(<CatalogPage />);

    const [first, second] = await screen.findAllByTestId('item-tile');
    expect(within(first).getByText('за упаковку')).toBeInTheDocument();
    expect(within(second).getByText('за шт.')).toBeInTheDocument();
  });

  it('цена стоит отдельно от единицы, налога и даты', async () => {
    stubFetch(catalogRules());
    renderScreen(<CatalogPage />);

    const tile = await screen.findByTestId('item-tile');
    // Цена — крупным числом сама по себе, единица — рядом, налог и дата —
    // мелкой строкой под ними: в макете это разные размеры, а не одно предложение.
    expect(within(tile).getByText('2 500 ₸')).toBeInTheDocument();
    expect(within(tile).getByText('за мешок')).toBeInTheDocument();
    // Цена без НДС: налог прибавится сверху при оформлении.
    const note = within(tile).getByText(/без НДС/);
    expect(note).toHaveTextContent('без НДС, +12%');
    // Дата актуальности остаётся: цена без неё превращается в бессрочное
    // обещание, а требование о полноте торговой информации действует и здесь.
    expect(note).toHaveTextContent('29.08');
  });

  /** Магазин в другой валюте — плитка показывает её знак, а не «₸». */
  it('в другой валюте магазина цена и старая цена — с её знаком, «₸» нет', async () => {
    stubFetch(catalogRules([{ ...CEMENT, oldPrice: 3000 }]));
    renderScreen(<CatalogPage />, { currency: 'RUB' });

    const tile = await screen.findByTestId('item-tile');
    expect(within(tile).getByText('2 500 ₽')).toBeInTheDocument();
    expect(within(tile).getByText('3 000 ₽')).toBeInTheDocument();
    expect(tile).not.toHaveTextContent('₸');
  });

  /** Магазин ещё не открыт (валюта не пришла) — цена без знака, а не «₸» по умолчанию. */
  it('пока магазин не известен, цена показывается без знака валюты', async () => {
    stubFetch(catalogRules());
    renderScreen(<CatalogPage />, { currency: null });

    const tile = await screen.findByTestId('item-tile');
    expect(within(tile).getByText('2 500')).toBeInTheDocument();
    expect(tile).not.toHaveTextContent('₸');
  });

  it('поиск уходит на сервер, а не фильтрует загруженное', async () => {
    const { calls } = stubFetch(catalogRules());
    renderScreen(<CatalogPage />, { route: '/catalog?q=қағаз' });
    await screen.findByTestId('item-tile');

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('query=') && call.url.includes('catalog')))
        .toBe(true);
    }, { timeout: 3000 });
  });

  it('«Уточняется» на витрине не пишется — только то, что что-то говорит', async () => {
    stubFetch(catalogRules([{ ...CEMENT, stock: 'UNKNOWN' }]));
    renderScreen(<CatalogPage />);

    // У каждой позиции «Уточняется» было шумом (макеты «Кабинет клиента 2.0»);
    // полностью наличие сказано в карточке товара.
    const tile = await screen.findByTestId('item-tile');
    expect(within(tile).queryByText('Уточняется')).not.toBeInTheDocument();
    expect(screen.queryByText(/нет в наличии/i)).not.toBeInTheDocument();
  });

  /**
   * Поставщик ведёт учёт — обещал держать остаток точным, и его ноль верный:
   * клиент видит «нет в наличии», а не «уточняется». Заказать всё равно можно —
   * заявку подтверждает поставщик.
   */
  it('при учёте остатков ноль показывается как «Нет в наличии»', async () => {
    stubFetch(catalogRules([{ ...CEMENT, stock: 'OUT_OF_STOCK' }]));
    renderScreen(<CatalogPage />);

    expect(await screen.findByText('Нет в наличии')).toBeInTheDocument();
    expect(screen.queryByText('Уточняется')).not.toBeInTheDocument();
  });

  it('пустой остаток числом не превращается в «Свободно: 0»', async () => {
    // Поставщик показывает наличие флагом: числа остатка в ответе нет, и поле
    // приходит со значением null. Ноль на его месте означал бы «кончилось» —
    // клиент увидел бы отсутствие товара там, где товар есть.
    stubFetch(catalogRules([{ ...CEMENT, stock: 'IN_STOCK', available: null }]));
    renderScreen(<CatalogPage />);

    await screen.findByTestId('item-tile');
    expect(screen.queryByText(/свободно/i)).not.toBeInTheDocument();
  });

  it('заполнитель снимка выбирается по позиции и не прыгает между перерисовками', async () => {
    // Витрина снимков не отдаёт, и заполнитель — единственное, что стоит
    // в слоте. Случайный выбирался бы заново на каждый ответ сервера, и
    // список мигал бы разными пятнами под пальцем.
    stubFetch(catalogRules([CEMENT, SAND]));
    const { rerender } = renderScreen(<CatalogPage />);

    const [cement, sand] = await screen.findAllByTestId('item-thumb');
    const before = cement.getAttribute('style');
    expect(before).toMatch(/linear-gradient/);
    expect(sand.getAttribute('style')).not.toBe(before);

    rerender(<CatalogPage />);
    expect(screen.getAllByTestId('item-thumb')[0].getAttribute('style')).toBe(before);
  });

  it('в рубрике — отбор по её полям: выбранный вариант уходит в запрос, другая рубрика сбрасывает отбор', async () => {
    const { calls } = stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Одежда', sortOrder: 1 }, { id: 'cat-2', name: 'Обувь', sortOrder: 2 }]),
      get('/api/portal/catalog/filters', [
        { code: 'COLOR', name: 'Цвет', type: 'OPTION', options: [{ code: 'red', name: 'Красный', count: 2 }, { code: 'blue', name: 'Синий', count: 1 }] },
        { code: 'WARM', name: 'Утеплённая', type: 'BOOLEAN', options: [{ code: 'true', count: 1 }] },
      ]),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 1, items: [CEMENT] }),
      get('/api/portal/cart', emptyCart),
    ]);
    renderScreen(<CatalogPage />);

    await userEvent.click(await screen.findByRole('button', { name: /^Одежда/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Красный/ }));
    await userEvent.click(screen.getByRole('button', { name: /Утеплённая/ }));

    await waitFor(() => expect(calls.some((call) => call.url.includes('/api/portal/catalog?')
      && call.url.includes('field=COLOR%3Ared') && call.url.includes('field=WARM%3Atrue'))).toBe(true));

    await userEvent.click(screen.getByRole('button', { name: /^Обувь/ }));
    await waitFor(() => {
      const last = calls.filter((call) => call.url.includes('/api/portal/catalog?')).at(-1);
      expect(last?.url).toContain('categoryId=cat-2');
      expect(last?.url).not.toContain('field=');
    });
  });

  it('на телефоне рубрики — строкой чипов, а витрина — карточками в две колонки', async () => {
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 1 }]),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 1, items: [CEMENT] }),
      get('/api/portal/cart', emptyCart),
    ]);
    renderScreen(<CatalogPage />);

    expect(await screen.findByRole('button', { name: 'Все товары' })).toHaveAttribute('aria-pressed', 'true');
    // Строка листается пальцем: сетка чипов отняла бы пол-экрана у товаров.
    expect(screen.getByRole('group', { name: 'Рубрики' }).className).toContain('overflow-x-auto');
    expect(await screen.findByTestId('item-grid')).toHaveClass('grid-cols-2');
  });

  /**
   * Планшет и монитор с открытыми колонками: окно широкое, а места нет.
   *
   * Раскладка решается по ширине колонки витрины, а не окна: на 1024 точках
   * оболочка забирает под разделы и корзину больше половины, и три карточки
   * схлопнулись бы в полоски.
   */
  it('на узкой колонке витрина остаётся в две карточки, даже когда окно широкое', async () => {
    stubWideScreen();
    stubColumnWidth(396);
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 1 }]),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 2, items: [CEMENT, SAND] }),
      get('/api/portal/cart', emptyCart),
    ]);
    renderScreen(<CatalogPage />);

    expect(await screen.findByTestId('item-grid')).toHaveClass('grid-cols-2');
    expect(screen.getAllByTestId('item-tile')).toHaveLength(2);
  });

  it('на мониторе витрина встаёт в три карточки, а рубрики стоят колонкой слева', async () => {
    stubWideScreen();
    stubColumnWidth(812);
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 1 }]),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 2, items: [CEMENT, SAND] }),
      get('/api/portal/cart', emptyCart),
    ]);
    renderScreen(<CatalogPage />);

    expect(await screen.findByTestId('item-grid')).toHaveClass('grid-cols-3');
    expect(screen.getAllByTestId('item-tile')).toHaveLength(2);

    const rubrics = screen.getByRole('group', { name: 'Рубрики' });
    expect(within(rubrics).getByRole('button', { name: 'Все товары' })).toHaveAttribute('aria-pressed', 'true');

    // Выбранная рубрика названа выбранной, а не только залита цветом.
    await userEvent.click(within(rubrics).getByRole('button', { name: 'Сухие смеси' }));
    expect(within(rubrics).getByRole('button', { name: 'Сухие смеси' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  /** Пустой ответ объясняет, что делать, и сбрасывает раздел одним нажатием. */
  it('без находок витрина советует и предлагает сбросить раздел', async () => {
    const { calls } = stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 1 }]),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 0, items: [] }),
      get('/api/portal/cart', emptyCart),
    ]);
    renderScreen(<CatalogPage />);

    // Без выбранного раздела сбрасывать нечего — и кнопки нет.
    expect(await screen.findByText('Ничего не нашли по запросу. Попробуйте другое название или сбросьте раздел.'))
      .toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сбросить раздел' })).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Сухие смеси' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Сбросить раздел' }));
    expect(screen.getByRole('button', { name: 'Все товары' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      const last = calls.filter((call) => call.url.includes('/api/portal/catalog')).at(-1);
      expect(last?.url).not.toContain('categoryId');
    });
  });

  it('метка ролика рисуется поверх снимка, когда ролик есть', () => {
    // Витрина о роликах не сообщает, поэтому метка держится на отдельном
    // признаке: место под неё в слоте есть, а рисовать её витрине пока нечем.
    const { unmount } = render(<ItemThumb itemId="item-1" video />);
    expect(screen.getByText('видео')).toBeInTheDocument();
    unmount();

    render(<ItemThumb itemId="item-2" />);
    expect(screen.queryByText('видео')).not.toBeInTheDocument();
  });
  /**
   * Карточка открывается нажатием куда угодно по прямоугольнику позиции.
   *
   * Прицеливаться в имя закупщик не обязан: имя занимает треть строки, а
   * остальные две трети — цена, наличие и пустое место — до сих пор
   * не отвечали ни на что.
   */
  it('нажатие по пустому месту плитки открывает карточку позиции', async () => {
    stubWideScreen();
    stubColumnWidth(1040);
    stubFetch(catalogRules());
    renderCatalogWithCard();

    const tile = await screen.findByTestId('item-tile');
    await userEvent.click(within(tile).getByText('2 500 ₸'));

    expect(await screen.findByRole('heading', { name: 'Карточка позиции' })).toBeInTheDocument();
  });

  /**
   * Кнопки внутри прямоугольника остаются кнопками.
   *
   * Ради этого имя и было единственной ссылкой: строка, уводящая с витрины
   * от любого касания, уводила бы и тех, кто целился в «плюс».
   */
  it('сердечко и «В корзину» внутри карточки не уводят с витрины', async () => {
    stubFetch([
      // Корзина, помнящая положенное, — первой: плоское правило из
      // `catalogRules` отдало бы пустую на перезапрос после добавления.
      ...cartServer(cartWith('item-1', 1)),
      ...catalogRules(),
      get('/api/portal/favorites', []),
      method('POST', '/api/portal/favorites/item-1/toggle', { itemId: 'item-1', favorite: true }),
    ]);
    renderCatalogWithCard();

    const row = await screen.findByTestId('item-tile');

    await userEvent.click(within(row).getByRole('button', { name: 'В избранное' }));
    expect(await screen.findByRole('button', { name: 'Убрать из избранного' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Карточка позиции' })).not.toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: 'В корзину' }));
    expect(await screen.findByRole('spinbutton')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Карточка позиции' })).not.toBeInTheDocument();
  });
});


describe('витрина по макету: порядок, числа, метки и условия продажи', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const COUNTS = { all: 12, sale: 0, novelty: 2, byCategory: { 'cat-1': 5 } };

  /** Числа разделов — своим правилом и первым: адрес начинается так же, как у страницы. */
  function withCounts(rules: StubbedResponse[], counts: unknown = COUNTS): StubbedResponse[] {
    return [get('/api/portal/catalog/counts', counts), ...rules];
  }

  it('у чипов стоят числа, а «Новинки» отбирают товары с меткой', async () => {
    const { calls } = stubFetch(withCounts([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }]),
      ...catalogRules(),
    ]));

    renderScreen(<CatalogPage />);

    expect(await screen.findByRole('button', { name: 'Все товары 12' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сухие смеси 5' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Новинки 2' }));

    await waitFor(() => expect(calls.some((call) => call.url.includes('novelty=true'))).toBe(true));
    expect(screen.getByRole('button', { name: 'Новинки 2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('чипы стоят и при одних новинках — без рубрик и распродажи', async () => {
    stubFetch(withCounts(catalogRules(), { all: 12, sale: 0, novelty: 2, byCategory: {} }));
    renderScreen(<CatalogPage />);

    expect(await screen.findByRole('button', { name: 'Новинки 2' })).toBeInTheDocument();
  });

  it('адрес «?novelty=1» открывает новинки', async () => {
    const { calls } = stubFetch(withCounts(catalogRules()));
    renderScreen(<CatalogPage />, { route: '/catalog?novelty=1' });

    await waitFor(() => expect(calls.some((call) => call.url.includes('novelty=true'))).toBe(true));
    expect(await screen.findByRole('button', { name: 'Новинки 2' })).toHaveAttribute('aria-pressed', 'true');
  });

  describe('витрина по страницам, а не первые пятьдесят', () => {
    /** Шестьдесят позиций у продавца — две страницы по сорок восемь. */
    function longCatalog(extra: StubbedResponse[] = []) {
      return stubFetch(withCounts([
        ...extra,
        get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }]),
        get('/api/portal/catalog', { page: 0, size: 48, totalElements: 60, items: [CEMENT] }),
        get('/api/portal/cart', emptyCart),
      ]));
    }
    const lastCatalogUrl = (calls: { url: string }[]) =>
      calls.filter((call) => call.url.includes('/api/portal/catalog?')).at(-1)?.url ?? '';

    it('вторая страница запрашивается у сервера', async () => {
      const { calls } = longCatalog();
      renderScreen(<CatalogPage />);
      await screen.findByText('Цемент М400');
      expect(lastCatalogUrl(calls)).toContain('size=48');

      await userEvent.click(screen.getByRole('button', { name: 'Страница 2' }));

      await waitFor(() => expect(lastCatalogUrl(calls)).toContain('page=1'));
    });

    it('смена рубрики возвращает на первую страницу', async () => {
      const { calls } = longCatalog();
      renderScreen(<CatalogPage />);
      await screen.findByText('Цемент М400');
      await userEvent.click(screen.getByRole('button', { name: 'Страница 2' }));
      await waitFor(() => expect(lastCatalogUrl(calls)).toContain('page=1'));

      await userEvent.click(screen.getByRole('button', { name: /^Сухие смеси/ }));

      await waitFor(() => {
        expect(lastCatalogUrl(calls)).toContain('categoryId=cat-1');
        expect(lastCatalogUrl(calls)).toContain('page=0');
      });
    });

    it('размер страницы выбирается и тоже начинает с первой', async () => {
      const { calls } = longCatalog();
      renderScreen(<CatalogPage />);
      await screen.findByText('Цемент М400');

      await userEvent.selectOptions(screen.getByLabelText('На странице'), '96');

      await waitFor(() => {
        expect(lastCatalogUrl(calls)).toContain('size=96');
        expect(lastCatalogUrl(calls)).toContain('page=0');
      });
    });
  });

  it('«Сортировка» на мониторе меняет порядок витрины', async () => {
    stubWideScreen();
    const { calls } = stubFetch(withCounts(catalogRules()));

    renderScreen(<CatalogPage />);
    await screen.findByText('Цемент М400');
    expect(calls.some((call) => call.url.includes('sort=POPULAR'))).toBe(true);

    await userEvent.click(within(screen.getByRole('group', { name: 'Сортировка' })).getByRole('button', { name: 'Дешевле' }));
    await waitFor(() => expect(calls.some((call) => call.url.includes('sort=CHEAPEST'))).toBe(true));
  });

  it('«Розница / Опт»: выбор уходит на сервер и в список, и в числа разделов', async () => {
    stubWideScreen();
    const { calls } = stubFetch(withCounts(catalogRules(), { ...COUNTS, retail: 10, wholesale: 4 }));

    renderScreen(<CatalogPage />);
    await screen.findByText('Цемент М400');
    const group = screen.getByRole('group', { name: 'Как продаётся' });
    expect(within(group).getByRole('button', { name: 'Все' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(group).getByRole('button', { name: 'Опт' }));
    await waitFor(() => expect(calls.some((call) => call.url.includes('/api/portal/catalog?') && call.url.includes('channel=WHOLESALE'))).toBe(true));
    expect(calls.some((call) => call.url.includes('/api/portal/catalog/counts') && call.url.includes('channel=WHOLESALE'))).toBe(true);
    expect(within(screen.getByRole('group', { name: 'Как продаётся' })).getByRole('button', { name: 'Опт' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('все товары и в розницу, и оптом — переключателя нет: выбор ничего бы не менял', async () => {
    stubWideScreen();
    stubFetch(withCounts(catalogRules(), { ...COUNTS, retail: 12, wholesale: 12 }));

    renderScreen(<CatalogPage />);
    await screen.findByText('Цемент М400');
    expect(screen.queryByRole('group', { name: 'Как продаётся' })).not.toBeInTheDocument();
  });

  it('у магазина без опта переключателя «Розница / Опт» нет', async () => {
    stubWideScreen();
    stubFetch(withCounts(catalogRules(), { ...COUNTS, retail: 12, wholesale: 0 }));

    renderScreen(<CatalogPage />);
    await screen.findByText('Цемент М400');
    expect(screen.queryByRole('group', { name: 'Как продаётся' })).not.toBeInTheDocument();
  });

  it('на телефоне порядок — одной кнопкой у заголовка, а не чипом (макет К2.2)', async () => {
    const { calls } = stubFetch(withCounts(catalogRules()));

    renderScreen(<CatalogPage />);
    await screen.findByText('Цемент М400');
    expect(screen.queryByRole('button', { name: 'Дешевле' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Сортировка'), 'CHEAPEST');
    await waitFor(() => expect(calls.some((call) => call.url.includes('sort=CHEAPEST'))).toBe(true));
  });

  it('«Сначала со скидкой» — в списке, только пока идёт распродажа', async () => {
    stubWideScreen();
    const { calls } = stubFetch([
      get('/api/portal/promotions', { volumeTiers: [], deals: [], dealCount: 3 }),
      ...withCounts(catalogRules()),
    ]);
    renderScreen(<CatalogPage />);
    await screen.findByText('Цемент М400');

    const wide = screen.getByRole('group', { name: 'Сортировка' });
    await userEvent.click(await within(wide).findByRole('button', { name: 'Со скидкой' }));
    await waitFor(() => expect(calls.some((call) => call.url.includes('sort=DISCOUNT'))).toBe(true));
  });

  it('без распродажи пункта «Сначала со скидкой» нет', async () => {
    stubWideScreen();
    stubFetch([
      get('/api/portal/promotions', { volumeTiers: [], deals: [], dealCount: 0 }),
      ...withCounts(catalogRules()),
    ]);
    renderScreen(<CatalogPage />);
    await screen.findByText('Цемент М400');

    for (const list of screen.getAllByLabelText('Сортировка')) {
      expect(within(list).queryByRole('option', { name: 'Сначала со скидкой' })).not.toBeInTheDocument();
    }
  });

  it('товар «только опт» кладётся минимальным оптовым заказом', async () => {
    const packs = {
      ...CEMENT, unit: 'упаковка', price: 45000,
      terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 5, quantityStep: 1 },
      wholesale: { unit: 'упаковка', packQty: 20, pieceUnit: 'мешок', retail: false, tiers: [{ from: 5, price: 45000 }] },
    };
    const { calls } = stubFetch([...cartServer(emptyCart), ...catalogRules([packs]).slice(0, 2)]);
    renderScreen(<CatalogPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'В корзину — 5 упаковок' }));
    const put = await waitFor(() => {
      const found = calls.find((call) => call.init?.method === 'PUT');
      expect(found).toBeDefined();
      return found!;
    });
    // Витрина считает упаковки, корзина — штуки: 5 упаковок по 20.
    expect(JSON.parse(String(put.init?.body))).toEqual({ quantity: 100 });
  });

  it('метки продавца видны на карточке, а минимум — на кнопке и в запросе', async () => {
    const wine = {
      ...CEMENT,
      id: 'item-9', name: 'Цемент М500', discountPercent: 10, oldPrice: 2800,
      terms: { hit: true, novelty: true, ageRestricted: false, minQuantity: 10 },
    };
    const { calls } = stubFetch(withCounts([...cartServer(cartWith('item-9', 10)), ...catalogRules([wine])]));

    renderScreen(<CatalogPage />);

    expect(await screen.findByText('Хит продаж')).toBeInTheDocument();
    expect(screen.getByText('Новинка')).toBeInTheDocument();
    expect(screen.getByText('−10%')).toBeInTheDocument();
    expect(screen.getByText('Заказ от 10 мешков')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'В корзину — 10 мешков' }));
    const put = await waitFor(() => {
      const found = calls.find((call) => call.init?.method === 'PUT');
      expect(found).toBeDefined();
      return found!;
    });
    expect(JSON.parse(String(put.init?.body))).toEqual({ quantity: 10 });
  });

  it('товар 21+ кладётся только после ответа «Да, мне есть 21 год»', async () => {
    const beer = {
      ...CEMENT, id: 'item-7', name: 'Пиво светлое', unit: 'ящик',
      terms: { hit: false, novelty: false, ageRestricted: true },
    };
    const { calls } = stubFetch(withCounts([
      method('POST', '/api/portal/cart/age-confirmation', { ...emptyCart, ageConfirmed: true }),
      ...cartServer(cartWith('item-7', 1)),
      ...catalogRules([beer]),
    ]));

    renderScreen(<><CatalogPage /><AgeGateDialog /></>);

    expect(await screen.findByText('21+')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'В корзину' }));

    const dialog = await screen.findByRole('dialog', { name: 'Вам уже есть 21 год?' });
    expect(calls.some((call) => call.init?.method === 'PUT')).toBe(false);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Да, мне есть 21 год' }));
    await waitFor(() => expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true));
    expect(calls.some((call) => call.url.includes('age-confirmation'))).toBe(true);
  });

  it('положенное называется уведомлением с кнопкой «Открыть корзину»', async () => {
    stubFetch(withCounts([...cartServer(cartWith('item-1', 1)), ...catalogRules()]));

    renderScreen(<><CatalogPage /><AddedToast /></>);
    await userEvent.click(await screen.findByRole('button', { name: 'В корзину' }));

    // Озвучивает постоянная живая область, а кнопка стоит на видимой плашке.
    expect(await screen.findByRole('status')).toHaveTextContent('Добавлено: Цемент М400');
    expect(screen.getByRole('button', { name: 'Открыть корзину' })).toBeInTheDocument();
    // Взятая позиция — счётчиком с единицей вместо круглой «+».
    expect(await screen.findByLabelText(/^Количество, /)).toHaveValue(1);
  });

  it('единица у счётчика склоняется по числу: «20 мешков»', async () => {
    stubFetch(catalogRules([CEMENT], cartWith('item-1', 20)));
    renderScreen(<CatalogPage />);

    expect(await screen.findByLabelText(/^Количество, /)).toHaveValue(20);
    expect(screen.getByText('мешков')).toBeInTheDocument();
  });

  it('рубрики без товаров свёрнуты в «Пустые разделы» и раскрываются по нажатию', async () => {
    stubFetch(withCounts([
      get('/api/portal/categories', [
        { id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 },
        { id: 'cat-2', name: 'Кровля', sortOrder: 1 },
      ]),
      ...catalogRules(),
    ]));

    renderScreen(<CatalogPage />);

    expect(await screen.findByRole('button', { name: 'Сухие смеси 5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Кровля/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Пустые разделы · 1' }));
    expect(screen.getByRole('button', { name: 'Кровля 0' })).toBeInTheDocument();
  });

  it('«Быстрый заказ» открывается кнопкой', async () => {
    stubWideScreen();
    stubFetch(withCounts(catalogRules()));
    renderScreen(<CatalogPage />);

    expect(screen.queryByLabelText('Быстрый ввод')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Быстрый заказ' }));
    expect(screen.getByLabelText('Быстрый ввод')).toBeInTheDocument();
    // Количество по умолчанию — одна, как в макете: набирать «1» перед
    // каждым «Добавить» не приходится.
    expect(screen.getByLabelText('Количество для быстрого ввода')).toHaveValue(1);
  });

  /** Ставка НДС в подзаголовке — из товаров, и только когда она у всех одна. */
  it('подзаголовок называет общую ставку НДС, а при разных — нет', async () => {
    stubWideScreen();
    stubFetch(catalogRules([CEMENT, SAND]));
    const first = renderScreen(<CatalogPage />);
    expect(await screen.findByText('цены без НДС, НДС 12% прибавится при оформлении; рядом указано — за штуку, мешок или ящик'))
      .toBeInTheDocument();
    first.unmount();
    vi.unstubAllGlobals();

    stubWideScreen();
    stubFetch(catalogRules([CEMENT, { ...SAND, vatRate: 0 }]));
    renderScreen(<CatalogPage />);
    expect(await screen.findByText('Рядом с ценой написано, за что она: за штуку, мешок, ящик.'))
      .toBeInTheDocument();
  });

  it('ответ «нет» ничего не кладёт', async () => {
    const beer = {
      ...CEMENT, id: 'item-7', name: 'Пиво светлое',
      terms: { hit: false, novelty: false, ageRestricted: true },
    };
    const { calls } = stubFetch(withCounts(catalogRules([beer])));

    renderScreen(<><CatalogPage /><AgeGateDialog /></>);
    await userEvent.click(await screen.findByRole('button', { name: 'В корзину' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Нет, вернуться к покупкам' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.some((call) => call.init?.method === 'PUT' || call.init?.method === 'POST')).toBe(false);
  });
});

describe('витрина таблицей', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('без дизайна витрина остаётся карточками', async () => {
    stubFetch([
      get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'СтройБаза' }]),
      ...catalogRules([CEMENT]),
    ]);

    renderScreen(<CatalogPage />);

    expect(await screen.findByTestId('item-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('item-list')).not.toBeInTheDocument();
  });
});

/**
 * Выбор варианта прямо на карточке витрины — макет «Каталог v1»: кружки
 * цветов под названием. Вариант — отдельная позиция продавца, поэтому
 * выбранный кружок меняет на карточке цену и то, что кладёт «В корзину».
 */
describe('выбор варианта на карточке витрины', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const colour = (value: string) => [{ code: 'COLOR', name: 'Цвет', type: 'TEXT', value }];
  const MUG_VARIANTS = [
    { itemId: 'mug-white', price: 1500, stock: 'IN_STOCK', fields: colour('белый') },
    { itemId: 'mug-black', price: 1700, stock: 'IN_STOCK', fields: colour('чёрный') },
  ];
  const MUG = {
    id: 'mug-white',
    name: 'Кружка',
    unit: 'шт',
    price: 1500,
    vatRate: 12,
    stock: 'IN_STOCK',
    colorCount: 2,
    variants: MUG_VARIANTS,
  };

  it('у товара с двумя цветами на карточке группа «Цвет», а у товара без вариантов её нет', async () => {
    stubFetch(catalogRules([MUG, CEMENT]));
    renderScreen(<CatalogPage />);

    const [mug, cement] = await screen.findAllByTestId('item-tile');
    const group = within(mug).getByRole('radiogroup', { name: 'Цвет' });
    const options = within(group).getAllByRole('radio');
    expect(options).toHaveLength(2);
    expect(within(group).getByRole('radio', { name: 'Цвет: белый' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByRole('radio', { name: 'Цвет: чёрный' })).toHaveAttribute('aria-checked', 'false');
    // Кружки уже показывают цвета — метка «2 цвета» их не дублирует.
    expect(within(mug).queryByTestId('colour-count')).not.toBeInTheDocument();
    expect(within(cement).queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('выбор второго цвета меняет цену и ссылку на карточке, не уводя с витрины', async () => {
    stubFetch(catalogRules([MUG]));
    renderScreen(<CatalogPage />);

    const tile = await screen.findByTestId('item-tile');
    expect(tile).toHaveTextContent(/1\s500 ₸/);
    await userEvent.click(within(tile).getByRole('radio', { name: 'Цвет: чёрный' }));

    expect(within(tile).getByRole('radio', { name: 'Цвет: чёрный' })).toHaveAttribute('aria-checked', 'true');
    expect(tile).toHaveTextContent(/1\s700 ₸/);
    expect(tile).not.toHaveTextContent(/1\s500 ₸/);
    expect(within(tile).getByRole('link', { name: 'Кружка' })).toHaveAttribute('href', '/catalog/mug-black');
  });

  it('у выбранного варианта со скидкой — его метка «−N%» и зачёркнутая старая цена', async () => {
    const variants = [
      MUG_VARIANTS[0],
      { ...MUG_VARIANTS[1], price: 1700, oldPrice: 2000, discountPercent: 15 },
    ];
    stubFetch(catalogRules([{ ...MUG, variants }]));
    renderScreen(<CatalogPage />);

    const tile = await screen.findByTestId('item-tile');
    expect(tile).not.toHaveTextContent('−15%');
    await userEvent.click(within(tile).getByRole('radio', { name: 'Цвет: чёрный' }));

    expect(tile).toHaveTextContent('−15%');
    const old = tile.querySelector('s');
    expect(old).not.toBeNull();
    expect(old!.textContent).toMatch(/2\s000 ₸/);

    // Обратно на вариант без скидки — метки и старой цены нет.
    await userEvent.click(within(tile).getByRole('radio', { name: 'Цвет: белый' }));
    expect(tile).not.toHaveTextContent('−15%');
    expect(tile.querySelector('s')).toBeNull();
  });

  it('у выбранного варианта — его свободный остаток «Свободно: N», ноль — серым', async () => {
    const variants = [
      { ...MUG_VARIANTS[0], available: 12 },
      { ...MUG_VARIANTS[1], available: 0 },
    ];
    stubFetch(catalogRules([{ ...MUG, available: 12, variants }]));
    renderScreen(<CatalogPage />);

    const tile = await screen.findByTestId('item-tile');
    expect(within(tile).getByText('Свободно: 12')).toHaveClass('text-in-stock');
    await userEvent.click(within(tile).getByRole('radio', { name: 'Цвет: чёрный' }));

    const zero = within(tile).getByText('Свободно: 0');
    expect(zero).toHaveClass('text-ink-subtle');
    expect(within(tile).queryByText('Свободно: 12')).not.toBeInTheDocument();
  });

  it('у варианта без учёта остатка строки «Свободно» нет', async () => {
    const variants = [
      { ...MUG_VARIANTS[0], available: 12 },
      { ...MUG_VARIANTS[1] },
    ];
    stubFetch(catalogRules([{ ...MUG, available: 12, variants }]));
    renderScreen(<CatalogPage />);

    const tile = await screen.findByTestId('item-tile');
    await userEvent.click(within(tile).getByRole('radio', { name: 'Цвет: чёрный' }));
    expect(within(tile).queryByText(/Свободно/)).not.toBeInTheDocument();
  });

  it('«В корзину» после выбора кладёт позицию выбранного варианта', async () => {
    const { calls } = stubFetch([
      ...cartServer(cartWith('mug-black', 1)),
      get('/api/portal/categories', []),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 1, items: [MUG] }),
    ]);
    renderScreen(<CatalogPage />);

    const tile = await screen.findByTestId('item-tile');
    await userEvent.click(within(tile).getByRole('radio', { name: 'Цвет: чёрный' }));
    await userEvent.click(within(tile).getByRole('button', { name: 'В корзину' }));

    const put = await waitFor(() => {
      const found = calls.find((call) => call.init?.method === 'PUT');
      expect(found).toBeDefined();
      return found!;
    }, { timeout: 3000 });
    expect(put.url).toContain('/api/portal/cart/lines/mug-black');
    // Взятый вариант дальше набирается счётчиком на той же карточке.
    expect(await within(tile).findByLabelText(/^Количество, /)).toHaveValue(1);
  });

  it('плитка шаблона продавца тоже выбирает цвет на месте', async () => {
    stubWideScreen();
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'СтройБаза', design: { template: 'CLASSIC', theme: 'TEMPLATE', published: true } },
      ]),
      ...catalogRules([MUG]),
    ]);
    renderScreen(<CatalogPage />);

    await screen.findByTestId('catalog-designed');
    const tile = await screen.findByTestId('item-tile');
    expect(tile).toHaveAttribute('data-tile');
    await userEvent.click(within(tile).getByRole('radio', { name: 'Цвет: чёрный' }));
    expect(tile).toHaveTextContent(/1\s700/);
    expect(within(tile).getByRole('link', { name: 'Кружка' })).toHaveAttribute('href', '/catalog/mug-black');
  });

  it('фасовка без цвета — кнопками значений, лишние сворачиваются в «+N»', async () => {
    const pack = (value: string) => [{ code: 'PACK', name: 'Фасовка', type: 'TEXT', value }];
    const sizes = ['1 кг', '2 кг', '5 кг', '10 кг', '25 кг', '50 кг', '100 кг'];
    const variants = sizes.map((value, index) => ({
      itemId: `flour-${index}`, price: 1000 * (index + 1), fields: pack(value),
    }));
    stubFetch(catalogRules([{ ...CEMENT, id: 'flour-0', name: 'Мука', price: 1000, variants }]));
    renderScreen(<CatalogPage />);

    const tile = await screen.findByTestId('item-tile');
    const group = within(tile).getByRole('radiogroup', { name: 'Фасовка' });
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    expect(within(group).getByRole('radio', { name: 'Фасовка: 1 кг' })).toHaveTextContent('1 кг');
    expect(within(tile).getByRole('link', { name: /ещё 2/i })).toHaveAttribute('href', '/catalog/flour-0');
  });
});

/**
 * Оценка товара на плитке — как в «Похожих товарах» карточки: звезда,
 * число с одним знаком и «(N)» — сколько отзывов. Без отзывов не пишется
 * ничего: «0» на плитке читался бы как плохая оценка, а не как её отсутствие.
 */
describe('оценка товара на плитке', () => {
  // Плитки шаблонов — тема продавца, а она действует только на компьютере.
  beforeEach(stubWideScreen);
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const RATED = { ...CEMENT, rating: 4.7, reviewCount: 3 };
  const LABEL = 'Оценка 4,7 из 5, 3 отзыва';

  /** Бейдж оценки плитки с позицией: у оценённой он один, у неоценённой его нет. */
  function expectRating(tiles: HTMLElement[]) {
    const rated = tiles.find((tile) => within(tile).queryByRole('link', { name: 'Цемент М400' }));
    const plain = tiles.find((tile) => within(tile).queryByRole('link', { name: 'Песок строительный' }));
    expect(rated).toBeDefined();
    expect(plain).toBeDefined();
    const badge = within(rated!).getByLabelText(LABEL);
    expect(badge).toHaveTextContent('4,7');
    expect(badge).toHaveTextContent('(3)');
    expect(within(plain!).queryByLabelText(/^Оценка/)).not.toBeInTheDocument();
    expect(plain).not.toHaveTextContent('(0)');
  }

  it('обычная плитка показывает «4,7» и «(3)», а у товара без оценки — ничего', async () => {
    stubFetch(catalogRules([RATED, SAND]));
    renderScreen(<CatalogPage />);

    await screen.findByText('Цемент М400');
    expectRating(screen.getAllByTestId('item-tile'));
  });

  /** «Склад» ведёт на «Импульс»: плотные строки — артикул, цена со старой, метки, оценка и кнопка. */
  it('строки «Импульса»: артикул, цена со старой, метки, оценка и кнопка', async () => {
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'СтройБаза', design: { template: 'SKLAD', theme: 'TEMPLATE', published: true } },
      ]),
      ...catalogRules([
        { ...RATED, sku: 'CEM-400', oldPrice: 3000, discountPercent: 17, terms: { hit: true, novelty: false, ageRestricted: false } },
        SAND,
      ]),
    ]);

    renderScreen(<CatalogPage />);

    const rows = (await screen.findAllByTestId('item-tile')).filter((tile) => tile.dataset.tile === 'row');
    expect(rows).toHaveLength(2);
    const cement = rows[0];
    expect(within(cement).getByText('CEM-400')).toHaveClass('font-mono');
    expect(within(cement).getByRole('link', { name: RATED.name })).toBeInTheDocument();
    expect(cement.querySelector('s')).toBeInTheDocument();
    expect(within(cement).getByText('Хит продаж')).toBeInTheDocument();
    expect(within(cement).getByRole('button', { name: /В корзину/ })).toBeInTheDocument();
    expectRating(rows);
  });

  it.each(['CLASSIC', 'ATELIER', 'VITRINA', 'MARKET', 'FARM', 'TECH'])('плитка шаблона %s показывает оценку', async (template) => {
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'СтройБаза', design: { template, theme: 'TEMPLATE', published: true } },
      ]),
      ...catalogRules([RATED, SAND]),
    ]);
    renderScreen(<CatalogPage />);

    await screen.findByTestId('catalog-designed');
    await screen.findAllByTestId('item-tile');
    expectRating(screen.getAllByTestId('item-tile'));
  });

  it.each(['glass', 'tilt', 'float', 'glow', 'jelly', 'outline', 'swap', 'plain'] as const)(
    'характер плитки %s показывает оценку',
    (tile) => {
      stubFetch(catalogRules([]));
      renderScreen(
        <div>
          <TemplateTile item={RATED as never} taken={new Set()} tile={tile} price="plain" />
          <TemplateTile item={SAND as never} taken={new Set()} tile={tile} price="plain" />
        </div>,
      );
      expectRating(screen.getAllByTestId('item-tile'));
    },
  );
});

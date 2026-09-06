import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogPage } from './CatalogPage';
import { ItemThumb } from './ItemThumb';
import { renderScreen } from '../../test/render';
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
 * Монитор: широкая ОБОЛОЧКА.
 *
 * Отвечает за то, где живёт поиск, — в верхней полосе или в самой витрине.
 * Раскладку витрины этот признак больше не выбирает: между окном и витриной
 * стоят колонка разделов и панель корзины, и на 1024 точках окна витрине
 * достаётся меньше четырёхсот.
 */
function stubWideScreen() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('1024'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
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
  it('строка показывает снимок позиции, а заполнитель остаётся позициям без него', async () => {
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

  it('на телефоне поле поиска остаётся и заполняется из адреса', async () => {
    stubFetch(catalogRules());

    renderScreen(<CatalogPage />, { route: '/catalog?q=цемент' });

    expect(await screen.findByLabelText('Поиск по каталогу')).toHaveValue('цемент');
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

  it('количество взятой позиции набирается в строке, без перехода на карточку', async () => {
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

    expect(await screen.findByText('В наличии')).toBeInTheDocument();
    expect(screen.queryByText(/Свободно/)).not.toBeInTheDocument();
  });

  it('сердечко в строке закрашивается сразу и не перезапрашивает каталог', async () => {
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

  it('цена стоит отдельно от единицы, налога и даты', async () => {
    stubFetch(catalogRules());
    renderScreen(<CatalogPage />);

    const row = await screen.findByTestId('item-row');
    // Цена — крупным числом сама по себе, всё остальное — мелкой строкой
    // рядом: в макете это два разных размера, а не одно предложение.
    expect(within(row).getByText('2 500 ₸')).toBeInTheDocument();
    const note = within(row).getByText(/за мешок/);
    expect(note).toHaveTextContent('с НДС 12%');
    // Дата актуальности остаётся: цена без неё превращается в бессрочное
    // обещание, а требование о полноте торговой информации действует и здесь.
    expect(note).toHaveTextContent('29.08');
  });

  it('поиск уходит на сервер, а не фильтрует загруженное', async () => {
    const { calls } = stubFetch(catalogRules());
    renderScreen(<CatalogPage />);
    await screen.findByTestId('item-row');

    await userEvent.type(screen.getByRole('searchbox'), 'қағаз');

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('query=') && call.url.includes('catalog')))
        .toBe(true);
    }, { timeout: 3000 });
  });

  it('наличие показывается словами поставщика, а не числом остатка', async () => {
    stubFetch(catalogRules([{ ...CEMENT, stock: 'UNKNOWN' }]));
    renderScreen(<CatalogPage />);

    // «Наличие уточняется» — не «нет в наличии»: система не знает, что товара
    // нет, она знает, что не может подтвердить.
    expect(await screen.findByText(/наличие уточняется/i)).toBeInTheDocument();
    expect(screen.queryByText(/нет в наличии/i)).not.toBeInTheDocument();
  });

  it('пустой остаток числом не превращается в «Свободно: 0»', async () => {
    // Поставщик показывает наличие флагом: числа остатка в ответе нет, и поле
    // приходит со значением null. Ноль на его месте означал бы «кончилось» —
    // клиент увидел бы отсутствие товара там, где товар есть.
    stubFetch(catalogRules([{ ...CEMENT, stock: 'IN_STOCK', available: null }]));
    renderScreen(<CatalogPage />);

    expect(await screen.findByText(/в наличии/i)).toBeInTheDocument();
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

  it('на телефоне рубрики остаются строкой чипов', async () => {
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 1 }]),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 1, items: [CEMENT] }),
      get('/api/portal/cart', emptyCart),
    ]);
    renderScreen(<CatalogPage />);

    expect(await screen.findByRole('button', { name: 'Всё' })).toHaveAttribute('aria-pressed', 'true');
    // Колонка рубрик на телефоне отняла бы треть экрана у того, кто пришёл
    // за двумя позициями.
    expect(screen.queryByTestId('category-column')).not.toBeInTheDocument();
  });

  /**
   * Ступень в две колонки.
   *
   * При открытом рельсе и панели корзины колонка витрины не бывает шире 812
   * точек — оболочка ограничена 1440, — и три плитки укладывались туда по 170:
   * название в три строки, цена оторвана от единицы.
   */
  it('на неполной ширине плитки встают в две колонки, а не в три', async () => {
    stubWideScreen();
    stubColumnWidth(812);
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 1 }]),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 2, items: [CEMENT, SAND] }),
      get('/api/portal/cart', emptyCart),
    ]);
    renderScreen(<CatalogPage />);

    expect(await screen.findByTestId('item-grid')).toHaveClass('grid-cols-2');
    // Плитки, а не строки: место под них есть, не хватает только третьей.
    expect(screen.getAllByTestId('item-tile')).toHaveLength(2);
    expect(screen.getByTestId('category-column')).toBeInTheDocument();
  });

  /**
   * Планшет: окно широкое, а места нет.
   *
   * На 1024 точках оболочка забирает 232 под разделы и 340 под корзину —
   * витрине остаётся меньше четырёхсот. Раскладка, выбранная по окну,
   * раскладывала там колонку рубрик и три плитки, и плитки схлопывались
   * в полоски по тридцать точек: названия, цены и кнопки обрезались.
   */
  it('на планшете витрина остаётся строками: окно широкое, а колонка узкая', async () => {
    stubWideScreen();
    stubColumnWidth(396);
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 1 }]),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 2, items: [CEMENT, SAND] }),
      get('/api/portal/cart', emptyCart),
    ]);
    renderScreen(<CatalogPage />);

    expect(await screen.findAllByTestId('item-row')).toHaveLength(2);
    expect(screen.queryByTestId('item-grid')).not.toBeInTheDocument();
    // Колонка рубрик отняла бы у витрины ещё 232 точки из четырёхсот.
    expect(screen.queryByTestId('category-column')).not.toBeInTheDocument();
  });

  it('на мониторе витрина становится плитками в три колонки при колонке рубрик', async () => {
    stubWideScreen();
    // Плитки решает не окно, а место: колонка рубрик, три плитки и промежутки.
    // Третья плитка приходит от 978 точек колонки — при сложенном рельсе.
    stubColumnWidth(1040);
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 1 }]),
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 2, items: [CEMENT, SAND] }),
      get('/api/portal/cart', emptyCart),
    ]);
    renderScreen(<CatalogPage />);

    expect(await screen.findByTestId('item-grid')).toHaveClass('grid-cols-3');
    expect(screen.getAllByTestId('item-tile')).toHaveLength(2);
    expect(screen.queryByTestId('item-row')).not.toBeInTheDocument();

    const column = screen.getByTestId('category-column');
    expect(within(column).getByRole('button', { name: 'Всё' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(column).getByRole('button', { name: 'Сухие смеси' }));
    expect(within(column).getByRole('button', { name: 'Сухие смеси' }))
      .toHaveAttribute('aria-pressed', 'true');
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
});

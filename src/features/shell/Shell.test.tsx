import { stubWideScreen } from '../../test/wideScreen';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from './Shell';
import { getGetPortalSuppliersQueryKey } from '../../api/generated';
import { renderScreen, renderWithRealSupplier } from '../../test/render';
import { setCurrentSupplierId } from '../../supplier/supplier';
import { get, method, stubFetch } from '../../test/http';

const emptyCart = { lines: [], total: 0, skipped: [] };

const filledCart = {
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
 * Оболочка ждёт список магазинов: до него шаблон неизвестен, и вместо шапки
 * стоит пустая подложка (см. `Shell` — «пока список магазинов не пришёл»).
 */
async function shown<T>(result: T): Promise<T> {
  // All: в тесте, где оболочку рисуют несколько раз, прежние ещё на месте.
  await screen.findAllByTestId('shell');
  return result;
}

function renderShell(options?: Parameters<typeof renderScreen>[1]) {
  return shown(renderScreen(<Shell />, options));
}

function shellRules(cart: unknown = emptyCart) {
  return [
    // У текущего (supplier-1) число ненулевое и не совпадает с суммой по
    // всем: с фильтром «кроме текущего» выходит 4, без фильтра вышло бы 6.
    // Совпадающие числа не отличили бы «посчитали остальных» от «посчитали
    // всех».
    get('/api/portal/notifications/summary', [
      { supplierId: 'supplier-1', unread: 2 },
      { supplierId: 'supplier-2', unread: 4 },
    ]),
    get('/api/portal/notifications', []),
    get('/api/portal/categories', []),
    get('/api/portal/catalog', { page: 0, size: 50, totalElements: 0, items: [] }),
    get('/api/portal/favorites', []),
    get('/api/portal/questions', []),
    get('/api/portal/reviews/awaiting', []),
    get('/api/portal/reviews', []),
    get('/api/portal/delivery', { mode: 'PICKUP_ONLY', methods: [], pickupPoints: [] }),
    get('/api/portal/suppliers', [
      { supplierId: 'supplier-1', name: 'СтройБаза Алматы', currency: 'KZT' },
      { supplierId: 'supplier-2', name: 'Бумага оптом', currency: 'KZT' },
    ]),
    get('/api/portal/cart', cart),
    get('/api/portal/me', {
      id: 'a1',
      supplierId: 'supplier-1',
      customerId: 'c1',
      phone: '77010000001',
      status: 'ACTIVE',
      service: false,
      customerName: 'Асхат Каримов',
    }),
  ];
}

describe('оболочка кабинета', () => {
  afterEach(() => vi.unstubAllGlobals());


  it('адрес позиции открывает карточку товара, а не возвращает на витрину', async () => {
    stubFetch([
      // Список поставщиков: карточка стоит за `RequireSupplier`, и без него
      // экран честно показал бы сбой списка, а не товар.
      get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'СтройБаза Алматы', currency: 'KZT' }]),
      get('/api/portal/notifications', []),
      // Правило карточки стоит выше правила витрины: совпадение ищется
      // вхождением подстроки, и `/api/portal/catalog` перехватило бы адрес позиции первым.
      get('/api/portal/catalog/item-1', {
        id: 'item-1', name: 'Цемент М400', unit: 'мешок', price: 2500, vatRate: 12, stock: 'IN_STOCK',
        media: [], attributes: [], favorite: false, rating: null, reviewCount: 0, canReview: false,
      }),
      get('/api/portal/items/item-1/reviews', []),
      get('/api/portal/cart', emptyCart),
    ]);

    await renderShell({ route: '/catalog/item-1' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Цемент М400' })).toBeInTheDocument();
  });

  it('знак поставщика стоит в шапке рядом с именем; без знака — одно имя, без заглушки', async () => {
    stubWideScreen();
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'Стройбаза', logoUrl: 'https://cdn.example.kz/sb.png', currency: 'KZT' },
      ]),
      ...shellRules(),
    ]);
    const { unmount } = await renderShell({ route: '/catalog' });
    // Знак рядом с именем — украшение (alt пустой): имя магазина и так написано словами.
    await waitFor(() => expect(within(screen.getByRole('banner')).getByRole('presentation')).toHaveAttribute('src', 'https://cdn.example.kz/sb.png'));
    unmount();

    stubFetch([get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'Стройбаза', currency: 'KZT' }]), ...shellRules()]);
    await renderShell({ route: '/catalog' });
    expect((await screen.findAllByText('Стройбаза')).length).toBeGreaterThan(0);
    expect(screen.queryByAltText('Стройбаза')).not.toBeInTheDocument();
  });

  it('подложка — в цветах, которые выбрал поставщик', async () => {
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'Стройбаза', brandColor: '#1F5C57', background: 'SAND', currency: 'KZT' },
      ]),
      ...shellRules(),
    ]);
    await renderShell({ route: '/catalog' });
    await waitFor(() => expect(document.querySelector('[data-supplier-theme]')?.textContent ?? '').toContain('--color-canvas: #F2EADB;'));
  });

  it('шапка монитора называет магазин и вошедшего, колокольчик на месте', async () => {
    stubWideScreen();
    stubFetch(shellRules());
    await renderShell({ route: '/catalog' });
    const header = screen.getByRole('banner');
    expect(await within(header).findByText('СтройБаза Алматы')).toBeInTheDocument();
    expect(await within(header).findByRole('button', { name: 'Уведомления' })).toBeInTheDocument();
  });

  it('на мониторе одна шапка у всех магазинов: разделы строкой и «Все разделы»', async () => {
    stubWideScreen();
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'СтройБаза Алматы', design: { template: 'NIGHT', theme: 'TEMPLATE', published: true }, currency: 'KZT' },
      ]),
      ...shellRules(),
    ]);

    await renderShell({ route: '/catalog' });

    const bar = await screen.findByTestId('client-bar');
    for (const name of ['Главная', 'Каталог', 'Сообщения', 'Доставка']) {
      expect(within(bar).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(bar).getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar).getByRole('link', { name: 'Все разделы' })).toHaveAttribute('href', '/more');
    // Тёмный шаблон «Ночь» кабинет не перекрашивает и колонку разделов не ставит.
    expect(document.documentElement.dataset.theme).not.toBe('dark');
    expect(screen.queryByTestId('rail')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell')).toHaveAttribute('data-motion', 'lively');
  });

  it('кнопка «Корзина» в шапке показывает число позиций и открывает выдвижную корзину', async () => {
    stubWideScreen();
    stubFetch(shellRules(filledCart));

    await renderShell({ route: '/catalog' });

    const cartButton = within(screen.getByRole('banner')).getByRole('button', { name: /Корзина/ });
    // Как в макете: в шапке — число позиций у слова «Корзина», сумма — в самой корзине.
    await waitFor(() => expect(within(cartButton).getByRole('img', { name: /В корзине 1 позиция/ })).toBeInTheDocument());
    expect(cartButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(cartButton);
    const drawer = await screen.findByRole('dialog', { name: 'Корзина' });
    expect(within(drawer).getByRole('link', { name: /Оформить заявку/ })).toHaveAttribute('href', '/checkout');
  });

  it('на телефоне шапки нет: главные разделы — в нижнем меню', async () => {
    stubFetch(shellRules(filledCart));

    await renderShell({ route: '/catalog' });

    const tabs = screen.getByRole('navigation', { name: 'Главное меню' });
    expect(tabs.className).toContain('lg:hidden');
    expect(within(tabs).getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getAllByRole('link').map((link) => link.textContent?.replace(/\d+$/, '')))
      .toEqual(['Главная', 'Сообщения', 'Каталог', 'Корзина', 'Доставка']);
    // Число в корзине названо словами: голую цифру диктор прочёл бы без смысла.
    expect(await within(tabs).findByLabelText('В корзине 1 позиция')).toBeInTheDocument();
    // «Вариант Б»: у экрана своё «Назад», выход и магазины — во «Всех разделах».
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('на телефоне у «Сообщений» — число непрочитанного', async () => {
    const notification = (id: string) => ({ id, draftId: `draft-${id}`, kind: 'ACCEPTED', createdAt: '2026-09-03T09:00:00Z' });
    stubFetch([get('/api/portal/notifications', [notification('n1'), notification('n2')]), ...shellRules(filledCart)]);
    await renderShell({ route: '/catalog' });
    const tabs = screen.getByRole('navigation', { name: 'Главное меню' });
    expect(await within(tabs).findByLabelText('Непрочитанных: 2')).toBeInTheDocument();
  });

  it('без единой акции строки «Акции и скидки» во «Всех разделах» нет; с акцией — на месте', async () => {
    const none = { volumeTiers: [], deals: [], dealCount: 0 };
    stubFetch([get('/api/portal/promotions', none), ...shellRules(filledCart)]);
    const { unmount } = await renderShell({ route: '/more' });
    await screen.findByRole('heading', { name: 'Все разделы' });
    await waitFor(() => expect(within(screen.getByRole('main')).queryByRole('link', { name: /Акции и скидки/ })).not.toBeInTheDocument());
    unmount();

    stubFetch([
      get('/api/portal/promotions', { ...none, volumeTiers: [{ from: 100000, percent: 5 }] }),
      ...shellRules(filledCart),
    ]);
    await renderShell({ route: '/more' });
    expect(await within(screen.getByRole('main')).findByRole('link', { name: /Акции и скидки/ })).toHaveAttribute('href', '/promotions');
  });

  it('подписи «Работает на Q-Order» нет ни на одной странице (решение владельца 2026-11-05)', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    expect((await screen.findAllByRole('navigation')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Работает на Q-Order')).not.toBeInTheDocument();
  });

  // Разделы грузятся отдельными частями (React.lazy): под нагрузкой полного прогона
  // первая загрузка модуля дольше любого разумного ожидания заголовка, и тест падал
  // то на одном разделе, то на другом. Модули грузятся заранее, со своим запасом,
  // а тест проверяет уже только маршруты — lazy берёт их из кэша модулей.
  beforeAll(() => Promise.all([
    import('../favorites/FavoritesPage'),
    import('../questions/QuestionsPage'),
    import('../reviews/MyReviewsPage'),
    import('../delivery/DeliveryInfoPage'),
  ]), 60_000);

  it('избранное, вопросы, отзывы и доставка открываются как разделы', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/favorites' });
    expect(await screen.findByRole('heading', { name: 'Избранное' }, { timeout: 5000 })).toBeInTheDocument();

    await renderShell({ route: '/questions' });
    expect(await screen.findByRole('heading', { name: 'Вопросы продавцу' }, { timeout: 5000 })).toBeInTheDocument();

    await renderShell({ route: '/reviews' });
    expect(await screen.findByRole('heading', { name: 'Мои отзывы' }, { timeout: 5000 })).toBeInTheDocument();

    await renderShell({ route: '/delivery' });
    expect(await screen.findByRole('heading', { name: 'Доставка и самовывоз' }, { timeout: 15_000 })).toBeInTheDocument();
  }, 30_000);




  it('колонки разделов нет — витрине вся ширина, корзина выдвижная', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    const grid = await screen.findByTestId('shell-grid');
    expect(grid.className).toContain('lg:grid-cols-[minmax(0,1fr)]');
    expect(screen.queryByTestId('rail')).not.toBeInTheDocument();
    // Закрытая корзина в разметке не стоит: витрине достаётся вся ширина.
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument();
  });


  it('на телефоне «Профиль и настройки» (/more) — экран с разделами, языком, темой, шрифтом и выходом', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/more' });

    const main = screen.getByRole('main');
    expect(await within(main).findByRole('button', { name: /Язык интерфейса/ })).toBeInTheDocument();
    expect(within(main).getByRole('button', { name: /Размер шрифта/ })).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: /Шаблоны закупки/ })).toHaveAttribute('href', '/templates');
    expect(within(main).getByRole('heading', { name: 'Все разделы' })).toBeInTheDocument();
    expect(within(main).getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
    // Вкладки «Ещё» внизу нет: экран открывается плиткой «Профиль и настройки» на «Главной».
    const tabs = screen.getByRole('navigation', { name: 'Главное меню' });
    expect(within(tabs).queryByRole('link', { name: 'Все разделы' })).not.toBeInTheDocument();
  });

  it('на «Главной» — «Выйти» значком в баннере магазина', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/home' });

    expect(await within(screen.getByRole('main')).findByRole('button', { name: 'Выйти' })).toBeInTheDocument();
  });

});

/**
 * Мои магазины: у клиента их бывает несколько, и у каждого свой каталог,
 * цены и корзина. Переход стоит на виду — в шапке и первым блоком колонки.
 */
describe('мои магазины', () => {
  afterEach(() => vi.unstubAllGlobals());
  // Окно «Мои магазины» открывает имя магазина в шапке монитора; на телефоне — экран /shops.
  beforeEach(stubWideScreen);

  it('«Другие магазины» в шапке открывает окно со всеми магазинами, само название — нет', async () => {
    stubFetch(shellRules());
    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    await userEvent.click(within(header).getByRole('button', { name: /Другие магазины/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });
    expect(within(dialog).getAllByTestId('shop-row')).toHaveLength(2);
    // Текущий магазин назван словами, а не только рамкой.
    expect(within(dialog).getByText('Вы здесь')).toBeInTheDocument();
  });

  it('переход в другой магазин открывает его витрину и говорит, что произошло', async () => {
    stubFetch(shellRules());
    await renderShell({ route: '/orders', supplierId: 'supplier-1' });

    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    await userEvent.click(within(header).getByRole('button', { name: /Другие магазины/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });
    await userEvent.click(within(dialog).getByRole('button', { name: /^Бумага оптом/ }));

    expect(await screen.findByText('Вы перешли в магазин Бумага оптом')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('dialog', { name: 'Мои магазины' })).not.toBeInTheDocument();
  });

  it('в другом магазине витрина начинается заново: «Все товары» и пустой поиск', async () => {
    stubWideScreen();
    setCurrentSupplierId('supplier-1');
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 1 }]),
      get('/api/portal/catalog', {
        page: 0, size: 50, totalElements: 1,
        items: [{ id: 'item-1', name: 'Цемент М400', unit: 'мешок', price: 2500, favorite: false }],
      }),
      ...shellRules(),
    ]);
    try {
      await shown(renderWithRealSupplier(<Shell />, '/catalog'));

      const rubrics = await screen.findByRole('group', { name: 'Рубрики' });
      await userEvent.click(within(rubrics).getByRole('button', { name: 'Сухие смеси' }));
      expect(within(rubrics).getByRole('button', { name: 'Сухие смеси' })).toHaveAttribute('aria-pressed', 'true');
      const [search] = await screen.findAllByRole('searchbox');
      await userEvent.type(search, 'цемент');
      expect(search).toHaveValue('цемент');

      const header = screen.getByRole('banner');
      await userEvent.click(within(header).getByRole('button', { name: /Другие магазины/ }));
      const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });
      await userEvent.click(within(dialog).getByRole('button', { name: /^Бумага оптом/ }));

      // Другой магазин открывается своей витриной, а не прежней рубрикой.
      expect(await screen.findByRole('heading', { name: /Здравствуйте/ })).toBeInTheDocument();
      screen.queryAllByRole('searchbox')
        .forEach((field) => expect(field).toHaveValue(''));
    } finally {
      setCurrentSupplierId(null);
    }
  });

  // Оба магазина уже в «С новостями и корзиной» — пустого «Остальные по алфавиту» с «Проверьте название» нет.
  it('все магазины выше — раздела «Остальные по алфавиту» нет', async () => {
    stubFetch(shellRules());
    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    await userEvent.click(within(header).getByRole('button', { name: /Другие магазины/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });

    expect(await within(dialog).findByText('С новостями и корзиной')).toBeInTheDocument();
    expect(within(dialog).queryByText('Остальные по алфавиту')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Такого магазина нет/)).not.toBeInTheDocument();
  });

  it('поиск по названию сужает список, а пустой ответ объясняет, что делать', async () => {
    stubFetch(shellRules());
    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    await userEvent.click(within(header).getByRole('button', { name: /Другие магазины/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });

    await userEvent.type(within(dialog).getByRole('searchbox'), 'бумага');
    expect(within(dialog).getAllByTestId('shop-row')).toHaveLength(1);

    await userEvent.clear(within(dialog).getByRole('searchbox'));
    await userEvent.type(within(dialog).getByRole('searchbox'), 'нет такого');
    expect(within(dialog).getByText(/Такого магазина нет в вашем списке/)).toBeInTheDocument();
  });

  /**
   * Чипы вида товаров сужают список, а «Все» его возвращает целиком.
   * <p>
   * Двух разных подписей достаточно, чтобы чипы вообще появились
   * ({@code kinds.length >= 2}); третий магазин с тем же видом, что и первый,
   * показывает, что фильтр оставляет именно группу, а не одного продавца.
   */
  it('чип вида товаров сужает список магазинов, а «Все» возвращает всех', async () => {
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'СтройБаза Алматы', tagline: 'Стройматериалы', currency: 'KZT' },
        { supplierId: 'supplier-2', name: 'Бумага оптом', tagline: 'Стройматериалы', currency: 'KZT' },
        { supplierId: 'supplier-3', name: 'Овощебаза', tagline: 'Продукты', currency: 'KZT' },
      ]),
      ...shellRules(),
    ]);
    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    await userEvent.click(within(header).getByRole('button', { name: /Другие магазины/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });

    await userEvent.click(within(dialog).getByRole('button', { name: /^Продукты/ }));
    expect(within(dialog).getAllByTestId('shop-row')).toHaveLength(1);
    expect(within(dialog).getByText('Овощебаза')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: /^Все\s*\d*$/ }));
    expect(within(dialog).getAllByTestId('shop-row')).toHaveLength(3);
  });

  it('«⋯» закрепляет магазин, и он встаёт в «Закреплённые»', async () => {
    stubFetch(shellRules());
    const dialog = await openShops();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Действия с магазином Бумага оптом' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Закрепить вверху' }));

    expect(within(dialog).getByRole('heading', { name: 'Закреплённые' })).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Закреплён' })).toBeInTheDocument();
  });

  it('скрытый магазин — в свёрнутой группе «Скрытые», а «Вернуть» снимает скрытие', async () => {
    const { calls } = stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'СтройБаза Алматы', currency: 'KZT' },
        { supplierId: 'supplier-2', name: 'Бумага оптом', currency: 'KZT', hidden: true },
      ]),
      method('DELETE', '/api/portal/suppliers/supplier-2/hidden', undefined, 204),
      ...shellRules(),
    ]);
    const dialog = await openShops();

    expect(within(dialog).queryByText('Бумага оптом')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Скрытые · 1' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Действия с магазином Бумага оптом' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Вернуть из скрытых' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'DELETE'
      && call.url.includes('/api/portal/suppliers/supplier-2/hidden'))).toBe(true));
  });

  it('удаление — только после предупреждения «Удалить навсегда»; отказ сервера показан словами', async () => {
    const { calls } = stubFetch([
      method('DELETE', '/api/portal/suppliers/supplier-2', { detail: 'Удалить нельзя: остался непогашенный долг' }, 409),
      ...shellRules(),
    ]);
    const dialog = await openShops();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Действия с магазином Бумага оптом' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить магазин' }));
    expect(screen.getByText('Удалить навсегда?')).toBeInTheDocument();
    expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Удалить навсегда' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Удалить нельзя: остался непогашенный долг');
    expect(calls.some((call) => call.init?.method === 'DELETE' && call.url.includes('confirm=true'))).toBe(true);
  });

  async function openShops() {
    await renderShell({ route: '/catalog' });
    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    await userEvent.click(within(header).getByRole('button', { name: /Другие магазины/ }));
    return screen.findByRole('dialog', { name: 'Мои магазины' });
  }
});

/**
 * У клиента нескольких продавцов — у каждого магазина своя валюта. Провайдер
 * поставщика настоящий: подставленный контекст не хранит выбор, и переход
 * между магазинами доказывал бы только то, что кнопка нажимается, а не то,
 * что сумма в шапке пересчиталась под другой знак.
 */
describe('новости у других поставщиков', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('в шапке стоит точка, а не число', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    expect(await screen.findByLabelText('У других поставщиков есть новости')).toBeInTheDocument();
  });

});

/**
 * Кабинет открывает поставщик — до этого клиенту здесь показывать нечего.
 *
 * Живой случай выглядел так: список поставщиков пуст, а выбранный ранее
 * поставщик остался в хранилище и уходил заголовком в каждом запросе.
 * Клиент видел витрину, которая не грузится, и четыре отказа подряд вместо
 * объяснения. Отказ ничего не объясняет: понять по нему, что нужна ссылка
 * от поставщика, невозможно.
 */
describe('кабинет, который поставщик ещё не открыл', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Правила стоят полным набором нарочно.
   *
   * Заглушка падает на незаявленном запросе, и урезанный набор доказывал бы
   * молчание кабинета случайной ошибкой с невнятным текстом. Проверяется
   * не то, что запрос упал, а то, что он не уходил вовсе — по списку вызовов.
   */
  function noSuppliersRules() {
    return [
      get('/api/portal/suppliers', []),
      ...shellRules(),
    ];
  }

  it('полоса под шапкой красным зовёт за ссылкой активации', async () => {
    stubFetch(noSuppliersRules());

    await renderShell({ route: '/catalog' });

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(/ссылку активации/);
    // Липкая: человек прокручивает страницу, и объяснение, уехавшее вверх,
    // оставляет его наедине с пустым экраном.
    expect(banner.className).toContain('sticky');
    // Красным — тем же токеном, которым кабинет говорит об отказах.
    expect(banner.className).toContain('text-gone');
    // По центру: во всю ширину монитора строка у левого края теряется.
    expect(banner.className).toContain('justify-center');
  });

  it('витрина, заявка и уведомления не уходят в сеть, пока поставщика нет', async () => {
    const { calls } = stubFetch(noSuppliersRules());

    await renderShell({ route: '/catalog' });

    await screen.findByRole('alert');
    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/api/portal/suppliers'))).toBe(true);
    });

    const asked = calls.map((call) => call.url.split('?')[0]);
    expect(asked.some((url) => url.includes('/api/portal/catalog'))).toBe(false);
    expect(asked.some((url) => url.includes('/api/portal/categories'))).toBe(false);
    expect(asked.some((url) => url.includes('/api/portal/cart'))).toBe(false);
    // Сводка непрочитанного кончается тем же путём: сравнение точное,
    // иначе `/notifications/summary` сошло бы за список уведомлений.
    expect(asked.some((url) => url.endsWith('/api/portal/notifications'))).toBe(false);
  });

  it('вместо витрины стоит список поставщиков, а не пустой каталог', async () => {
    stubFetch(noSuppliersRules());

    await renderShell({ route: '/catalog' });

    expect(await screen.findByRole('heading', { name: 'Поставщики' })).toBeInTheDocument();
  });

  it('колокольчик из шапки уходит: новостям взяться неоткуда', async () => {
    stubFetch(noSuppliersRules());

    await renderShell({ route: '/catalog' });

    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /Уведомления/ })).not.toBeInTheDocument();
  });

  it('у клиента с поставщиком полосы нет', async () => {
    stubFetch(shellRules());

    // Ждём именно ответа списка: до него утверждение об отсутствии полосы
    // истинно само по себе и ничего не доказывает.
    const { queryClient } = await renderShell({ route: '/catalog' });
    await waitFor(() => {
      expect(queryClient.getQueryState(getGetPortalSuppliersQueryKey())?.status).toBe('success');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/**
 * Сведения о магазине: адрес, часы, самовывоз, телефон и WhatsApp — то, что
 * продавец заполнил в реквизитах, а не выдуманные ссылки «Доставка»/«Вопросы».
 */

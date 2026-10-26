import { stubWideScreen } from '../../test/wideScreen';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from './Shell';
import { getGetPortalSuppliersQueryKey } from '../../api/generated';
import { renderScreen, renderWithRealSupplier } from '../../test/render';
import { currentSupplierId, setCurrentSupplierId } from '../../supplier/supplier';
import { get, stubFetch } from '../../test/http';

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

  it('на широком экране разделы стоят на виду, а лист остаётся телефону', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    // Постоянная навигация — не копия листа, а тот же список: разойдись они,
    // на телефоне и на мониторе оказались бы разные кабинеты.
    const rail = await screen.findByTestId('rail');
    expect(rail.className).toContain('lg:flex');
    expect(rail.className).toContain('hidden');
    expect(within(rail).getByRole('navigation', { name: 'Разделы кабинета' })).toBeInTheDocument();

    // Лист — телефону: на мониторе та же кнопка складывает колонку,
    // а не выкладывает поверх неё второй такой же список.
    await userEvent.click(screen.getByRole('button', { name: 'Меню' }));
    expect(await screen.findByRole('dialog', { name: 'Меню' })).toBeInTheDocument();
  });

  it('в подвале — «Работает на Q-Order» со ссылкой на страницу подключения', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    expect(await screen.findByRole('link', { name: 'Работает на Q-Order' })).toHaveAttribute('href', '/join');
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

  /**
   * Карточка товара — единственный экран кабинета, который открывают только
   * по ссылке с витрины, а не из списка разделов. Свой тест у неё объявляет
   * маршрут сам, поэтому пропуск маршрута здесь он не заметил бы: ссылка
   * с витрины уходила бы на замыкающий `*` и молча возвращала на витрину.
   */
  it('адрес позиции открывает карточку товара, а не возвращает на витрину', async () => {
    stubFetch([
      // Список поставщиков: карточка стоит за `RequireSupplier`, и без него
      // экран честно показал бы сбой списка, а не товар.
      get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'СтройБаза Алматы', currency: 'KZT' }]),
      get('/api/portal/notifications', []),
      // Правило карточки стоит выше правила витрины: совпадение ищется
      // вхождением подстроки, и `/api/portal/catalog` перехватило бы адрес
      // позиции первым.
      get('/api/portal/catalog/item-1', {
        id: 'item-1',
        name: 'Цемент М400',
        unit: 'мешок',
        price: 2500,
        vatRate: 12,
        stock: 'IN_STOCK',
        media: [],
        attributes: [],
        favorite: false,
        rating: null,
        reviewCount: 0,
        canReview: false,
      }),
      get('/api/portal/items/item-1/reviews', []),
      get('/api/portal/cart', emptyCart),
    ]);

    await renderShell({ route: '/catalog/item-1' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Цемент М400' }))
      .toBeInTheDocument();
  });

  /**
   * Меню разделов выезжает слева, а не снизу.
   *
   * Снизу выезжает то, что относится к текущему экрану — корзина,
   * уведомления. Разделы к экрану не относятся, они его меняют, и приходят
   * с той же стороны, где на мониторе стоит постоянная колонка: одно место
   * навигации на всех ширинах, а не два разных.
   */
  it('меню разделов выезжает слева, а не снизу', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    await userEvent.click(screen.getByRole('button', { name: 'Меню' }));

    const panel = await screen.findByRole('dialog', { name: 'Меню' });
    expect(panel.className).toContain('inset-y-0');
    expect(panel.className).toContain('left-0');
    // Лист корзины и уведомлений остаётся нижним: проверка на то, что
    // сторона задана осознанно, а не сменилась у всех разом.
    expect(panel.className).not.toContain('bottom-0');
  });

  /**
   * Три полоски есть на любой ширине.
   *
   * Кнопка, пропадающая на мониторе, оставляет человека наедине с
   * колонкой, которую нельзя убрать: на 1280 точках она отъедает
   * пятую часть ширины у того, кто пришёл за одной позицией.
   */
  it('кнопка меню есть и на телефоне, и на мониторе', async () => {
    stubWideScreen();
    stubFetch(designRules('SKLAD'));

    await renderShell({ route: '/catalog' });

    const button = await screen.findByRole('button', { name: 'Меню' });
    expect(button.className).not.toContain('lg:hidden');
  });

  /** На телефоне постоянной колонки нет, и та же кнопка открывает лист слева. */
  it('на телефоне кнопка открывает лист разделов слева', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    await userEvent.click(await screen.findByRole('button', { name: 'Меню' }));

    const panel = await screen.findByRole('dialog', { name: 'Меню' });
    expect(panel.className).toContain('left-0');
    expect(panel.className).toContain('inset-y-0');
  });

  /**
   * Знак поставщика стоит рядом с его именем — и только тогда, когда сервер
   * его прислал.
   *
   * Имя при этом не исчезает: знак узнаётся взглядом, а читается имя, и
   * поставщик, у которого знак не загрузился, обязан остаться узнаваемым.
   * Заглушки вместо отсутствующего знака нет — она обещала бы то, чего
   * продавец не давал.
   */
  it('знак поставщика стоит в шапке рядом с именем', async () => {
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'Стройбаза', logoUrl: 'https://cdn.example.kz/sb.png', currency: 'KZT' },
      ]),
      ...shellRules(),
    ]);

    await renderShell({ route: '/catalog' });

    const mark = await screen.findByAltText('Стройбаза');
    expect(mark).toHaveAttribute('src', 'https://cdn.example.kz/sb.png');
    expect(screen.getAllByText('Стройбаза').length).toBeGreaterThan(0);
  });

  /** Цвет шапки и фон подложки выбирает продавец; кабинет клиента их применяет. */
  it('шапка и подложка оформлены так, как выбрал поставщик', async () => {
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'Стройбаза', brandColor: '#1F5C57', background: 'SAND', currency: 'KZT' },
      ]),
      ...shellRules(),
    ]);

    await renderShell({ route: '/catalog' });

    await screen.findAllByText('Стройбаза');
    const css = document.querySelector('[data-supplier-theme]')?.textContent ?? '';
    expect(css).toContain('--color-bar-wide: #EFF4F3;');
    expect(css).toContain('--color-canvas: #F2EADB;');
  });

  it('поставщик без знака показан одним именем, без заглушки', async () => {
    stubFetch([
      get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'Стройбаза', currency: 'KZT' }]),
      ...shellRules(),
    ]);

    await renderShell({ route: '/catalog' });

    expect((await screen.findAllByText('Стройбаза')).length).toBeGreaterThan(0);
    expect(screen.queryByAltText('Стройбаза')).not.toBeInTheDocument();
  });

  it('колокольчик уведомлений стоит в шапке', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    expect(await screen.findByRole('button', { name: 'Уведомления' })).toBeInTheDocument();
  });

  /**
   * Шапка называет поставщика, а не кабинет.
   *
   * Клиент закупается у нескольких: слово «Кабинет» одинаково для всех, и по
   * нему нельзя понять, чей каталог открыт и в чью заявку уходит нажатие
   * «в заявку». Имя поставщика — единственное, что это различает.
   */
  it('шапка называет поставщика, а не кабинет вообще', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    expect(await within(header).findByText('СтройБаза Алматы')).toBeInTheDocument();
  });

  /**
   * Шапка называет и вошедшего.
   *
   * Слева «у кого покупаю», справа «кем вошёл» — вопросы разные, и второй
   * не праздный: на складе один браузер на смену, и заявка, отправленная
   * из-под чужой учётной записи, уходит с чужим адресом доставки.
   */
  it('шапка называет вошедшего по имени, а не безликим кружком', async () => {
    stubWideScreen();
    stubFetch(designRules('SKLAD'));

    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    expect(await within(header).findByRole('link', { name: /Асхат Каримов/ }))
      .toHaveAttribute('href', '/profile');
  });

  /**
   * Знак системы — в подвале выдвижного меню.
   *
   * В шапке телефона его нет намеренно: ширину там оспаривает имя
   * поставщика. Но «чья это система» человек спрашивает — с телефона он
   * попал сюда по присланной ссылке и продукта до этого не видел. Меню
   * и есть место для такого вопроса: открывают его не в спешке, и внизу,
   * после разделов, знак никому не мешает.
   */
  it('в самом низу выдвижного меню стоит знак системы', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    await userEvent.click(screen.getByRole('button', { name: 'Меню' }));
    const menu = await screen.findByRole('dialog', { name: 'Меню' });

    const mark = within(menu).getByTestId('menu-logo');
    const nav = within(menu).getByRole('navigation', { name: 'Разделы' });
    // Именно ниже разделов: знак — подпись под списком, а не десятый его пункт.
    expect(nav.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();

    // Имя системы названо один раз: знак при подписи стоит `decorative`,
    // иначе диктор прочёл бы «Q-Order» дважды подряд.
    expect(within(menu).getAllByText('Q-Order')).toHaveLength(1);
  });

  it('на мониторе кабинет разложен в две колонки: разделы и витрина — корзина выдвижная', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    const grid = await screen.findByTestId('shell-grid');
    expect(grid.className).toContain('lg:grid-cols-[256px_minmax(0,1fr)]');
    // Закрытая корзина в разметке не стоит: витрине достаётся вся ширина.
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument();
  });

  /**
   * Корзина — выдвижной панелью по кнопке в шапке: на кнопке число позиций
   * и сумма, а сама панель закрывается крестиком и «Продолжить покупки».
   */
  it('кнопка «Корзина» в шапке показывает сумму и открывает выдвижную корзину', async () => {
    stubWideScreen();
    stubFetch(shellRules(filledCart));

    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    const cartButton = within(header).getByRole('button', { name: /Корзина/ });
    await waitFor(() => expect(cartButton).toHaveTextContent('2 500 ₸'));
    expect(cartButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(cartButton);
    const drawer = await screen.findByRole('dialog', { name: 'Корзина' });
    expect(within(drawer).getByRole('link', { name: /Оформить заявку/ })).toHaveAttribute('href', '/checkout');

    await userEvent.click(within(drawer).getByRole('button', { name: 'Продолжить покупки' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Корзина' })).not.toBeInTheDocument());

    // На телефоне корзины в шапке нет: итог стоит полосой над нижним меню.
    expect((await screen.findByTestId('cart-bar')).className).toContain('lg:hidden');
  });

  /**
   * Главные разделы на телефоне — нижним меню под большим пальцем. Корзина
   * в шапке — только на мониторе: на телефоне она стоит в этом меню, и
   * второй значок в тесной шапке отнял бы ширину у имени магазина.
   */
  /*
   * Раздел «Акции и скидки» пропадает, когда у магазина не включено ни одной
   * акции: так продавцу обещает предпросмотр его настроек.
   */
  it('без единой акции плитки «Акции» на «Главной» нет; с акцией — на месте', async () => {
    const none = { volumeTiers: [], deals: [], dealCount: 0 };
    stubFetch([get('/api/portal/promotions', none), ...shellRules(filledCart)]);
    const { unmount } = await renderShell({ route: '/home' });
    const sections = await screen.findByRole('region', { name: 'Разделы' });
    await waitFor(() => expect(within(sections).queryByRole('link', { name: 'Акции' })).not.toBeInTheDocument());
    unmount();

    stubFetch([
      get('/api/portal/promotions', { ...none, volumeTiers: [{ from: 100000, percent: 5 }] }),
      ...shellRules(filledCart),
    ]);
    await renderShell({ route: '/home' });
    expect(await within(await screen.findByRole('region', { name: 'Разделы' }))
      .findByRole('link', { name: 'Акции' })).toHaveAttribute('href', '/promotions');
  });

  it('на телефоне главные разделы стоят в нижнем меню, а в шапке корзины нет', async () => {
    stubFetch(shellRules(filledCart));

    await renderShell({ route: '/catalog' });

    const tabs = screen.getByRole('navigation', { name: 'Главное меню' });
    expect(tabs.className).toContain('lg:hidden');
    expect(within(tabs).getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: /Заявки/ })).toHaveAttribute('href', '/orders');
    // Как в макетах «Кабинет клиента 2.0»: «Главная» слева, «Каталог» — по центру.
    expect(within(tabs).getAllByRole('link').map((link) => link.textContent?.replace(/\d+$/, '')))
      .toEqual(['Главная', 'Заявки', 'Каталог', 'Корзина', 'Ещё']);
    expect(within(tabs).getByRole('link', { name: 'Главная' })).toHaveAttribute('href', '/home');
    // Число в корзине названо словами: голую цифру диктор прочёл бы без смысла.
    expect(await within(tabs).findByLabelText('В корзине 1 позиция')).toBeInTheDocument();
    // «Ещё» — экраном, как в макете, а не выдвижным листом.
    expect(within(tabs).getByRole('link', { name: 'Ещё' })).toHaveAttribute('href', '/more');
    expect(within(tabs).getByRole('link', { name: 'Каталог' })).toHaveAttribute('href', '/catalog');
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: /Корзина/ })).not.toBeInTheDocument();
  });

  /**
   * Поиск в шапке — на любой ширине, но в разных местах: на мониторе в строке
   * магазина, на телефоне строкой под шапкой рядом с «Аа», как в макете.
   * Поле витрины убрано: два поля «Поиск» отвечали бы на один вопрос по-разному.
   */
  it('на телефоне шапка по макету К1 у любого магазина: магазин, колокольчик и поиск строкой ниже', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    expect(header).toHaveAttribute('data-testid', 'design-header');
    expect(within(header).getAllByRole('search')).toHaveLength(1);
    // Тема и шрифт — в листе «Ещё», а не в шапке.
    expect(within(header).queryByRole('button', { name: /Размер шрифта/ })).not.toBeInTheDocument();
  });

  it('на телефоне «Ещё» — экран с разделами, языком, темой, шрифтом и выходом', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/more' });

    const main = screen.getByRole('main');
    expect(await within(main).findByRole('button', { name: /Язык интерфейса/ })).toBeInTheDocument();
    expect(within(main).getByRole('button', { name: /Размер шрифта/ })).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: 'Шаблоны закупки' })).toHaveAttribute('href', '/templates');
    expect(within(main).getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Главное меню' });
    expect(within(tabs).getByRole('link', { name: 'Ещё' })).toHaveAttribute('aria-current', 'page');
  });

  it('выбранный раздел назван выбранным, а не только подкрашен', async () => {
    stubFetch(shellRules());

    await renderShell({ route: '/favorites' });

    await userEvent.click(screen.getByRole('button', { name: 'Меню' }));
    const links = await screen.findAllByRole('link', { name: 'Избранное' });
    // Цвет читает не всякий: состояние обязано быть сказано словами.
    expect(links.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
  });
});

/**
 * Мои магазины: у клиента их бывает несколько, и у каждого свой каталог,
 * цены и корзина. Переход стоит на виду — в шапке и первым блоком колонки.
 */
describe('мои магазины', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('кнопка магазина в шапке открывает окно со всеми магазинами', async () => {
    stubFetch(shellRules());
    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    await userEvent.click(within(header).getByRole('button', { name: /СтройБаза Алматы/ }));

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
    await userEvent.click(within(header).getByRole('button', { name: /СтройБаза Алматы/ }));
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
      const [search] = within(screen.getByRole('banner')).getAllByRole('searchbox');
      await userEvent.type(search, 'цемент');
      expect(search).toHaveValue('цемент');

      const header = screen.getByRole('banner');
      await userEvent.click(within(header).getByRole('button', { name: /СтройБаза Алматы/ }));
      const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });
      await userEvent.click(within(dialog).getByRole('button', { name: /^Бумага оптом/ }));

      // Другой магазин открывается своей витриной, а не прежней рубрикой.
      expect(await screen.findByRole('heading', { name: 'Главная' })).toBeInTheDocument();
      within(screen.getByRole('banner')).getAllByRole('searchbox')
        .forEach((field) => expect(field).toHaveValue(''));
    } finally {
      setCurrentSupplierId(null);
    }
  });

  it('поиск по названию сужает список, а пустой ответ объясняет, что делать', async () => {
    stubFetch(shellRules());
    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    await userEvent.click(within(header).getByRole('button', { name: /СтройБаза Алматы/ }));
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
    await userEvent.click(within(header).getByRole('button', { name: /СтройБаза Алматы/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });

    await userEvent.click(within(dialog).getByRole('button', { name: /^Продукты/ }));
    expect(within(dialog).getAllByTestId('shop-row')).toHaveLength(1);
    expect(within(dialog).getByText('Овощебаза')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: /^Все/ }));
    expect(within(dialog).getAllByTestId('shop-row')).toHaveLength(3);
  });

  it('звёздочка закрепляет магазин, и он встаёт в «Закреплённые»', async () => {
    stubFetch(shellRules());
    await renderShell({ route: '/catalog' });

    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    await userEvent.click(within(header).getByRole('button', { name: /СтройБаза Алматы/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });

    const star = within(dialog).getByRole('button', { name: 'Закрепить Бумага оптом' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(star);

    expect(within(dialog).getByRole('heading', { name: 'Закреплённые' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Открепить Бумага оптом' })[0])
      .toHaveAttribute('aria-pressed', 'true');
  });
});

/**
 * У клиента нескольких продавцов — у каждого магазина своя валюта. Провайдер
 * поставщика настоящий: подставленный контекст не хранит выбор, и переход
 * между магазинами доказывал бы только то, что кнопка нажимается, а не то,
 * что сумма в шапке пересчиталась под другой знак.
 */
describe('несколько магазинов — у каждого свой знак валюты', () => {
  afterEach(() => {
    setCurrentSupplierId(null);
    vi.unstubAllGlobals();
  });

  it('корзина в шапке — «₸» у первого магазина, «₽» и без «₸» после перехода во второй', async () => {
    stubWideScreen();
    setCurrentSupplierId('s-1');

    // Тело зависит от того, кто сейчас выбран: `get()` сравнивает только
    // адрес, а магазин уходит заголовком `X-Supplier-Id` — тем же приёмом,
    // что и `suppliersRule` в `RequireSupplier.test.tsx`.
    const cartRule = {
      match: (url: string, init?: RequestInit) =>
        url.includes('/api/portal/cart') && (init?.method ?? 'GET') === 'GET',
      get body() {
        return currentSupplierId() === 's-2'
          ? { lines: [{ ...filledCart.lines[0], total: 9900 }], total: 9900, skipped: [] }
          : filledCart;
      },
    };

    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 's-1', name: 'Стройка', currency: 'KZT' },
        { supplierId: 's-2', name: 'Москва-Опт', currency: 'RUB' },
      ]),
      cartRule,
      ...shellRules(),
    ]);

    await shown(renderWithRealSupplier(<Shell />));

    const header = screen.getByRole('banner');
    await within(header).findByText('Стройка');
    const cartButton = within(header).getByRole('button', { name: /Корзина/ });
    await waitFor(() => expect(cartButton).toHaveTextContent('₸'));

    await userEvent.click(within(header).getByRole('button', { name: /Стройка/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });
    await userEvent.click(within(dialog).getByRole('button', { name: /^Москва-Опт/ }));

    // Переходный кадр: сразу после выбора нет ни прежнего знака, ни прежней
    // суммы под новым знаком.
    expect(document.body).not.toHaveTextContent('₸');
    expect(document.body).not.toHaveTextContent(/12\s500\s₽/);

    const headerAfter = await screen.findByRole('banner');
    const cartButtonAfter = await within(headerAfter).findByRole('button', { name: /Корзина/ });
    await waitFor(() => expect(cartButtonAfter).toHaveTextContent('9 900 ₽'));
    expect(cartButtonAfter).not.toHaveTextContent('₸');
  });
});

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
describe('сведения о магазине', () => {
  afterEach(() => vi.unstubAllGlobals());

  const shopCard = {
    supplierId: 'supplier-1', name: 'ИП «Мухамедиева»', tagline: 'Магазин одежды', currency: 'KZT',
    address: 'Барахолка «Кенжехан-2»', phone: '+7 701 000 00 01', whatsapp: '87010000001',
    rating: 4.7, reviewCount: 12, design: { template: 'SKLAD', theme: 'TEMPLATE', published: true },
    hours: { timezone: 'Asia/Almaty', exceptions: [], days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, closed: false, opensAt: '07:00', closesAt: '17:00' })) },
  };

  it('без контактов пунктов нет, а колонка называет, в каком вы магазине', async () => {
    stubFetch(shellRules());   // поставщики без address/phone/whatsapp
    await renderShell({ route: '/catalog' });
    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    expect(within(header).queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
    const rail = screen.getByTestId('rail');
    expect(within(rail).getByText('Вы сейчас в')).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Все мои магазины/ })).toBeInTheDocument();
  });

  it('закрытый сегодня магазин предупреждает, что заявки всё равно принимаются', async () => {
    stubWideScreen();
    const closed = { ...shopCard, hours: { timezone: 'Asia/Almaty', exceptions: [], days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, closed: true })) } };
    stubFetch([get('/api/portal/suppliers', [closed]), ...shellRules()]);
    await renderShell({ route: '/catalog' });
    expect(await within(screen.getByRole('banner'))
      .findByText('Сегодня закрыто — заявки принимаются, обработаем в ближайший рабочий день')).toBeInTheDocument();
  });
});

/** Правила оболочки с опубликованным дизайном поставщика — первым правилом, чтобы перекрыть обычный список. */
function designRules(template: string, theme: 'TEMPLATE' | 'LIGHT' | 'DARK' = 'TEMPLATE') {
  return [
    get('/api/portal/suppliers', [
      { supplierId: 'supplier-1', name: 'СтройБаза Алматы', design: { template, theme, published: true }, currency: 'KZT' },
      { supplierId: 'supplier-2', name: 'Бумага оптом', currency: 'KZT' },
    ]),
    ...shellRules(),
  ];
}

describe('раскладка оболочки по шаблону продавца', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('уровень движения — атрибутом на оболочке: по умолчанию «живо»', async () => {
    stubFetch(designRules('CLASSIC'));
    await renderShell({ route: '/catalog' });
    expect(await screen.findByTestId('shell')).toHaveAttribute('data-motion', 'lively');
  });

  it('«ярко» продавца — на витрине ярко, на странице заказов не выше «живо»', async () => {
    stubWideScreen();
    const vivid = [
      get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'СтройБаза Алматы', currency: 'KZT',
        design: { template: 'CLASSIC', theme: 'TEMPLATE', published: true, motion: 'VIVID' } }]),
      ...shellRules(),
    ];
    stubFetch(vivid);
    const { unmount } = await renderShell({ route: '/catalog' });
    expect(await screen.findByTestId('shell')).toHaveAttribute('data-motion', 'vivid');
    unmount();

    stubFetch(vivid);
    await renderShell({ route: '/orders' });
    expect(await screen.findByTestId('shell')).toHaveAttribute('data-motion', 'lively');
  });

  /** «Витрина»: меню разделов строкой под шапкой, колонки слева нет. */
  it('меню сверху — строкой под шапкой вместо колонки', async () => {
    stubWideScreen();
    stubFetch(designRules('VITRINA'));

    await renderShell({ route: '/catalog' });

    const top = await screen.findByTestId('top-nav');
    expect(within(top).getByRole('link', { name: 'Каталог товаров' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByTestId('rail')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell-grid')).toHaveAttribute('data-layout', 'top');

    // Редкие разделы — за «Ещё»: лист открывается и на мониторе.
    await userEvent.click(within(top).getByRole('button', { name: /^Ещё/ }));
    expect(await screen.findByRole('dialog', { name: 'Меню' })).toBeInTheDocument();
  });

  it('у «Как приложение» нижнее меню только на телефоне', async () => {
    stubWideScreen();
    stubFetch(designRules('APP'));

    await renderShell({ route: '/catalog' });

    const bottom = await screen.findByRole('navigation', { name: 'Главное меню' });
    await waitFor(() => expect(screen.getByTestId('shell-grid')).toHaveAttribute('data-layout', 'bottom'));
    expect(bottom.className).toContain('lg:hidden');
    expect(await screen.findByTestId('top-nav')).toBeInTheDocument();
    expect(screen.queryByTestId('rail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('slim-rail')).not.toBeInTheDocument();
  });

  /** Без опубликованного дизайна на мониторе — панель макета ПК-К, нижнее меню только на телефоне. */
  it('без дизайна на мониторе — панель макета ПК-К вместо колонки разделов', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    await renderShell({ route: '/catalog' });

    // ПК-К: одна панель сверху, разделы в ней строкой, колонки слева нет.
    const bar = await screen.findByTestId('client-bar');
    expect(within(bar).getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar).getByRole('link', { name: 'Ещё' })).toHaveAttribute('href', '/more');
    expect(screen.queryByTestId('rail')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Главное меню' }).className).toContain('lg:hidden');
  });

  /** «Ночь» тёмная по умолчанию — у покупателя, который тему сам не выбирал. */
  it('тёмный шаблон открывает кабинет в тёмной теме', async () => {
    stubWideScreen();
    stubFetch(designRules('NIGHT'));

    await renderShell({ route: '/catalog' });

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    // Оттенки тёмной темы — в таблице стилей поставщика.
    expect(document.querySelector('style[data-supplier-theme]')?.textContent).toContain("html[data-theme='dark']");
  });

  it('выбор покупателя главнее тёмного шаблона', async () => {
    stubWideScreen();
    window.localStorage.setItem('q-order.portal.theme', 'light');
    stubFetch(designRules('NIGHT'));

    await renderShell({ route: '/catalog' });

    await screen.findByTestId('shell-grid');
    await waitFor(() => expect(window.localStorage.getItem('q-order.portal.theme-default')).toBe('dark'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

/**
 * Шапка шаблона продавца — по макету: одна панель (знак, имя с адресом
 * и телефоном, поиск, корзина с суммой, чип вошедшего) и мягкая полоса
 * графика под ней. Без опубликованного дизайна — прежняя шапка.
 */
describe('шапка с опубликованным дизайном', () => {
  afterEach(() => vi.unstubAllGlobals());

  const closedShop = {
    supplierId: 'supplier-1', name: 'ИП «Мухамедиева»', currency: 'KZT',
    address: 'Кенжехан-2', phone: '+7 778 622 65 23', whatsapp: '87786226523',
    hours: { timezone: 'Asia/Almaty', exceptions: [], days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, closed: true })) },
    // «Призма» — меню колонкой слева, как у прежней «Классики».
    design: { template: 'PRISM', theme: 'LIGHT', published: true },
  };

  /** Праздник продавца — плашкой под шапкой, только в его дни. */
  it('в дни праздника под шапкой поздравление', async () => {
    const day = (shift: number) => new Date(Date.now() + shift * 86_400_000).toISOString().slice(0, 10);
    stubWideScreen();
    stubFetch([get('/api/portal/suppliers', [{
      ...closedShop,
      design: { ...closedShop.design, occasion: 'NAURYZ', occasionFrom: day(-2), occasionUntil: day(2) },
    }]), ...shellRules(filledCart)]);

    await renderShell({ route: '/catalog' });

    expect(await screen.findByText('С праздником Наурыз!')).toBeInTheDocument();
  });

  it('одна панель: знак, имя со «Сменить магазин · N», поиск, корзина с числом и суммой, чип вошедшего', async () => {
    stubWideScreen();
    stubFetch([get('/api/portal/suppliers', [closedShop]), ...shellRules(filledCart)]);

    await renderShell({ route: '/catalog' });

    const header = await screen.findByTestId('design-header');
    expect(header).toBe(screen.getByRole('banner'));
    // Под именем — «Сменить магазин · N», как в макете; N — число магазинов покупателя.
    expect(await within(header).findByText('Сменить магазин · 1')).toBeInTheDocument();
    // Фирменной полосы прежней шапки нет: панель — на цвете панели.
    expect(header.querySelector('.bg-strip')).toBeNull();
    expect(header.firstElementChild?.className).toContain('bg-surface');

    const [search] = within(header).getAllByRole('search');
    expect(search.className).toContain('bg-canvas');
    expect(search.className).toContain('flex-1');

    const cart = within(header).getByRole('button', { name: /Корзина/ });
    await waitFor(() => expect(cart).toHaveTextContent('12 500'));
    expect(within(cart).getByText(/В корзине 1 позиция/)).toBeInTheDocument();
    // Число позиций — видимым кружком рядом с суммой.
    expect(within(cart).getByTestId('header-cart-count')).toHaveTextContent('1');

    expect(await within(header).findByRole('link', { name: /Асхат Каримов/ })).toHaveAttribute('href', '/profile');

    // Второстепенное не пропало: язык, тема, шрифт, уведомления, магазины.
    // Язык и шрифт — в строке статуса над панелью, как в макете.
    const status = screen.getByTestId('shop-status');
    expect(within(status).getByRole('button', { name: /Язык интерфейса/ })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Тёмная тема' })).toBeInTheDocument();
    expect(within(status).getByRole('button', { name: /Размер шрифта/ })).toBeInTheDocument();
    // Адрес ушёл из-под имени, но не пропал: он в строке статуса.
    expect(within(status).getByRole('link', { name: /Кенжехан-2/ })).toHaveAttribute('href', '/delivery');
    expect(within(header).getByRole('button', { name: 'Уведомления' })).toBeInTheDocument();
    await userEvent.click(within(header).getByRole('button', { name: /ИП «Мухамедиева»/ }));
    expect(await screen.findByRole('dialog', { name: 'Мои магазины' })).toBeInTheDocument();
  });

  it('под панелью — полоса графика: закрыто сегодня, звонок и WhatsApp', async () => {
    stubWideScreen();
    stubFetch([get('/api/portal/suppliers', [closedShop]), ...shellRules()]);

    await renderShell({ route: '/catalog' });

    const status = await screen.findByTestId('shop-status');
    expect(status.className).toContain('bg-accent-soft');
    expect(status.className).toContain('text-accent-ink');
    expect(await within(status)
      .findByText('Сегодня закрыто — заявки принимаются, обработаем в ближайший рабочий день')).toBeInTheDocument();
    expect(within(status).getByRole('link', { name: /\+7 778 622 65 23/ })).toHaveAttribute('href', 'tel:+77786226523');
    expect(within(status).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/77786226523');
    // На телефоне полосы нет — график коротко стоит под именем магазина.
    expect(status.className).toContain('hidden');
    expect(screen.getByText('Сегодня закрыто · заявки принимаются')).toBeInTheDocument();
  });

  /** Часы магазина 9:00–18:00 по Алматы; подменяется только `Date` — таймеры и промисы идут как обычно. */
  function openShopAt(moment: string) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(moment));
    const open = {
      ...closedShop,
      hours: { timezone: 'Asia/Almaty', exceptions: [], days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, closed: false, opensAt: '09:00', closesAt: '18:00' })) },
    };
    stubFetch([get('/api/portal/suppliers', [open]), ...shellRules()]);
  }

  it('днём — зелёная точка и «Открыто до 18:00»', async () => {
    stubWideScreen();
    openShopAt('2026-09-24T12:00:00+05:00');
    try {
      await renderShell({ route: '/catalog' });

      const status = await screen.findByTestId('shop-status');
      expect(await within(status).findByText('Открыто до 18:00 — заявки обработаем сегодня')).toBeInTheDocument();
      expect(status.querySelector('.bg-in-stock')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('вечером — янтарная точка и «Уже закрыто»', async () => {
    stubWideScreen();
    openShopAt('2026-09-24T20:00:00+05:00');
    try {
      await renderShell({ route: '/catalog' });

      const status = await screen.findByTestId('shop-status');
      expect(await within(status)
        .findByText('Уже закрыто — заявки принимаются, обработаем в ближайший рабочий день')).toBeInTheDocument();
      expect(status.querySelector('.bg-unclear')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('колонка шаблона — 232 точки, выбранный пункт мягкой подложкой', async () => {
    stubWideScreen();
    stubFetch([get('/api/portal/suppliers', [closedShop]), ...shellRules()]);

    await renderShell({ route: '/catalog' });

    const rail = await screen.findByTestId('rail');
    await waitFor(() => expect(screen.getByTestId('shell-grid').className).toContain('lg:grid-cols-[232px_minmax(0,1fr)]'));
    const active = within(rail).getByRole('link', { name: 'Каталог товаров' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.className).toContain('bg-accent-soft');
    expect(within(rail).getByText('Вы сейчас в')).toBeInTheDocument();
  });

  it('«нижнее меню» тоже получает строку разделов под шапкой', async () => {
    stubWideScreen();
    stubFetch(designRules('APP'));

    await renderShell({ route: '/catalog' });

    const header = await screen.findByTestId('design-header');
    expect(await within(header).findByTestId('top-nav')).toBeInTheDocument();
  });

  /** У колокольчика шаблона — точка, как в макете; число остаётся в имени кнопки. */
  it('колокольчик — точкой, а число новых — в имени кнопки', async () => {
    stubWideScreen();
    const notification = (id: string) => ({ id, draftId: `draft-${id}`, kind: 'ACCEPTED', createdAt: '2026-09-03T09:00:00Z' });
    stubFetch([
      get('/api/portal/suppliers', [closedShop]),
      get('/api/portal/notifications/summary', []),
      get('/api/portal/notifications', [notification('n1'), notification('n2'), notification('n3')]),
      ...shellRules(),
    ]);

    await renderShell({ route: '/catalog' });

    const header = await screen.findByTestId('design-header');
    const bell = await within(header).findByRole('button', { name: 'Уведомления: 3 новых' });
    expect(within(bell).getByTestId('notifications-dot')).toBeInTheDocument();
    expect(within(bell).queryByTestId('notifications-count')).not.toBeInTheDocument();
    expect(bell).not.toHaveTextContent('3');
  });

  /** Язык и шрифт — справа в строке статуса: «RU | Aa Обычный шрифт», как в макете. */
  it('в строке статуса — язык и «Aa Обычный шрифт»', async () => {
    stubWideScreen();
    stubFetch([get('/api/portal/suppliers', [closedShop]), ...shellRules()]);

    await renderShell({ route: '/catalog' });

    const settings = await screen.findByTestId('status-settings');
    expect(within(settings).getByRole('button', { name: /Язык интерфейса/ })).toBeInTheDocument();
    const font = within(settings).getByRole('button', { name: 'Размер шрифта: Обычный шрифт' });
    expect(font).toHaveTextContent('Обычный шрифт');
    // В меню ступени названы как прежде — одним словом.
    await userEvent.click(font);
    expect(await screen.findByRole('menuitemradio', { name: 'Обычный' })).toBeInTheDocument();
    // Из панели шапки переключатели ушли — не стоят дважды.
    expect(within(screen.getByTestId('header-settings')).queryByRole('button', { name: /Язык интерфейса/ })).toBeNull();
  });

  it('без дизайна шапка — панель макета ПК-К', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    const { queryClient } = await renderShell({ route: '/catalog' });
    await waitFor(() => {
      expect(queryClient.getQueryState(getGetPortalSuppliersQueryKey())?.status).toBe('success');
    });
    expect(screen.queryByTestId('design-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shop-status')).not.toBeInTheDocument();
    expect(screen.getByTestId('client-bar')).toBeInTheDocument();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from './Shell';
import { getGetPortalSuppliersQueryKey, getGetPortalUnreadSummaryQueryKey } from '../../api/generated';
import { renderScreen, renderWithRealSupplier } from '../../test/render';
import { currentSupplierId, setCurrentSupplierId } from '../../supplier/supplier';
import { rememberVisit, togglePin } from '../../supplier/shopMemory';
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

/**
 * Монитор.
 *
 * Оболочка спрашивает ширину у браузера, а не прячет вторую раскладку
 * классами: разделы не должны стоять в дереве дважды.
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

describe('оболочка кабинета', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('на широком экране разделы стоят на виду, а лист остаётся телефону', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

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

  it('избранное, вопросы, отзывы и доставка открываются как разделы', async () => {
    // Разделы грузятся отдельными частями (React.lazy): при полном прогоне
    // первая загрузка модуля под нагрузкой дольше секунды поиска по умолчанию.
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/favorites' });
    expect(await screen.findByRole('heading', { name: 'Избранное' }, { timeout: 5000 })).toBeInTheDocument();

    renderScreen(<Shell />, { route: '/questions' });
    expect(await screen.findByRole('heading', { name: 'Вопросы продавцу' }, { timeout: 5000 })).toBeInTheDocument();

    renderScreen(<Shell />, { route: '/reviews' });
    expect(await screen.findByRole('heading', { name: 'Мои отзывы' }, { timeout: 5000 })).toBeInTheDocument();

    renderScreen(<Shell />, { route: '/delivery' });
    expect(await screen.findByRole('heading', { name: 'Доставка и самовывоз' }, { timeout: 15_000 })).toBeInTheDocument();
  }, 30_000);

  /** У «Избранного» в колонке — число отложенного, как у «Корзины». */
  it('у «Избранного» в колонке стоит число избранных', async () => {
    stubWideScreen();
    stubFetch([
      get('/api/portal/favorites', [
        { itemId: 'item-1', name: 'Цемент М400', unit: 'мешок', price: 2500, available: true },
        { itemId: 'item-2', name: 'Песок', unit: 'м³', price: 12000, available: true },
      ]),
      ...shellRules(),
    ]);

    renderScreen(<Shell />, { route: '/catalog' });

    const rail = await screen.findByRole('navigation', { name: 'Разделы кабинета' });
    const favorites = within(rail).getByRole('link', { name: /Избранное/ });
    const badge = await within(favorites).findByRole('img', { name: 'В избранном: 2' });
    expect(badge).toHaveTextContent('2');
  });

  /** Редкие разделы спрятаны под «Ещё» — и раскрываются по нажатию. */
  it('раздел «Мои отзывы» стоит в списке разделов под «Ещё»', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const rail = await screen.findByRole('navigation', { name: 'Разделы кабинета' });
    expect(within(rail).queryByRole('link', { name: 'Мои отзывы' })).not.toBeInTheDocument();
    await userEvent.click(within(rail).getByRole('button', { name: 'Ещё' }));
    expect(within(rail).getByRole('link', { name: 'Мои отзывы' })).toHaveAttribute(
      'href',
      '/reviews',
    );
  });

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

    renderScreen(<Shell />, { route: '/catalog/item-1' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const button = await screen.findByRole('button', { name: 'Меню' });
    expect(button.className).not.toContain('lg:hidden');
  });

  /**
   * На мониторе кнопка складывает постоянную колонку, а не открывает лист
   * поверх неё: лист, выехавший слева поверх точно такого же списка слева,
   * читается как поломка, а не как меню.
   */
  it('на мониторе кнопка складывает и разворачивает колонку разделов', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    expect(await screen.findByRole('navigation', { name: 'Разделы кабинета' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Меню' }));
    expect(screen.queryByRole('navigation', { name: 'Разделы кабинета' })).not.toBeInTheDocument();
    // Лист поверх сложенной колонки не выезжает: разделы вернутся тем же
    // нажатием, а не вторым механизмом.
    expect(screen.queryByRole('dialog', { name: 'Меню' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Меню' }));
    expect(await screen.findByRole('navigation', { name: 'Разделы кабинета' })).toBeInTheDocument();
  });

  /** На телефоне постоянной колонки нет, и та же кнопка открывает лист слева. */
  it('на телефоне кнопка открывает лист разделов слева', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

    expect((await screen.findAllByText('Стройбаза')).length).toBeGreaterThan(0);
    expect(screen.queryByAltText('Стройбаза')).not.toBeInTheDocument();
  });

  it('колокольчик уведомлений стоит в шапке', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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

  /**
   * Тот же знак — и в постоянной колонке.
   *
   * Колонка на мониторе и лист на телефоне показывают один и тот же список
   * разделов, и заканчиваться они обязаны одинаково: знак, стоящий только
   * в одном из двух, читается как разница между кабинетами, а не между
   * ширинами экрана.
   */
  it('в самом низу колонки разделов стоит знак системы', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const rail = await screen.findByTestId('rail');
    await userEvent.click(within(rail).getByRole('button', { name: 'Ещё' }));
    const mark = within(rail).getByTestId('rail-logo');
    // Ниже разделов, а не десятым пунктом среди них.
    const last = within(rail).getByRole('link', { name: /Поставщики/ });
    expect(last.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();

    expect(within(rail).getAllByText('Q-Order')).toHaveLength(1);
  });

  it('на мониторе кабинет разложен в две колонки: разделы и витрина — корзина выдвижная', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

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
    stubFetch(shellRules(filledCart));

    renderScreen(<Shell />, { route: '/catalog' });

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
    expect(cartButton.className).toContain('lg:flex');
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
  it('без единой акции «Акции» пропадают из меню; с акцией — на месте', async () => {
    const none = { volumeTiers: [], deals: [], dealCount: 0 };
    stubFetch([get('/api/portal/promotions', none), ...shellRules(filledCart)]);
    const { unmount } = renderScreen(<Shell />, { route: '/catalog' });
    const tabs = screen.getByRole('navigation', { name: 'Главное меню' });
    await waitFor(() => expect(within(tabs).queryByRole('link', { name: 'Акции' })).not.toBeInTheDocument());
    unmount();

    stubFetch([
      get('/api/portal/promotions', { ...none, volumeTiers: [{ from: 100000, percent: 5 }] }),
      ...shellRules(filledCart),
    ]);
    renderScreen(<Shell />, { route: '/catalog' });
    expect(await within(screen.getByRole('navigation', { name: 'Главное меню' }))
      .findByRole('link', { name: 'Акции' })).toHaveAttribute('href', '/promotions');
  });

  it('на телефоне главные разделы стоят в нижнем меню, а корзина в шапке — только на мониторе', async () => {
    stubFetch(shellRules(filledCart));

    renderScreen(<Shell />, { route: '/catalog' });

    const tabs = screen.getByRole('navigation', { name: 'Главное меню' });
    expect(tabs.className).toContain('lg:hidden');
    expect(within(tabs).getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: /Заявки/ })).toHaveAttribute('href', '/orders');
    // Как в макете: Каталог, Акции, Корзина, Заявки — и «Ещё».
    expect(within(tabs).getAllByRole('link').map((link) => link.textContent?.replace(/\d+$/, '')))
      .toEqual(['Каталог', 'Акции', 'Корзина', 'Заявки']);
    expect(within(tabs).getByRole('link', { name: 'Акции' })).toHaveAttribute('href', '/promotions');
    // Число в корзине названо словами: голую цифру диктор прочёл бы без смысла.
    expect(await within(tabs).findByLabelText('В корзине 1 позиция')).toBeInTheDocument();
    expect(within(tabs).getByRole('button', { name: 'Ещё' })).toBeInTheDocument();

    const header = screen.getByRole('banner');
    const cart = within(header).getByRole('button', { name: /Корзина/ });
    expect(cart.className).toContain('hidden');
    expect(cart.className).toContain('lg:flex');
  });

  /**
   * Поиск в шапке — на любой ширине, но в разных местах: на мониторе в строке
   * магазина, на телефоне строкой под шапкой рядом с «Аа», как в макете.
   * Поле витрины убрано: два поля «Поиск» отвечали бы на один вопрос по-разному.
   */
  it('поиск стоит в шапке: на мониторе в строке магазина, на телефоне строкой под ней', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const [wide, phone] = within(screen.getByRole('banner')).getAllByRole('search');
    expect(wide.className).toContain('hidden');
    expect(wide.className).toContain('lg:flex');
    expect(phone.parentElement?.className).toContain('lg:hidden');
    expect(within(phone.parentElement as HTMLElement).getByRole('button', { name: /Размер шрифта/ })).toBeInTheDocument();
  });

  /**
   * Переключатель языка стоит в шапке рядом с плашкой вошедшего — на
   * мониторе. На телефоне от плашки остаётся один кружок с инициалами, а сама
   * шапка занята именем поставщика и значками: переключатель отнял бы ширину
   * у имени, ради которого шапку и переделывали. Там он стоит первой строкой
   * выдвижного меню — язык меняют один раз, ради него разумно открыть меню.
   */
  it('переключатель языка стоит в шапке и в выдвижном меню', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const header = screen.getByRole('banner');
    const inHeader = within(header).getByRole('button', { name: /Язык интерфейса/ });
    expect(inHeader).toBeInTheDocument();
    // В шапке — только на мониторе: на телефоне он стоял бы дважды, здесь
    // и в меню, и отнимал бы ширину у имени поставщика.
    expect(inHeader.closest('.hidden')?.className).toContain('lg:block');

    await userEvent.click(within(header).getByRole('button', { name: 'Меню' }));
    const menu = await screen.findByRole('dialog', { name: 'Меню' });
    expect(within(menu).getByRole('button', { name: /Язык интерфейса/ }))
      .toBeInTheDocument();
  });

  it('выбранный раздел назван выбранным, а не только подкрашен', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/favorites' });

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
    renderScreen(<Shell />, { route: '/catalog' });

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
    renderScreen(<Shell />, { route: '/orders', supplierId: 'supplier-1' });

    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    await userEvent.click(within(header).getByRole('button', { name: /СтройБаза Алматы/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Мои магазины' });
    await userEvent.click(within(dialog).getByRole('button', { name: /^Бумага оптом/ }));

    expect(await screen.findByText('Вы перешли в магазин Бумага оптом')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('dialog', { name: 'Мои магазины' })).not.toBeInTheDocument();
  });

  it('в другом магазине витрина начинается заново: «Все товары» и пустой поиск', async () => {
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
      renderWithRealSupplier(<Shell />);

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

      const fresh = await screen.findByRole('group', { name: 'Рубрики' });
      expect(await within(fresh).findByRole('button', { name: 'Все товары' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(fresh).getByRole('button', { name: 'Сухие смеси' })).toHaveAttribute('aria-pressed', 'false');
      within(screen.getByRole('banner')).getAllByRole('searchbox')
        .forEach((field) => expect(field).toHaveValue(''));
    } finally {
      setCurrentSupplierId(null);
    }
  });

  it('поиск по названию сужает список, а пустой ответ объясняет, что делать', async () => {
    stubFetch(shellRules());
    renderScreen(<Shell />, { route: '/catalog' });

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
    renderScreen(<Shell />, { route: '/catalog' });

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

  /**
   * Блок «Мои магазины» — в колонке под карточкой «Вы сейчас в».
   * <p>
   * «Все мои магазины» и приглашения уже стоят в карточке над ним: второй
   * такой же кнопки в блоке нет, иначе в колонке две одинаковые ссылки подряд.
   */
  it('блок «Мои магазины» стоит в колонке под «Вы сейчас в», без второй кнопки «Все мои магазины»', async () => {
    stubWideScreen();
    rememberVisit('supplier-2');
    stubFetch(shellRules());
    renderScreen(<Shell />, { route: '/catalog', supplierId: 'supplier-1' });

    const rail = await screen.findByTestId('rail');
    const block = await within(rail).findByRole('region', { name: 'Мои магазины' });
    expect(within(block).getByRole('button', { name: /Бумага оптом/ })).toBeInTheDocument();
    expect(within(block).queryByRole('button', { name: /Все мои магазины/ })).not.toBeInTheDocument();
    expect(within(rail).getAllByRole('button', { name: /Все мои магазины/ })).toHaveLength(1);

    // Под карточкой, а не над ней: карточка говорит «где я», блок — «куда ещё».
    const youAreIn = within(rail).getByText('Вы сейчас в');
    expect(youAreIn.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('блок «Мои магазины» — текущий, закреплённые и недавние, без добора остальными', async () => {
    stubWideScreen();
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'СтройБаза Алматы', currency: 'KZT' },
        { supplierId: 'supplier-2', name: 'Бумага оптом', currency: 'KZT' },
        { supplierId: 'supplier-3', name: 'Овощебаза', currency: 'KZT' },
        { supplierId: 'supplier-4', name: 'Сантехника', currency: 'KZT' },
        { supplierId: 'supplier-5', name: 'Ткани', currency: 'KZT' },
      ]),
      ...shellRules(),
    ]);
    togglePin('supplier-4');
    rememberVisit('supplier-3');
    renderScreen(<Shell />, { route: '/catalog', supplierId: 'supplier-1' });

    const block = await within(await screen.findByTestId('rail')).findByRole('region', { name: 'Мои магазины' });
    const names = within(block).getAllByRole('button').map((button) => button.getAttribute('title'));
    expect(names).toEqual(['СтройБаза Алматы', 'Сантехника', 'Овощебаза']);
  });

  it('строка магазина называет, сколько позиций уже лежит в его корзине', async () => {
    stubWideScreen();
    rememberVisit('supplier-2');
    stubFetch([
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'СтройБаза Алматы', currency: 'KZT' },
        { supplierId: 'supplier-2', name: 'Бумага оптом', tagline: 'Магазин одежды', cartLines: 3, currency: 'KZT' },
      ]),
      get('/api/portal/notifications/summary', []),
      ...shellRules(),
    ]);
    renderScreen(<Shell />, { route: '/catalog', supplierId: 'supplier-1' });

    const block = await within(await screen.findByTestId('rail')).findByRole('region', { name: 'Мои магазины' });
    const row = await within(block).findByRole('button', { name: /Бумага оптом/ });
    expect(row).toHaveTextContent('Магазин одежды · в корзине 3');
    // У текущего — «где я», а не корзина: её он видит в шапке.
    expect(within(block).getByRole('button', { name: /СтройБаза Алматы/ })).toHaveTextContent('Вы сейчас здесь');
  });

  it('нажатие по другому магазину в колонке переключает на него', async () => {
    stubWideScreen();
    rememberVisit('supplier-2');
    stubFetch(shellRules());
    renderScreen(<Shell />, { route: '/orders', supplierId: 'supplier-1' });

    const block = await within(await screen.findByTestId('rail')).findByRole('region', { name: 'Мои магазины' });
    await userEvent.click(within(block).getByRole('button', { name: /Бумага оптом/ }));

    expect(await screen.findByText('Вы перешли в магазин Бумага оптом')).toHaveAttribute('role', 'status');
  });

  it('звёздочка закрепляет магазин, и он встаёт в «Закреплённые»', async () => {
    stubFetch(shellRules());
    renderScreen(<Shell />, { route: '/catalog' });

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

    renderWithRealSupplier(<Shell />);

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

  it('пункт «Поставщики» считает остальных, а не текущего', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const rail = await screen.findByRole('navigation', { name: 'Разделы кабинета' });
    await userEvent.click(within(rail).getByRole('button', { name: 'Ещё' }));
    // Список разделов рисуется сразу, без ожидания сети — сводка непрочитанного
    // приходит отдельным запросом и досчитывается позже. Поэтому дожидаемся
    // именно числа на пункте, а не только появления самого списка.
    //
    // Четыре — это второй поставщик. Текущий сюда не входит: его новости
    // считает колокольчик, и то же число в двух местах читалось бы
    // как два разных повода.
    await waitFor(() => {
      expect(within(rail).getByRole('link', { name: /Поставщики/ })).toHaveTextContent('4');
    });
  });

  it('в шапке стоит точка, а не число', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    expect(await screen.findByLabelText('У других поставщиков есть новости')).toBeInTheDocument();
  });

  it('без новостей у соседей ни точки, ни бейджа нет', async () => {
    stubWideScreen();
    stubFetch([
      // Заглушка берёт первое подходящее правило: своё стоит впереди общего
      // набора и перекрывает совпадающее правило `shellRules()` за него,
      // а не вырезается из набора по индексу.
      get('/api/portal/notifications/summary', [{ supplierId: 'supplier-1', unread: 7 }]),
      ...shellRules(),
    ]);

    renderScreen(<Shell />, { route: '/catalog' });

    const rail = await screen.findByRole('navigation', { name: 'Разделы кабинета' });
    await userEvent.click(within(rail).getByRole('button', { name: 'Ещё' }));
    expect(screen.queryByLabelText('У других поставщиков есть новости')).not.toBeInTheDocument();
    // Число у текущего поставщика (7) в бейдж не попадает вовсе: он не входит
    // в сумму по остальным, а других поставщиков в ответе нет.
    expect(within(rail).getByRole('link', { name: /Поставщики/ })).not.toHaveTextContent(/\d/);
  });

  /**
   * На сервере встречается расхождение: поставщик, у которого не читаются
   * сведения о продавце, выпадает из списка поставщиков, но остаётся
   * в сводке со счётом. Список — источник истины о том, к кому клиент
   * может пойти, и точка с бейджем не должны загораться от того, на кого
   * переключиться всё равно нельзя.
   */
  it('поставщик из сводки, которого нет в списке, не зажигает ни точку, ни бейдж', async () => {
    stubWideScreen();
    stubFetch([
      // Оба переопределения стоят впереди общего набора: заглушка берёт
      // первое подходящее правило, и стоящие следом правила `shellRules()`
      // для тех же адресов просто не доходят до дела — без срезов и без
      // арифметики по индексам, хрупкой к порядку правил внутри неё.
      get('/api/portal/notifications/summary', [
        { supplierId: 'supplier-1', unread: 2 },
        { supplierId: 'supplier-ghost', unread: 5 },
      ]),
      get('/api/portal/suppliers', [
        { supplierId: 'supplier-1', name: 'СтройБаза Алматы', currency: 'KZT' },
      ]),
      ...shellRules(),
    ]);

    const { queryClient } = renderScreen(<Shell />, { route: '/catalog' });

    const rail = await screen.findByRole('navigation', { name: 'Разделы кабинета' });
    await userEvent.click(within(rail).getByRole('button', { name: 'Ещё' }));

    // Утверждение об отсутствии точки и бейджа истинно и до того, как сводка
    // с поставщиками дошли с сервера — само по себе оно ничего не доказывает.
    // Ждём, пока оба запроса действительно завершатся, и только потом
    // проверяем результат: иначе тест прошёл бы и без сверки со списком.
    await waitFor(() => {
      expect(queryClient.getQueryState(getGetPortalUnreadSummaryQueryKey())?.status).toBe('success');
      expect(queryClient.getQueryState(getGetPortalSuppliersQueryKey())?.status).toBe('success');
    });

    expect(screen.queryByLabelText('У других поставщиков есть новости')).not.toBeInTheDocument();
    expect(within(rail).getByRole('link', { name: /Поставщики/ })).not.toHaveTextContent(/\d/);
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

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

    expect(await screen.findByRole('heading', { name: 'Поставщики' })).toBeInTheDocument();
  });

  it('колокольчик из шапки уходит: новостям взяться неоткуда', async () => {
    stubFetch(noSuppliersRules());

    renderScreen(<Shell />, { route: '/catalog' });

    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /Уведомления/ })).not.toBeInTheDocument();
  });

  it('у клиента с поставщиком полосы нет', async () => {
    stubFetch(shellRules());

    // Ждём именно ответа списка: до него утверждение об отсутствии полосы
    // истинно само по себе и ничего не доказывает.
    const { queryClient } = renderScreen(<Shell />, { route: '/catalog' });
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
    rating: 4.7, reviewCount: 12,
    hours: { timezone: 'Asia/Almaty', exceptions: [], days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, closed: false, opensAt: '07:00', closesAt: '17:00' })) },
  };

  it('полоса называет адрес, часы и даёт позвонить и написать', async () => {
    stubFetch([get('/api/portal/suppliers', [shopCard]), ...shellRules()]);
    renderScreen(<Shell />, { route: '/catalog' });
    const header = screen.getByRole('banner');
    expect(await within(header).findByText('Барахолка «Кенжехан-2»')).toBeInTheDocument();
    expect(within(header).getByText('Каждый день с 7:00 до 17:00')).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: /Написать в WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/77010000001');
    expect(within(header).getAllByRole('link', { name: /\+7 701 000 00 01|Позвонить/ })[0]).toHaveAttribute('href', 'tel:+77010000001');
    expect(within(header).getByText('Магазин одежды')).toBeInTheDocument();
    expect(within(header).getByLabelText('Рейтинг 4,7 из 5')).toBeInTheDocument();
  });

  it('без контактов пунктов нет, а колонка называет, в каком вы магазине', async () => {
    stubFetch(shellRules());   // поставщики без address/phone/whatsapp
    renderScreen(<Shell />, { route: '/catalog' });
    const header = screen.getByRole('banner');
    await within(header).findByText('СтройБаза Алматы');
    expect(within(header).queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
    const rail = screen.getByTestId('rail');
    expect(within(rail).getByText('Вы сейчас в')).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Все мои магазины/ })).toBeInTheDocument();
  });

  it('закрытый сегодня магазин предупреждает, что заявки всё равно принимаются', async () => {
    const closed = { ...shopCard, hours: { timezone: 'Asia/Almaty', exceptions: [], days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, closed: true })) } };
    stubFetch([get('/api/portal/suppliers', [closed]), ...shellRules()]);
    renderScreen(<Shell />, { route: '/catalog' });
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

  /** «Витрина»: меню разделов строкой под шапкой, колонки слева нет. */
  it('меню сверху — строкой под шапкой вместо колонки', async () => {
    stubWideScreen();
    stubFetch(designRules('VITRINA'));

    renderScreen(<Shell />, { route: '/catalog' });

    const top = await screen.findByTestId('top-nav');
    expect(within(top).getByRole('link', { name: 'Каталог товаров' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByTestId('rail')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell-grid')).toHaveAttribute('data-layout', 'top');

    // Редкие разделы — за «Ещё»: лист открывается и на мониторе.
    await userEvent.click(within(top).getByRole('button', { name: /^Ещё/ }));
    expect(await screen.findByRole('dialog', { name: 'Меню' })).toBeInTheDocument();
  });

  /** «Строгий»: узкая рейка со значками и короткими подписями. */
  it('узкая рейка — значки с короткими подписями', async () => {
    stubWideScreen();
    stubFetch(designRules('STRICT'));

    renderScreen(<Shell />, { route: '/orders' });

    const slim = await screen.findByTestId('slim-rail');
    expect(within(slim).getByRole('link', { name: 'Заявки' })).toHaveAttribute('aria-current', 'page');
    // Полное имя раздела — подсказкой: коротких подписей мало тому, кто здесь впервые.
    expect(within(slim).getByRole('link', { name: 'Каталог' })).toHaveAttribute('title', 'Каталог товаров');
    expect(screen.queryByTestId('rail')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell-grid').className).toContain('lg:grid-cols-[72px_minmax(0,1fr)]');
  });

  /** «Как приложение»: на мониторе нижнего меню нет — разделы в строке под шапкой, колонки нет. */
  it('у «Как приложение» нижнее меню только на телефоне', async () => {
    stubWideScreen();
    stubFetch(designRules('APP'));

    renderScreen(<Shell />, { route: '/catalog' });

    const bottom = await screen.findByRole('navigation', { name: 'Главное меню' });
    await waitFor(() => expect(screen.getByTestId('shell-grid')).toHaveAttribute('data-layout', 'bottom'));
    expect(bottom.className).toContain('lg:hidden');
    expect(await screen.findByTestId('top-nav')).toBeInTheDocument();
    expect(screen.queryByTestId('rail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('slim-rail')).not.toBeInTheDocument();
  });

  /** Без опубликованного дизайна — прежняя колонка, а нижнее меню только на телефоне. */
  it('без дизайна — прежняя колонка разделов', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    expect(await screen.findByTestId('rail')).toBeInTheDocument();
    expect(screen.getByTestId('shell-grid')).toHaveAttribute('data-layout', 'side');
    expect(screen.getByRole('navigation', { name: 'Главное меню' }).className).toContain('lg:hidden');
  });

  /** «Ночь» тёмная по умолчанию — у покупателя, который тему сам не выбирал. */
  it('тёмный шаблон открывает кабинет в тёмной теме', async () => {
    stubFetch(designRules('NIGHT'));

    renderScreen(<Shell />, { route: '/catalog' });

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    // Оттенки тёмной темы — в таблице стилей поставщика.
    expect(document.querySelector('style[data-supplier-theme]')?.textContent).toContain("html[data-theme='dark']");
  });

  it('выбор покупателя главнее тёмного шаблона', async () => {
    window.localStorage.setItem('q-order.portal.theme', 'light');
    stubFetch(designRules('NIGHT'));

    renderScreen(<Shell />, { route: '/catalog' });

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
    design: { template: 'CLASSIC', theme: 'TEMPLATE', published: true },
  };

  /** Праздник продавца — плашкой под шапкой, только в его дни. */
  it('в дни праздника под шапкой поздравление', async () => {
    const day = (shift: number) => new Date(Date.now() + shift * 86_400_000).toISOString().slice(0, 10);
    stubWideScreen();
    stubFetch([get('/api/portal/suppliers', [{
      ...closedShop,
      design: { ...closedShop.design, occasion: 'NAURYZ', occasionFrom: day(-2), occasionUntil: day(2) },
    }]), ...shellRules(filledCart)]);

    renderScreen(<Shell />, { route: '/catalog' });

    expect(await screen.findByText('С праздником Наурыз!')).toBeInTheDocument();
  });

  it('одна панель: знак, имя со «Сменить магазин · N», поиск, корзина с числом и суммой, чип вошедшего', async () => {
    stubWideScreen();
    stubFetch([get('/api/portal/suppliers', [closedShop]), ...shellRules(filledCart)]);

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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
      renderScreen(<Shell />, { route: '/catalog' });

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
      renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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

    renderScreen(<Shell />, { route: '/catalog' });

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

  it('без дизайна шапка прежняя', async () => {
    stubFetch(shellRules());

    const { queryClient } = renderScreen(<Shell />, { route: '/catalog' });
    await waitFor(() => {
      expect(queryClient.getQueryState(getGetPortalSuppliersQueryKey())?.status).toBe('success');
    });
    expect(screen.queryByTestId('design-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shop-status')).not.toBeInTheDocument();
    expect(screen.getByRole('banner').querySelector('.bg-strip')).not.toBeNull();
  });
});

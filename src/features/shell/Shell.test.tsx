import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from './Shell';
import { getGetPortalSuppliersQueryKey, getGetPortalUnreadSummaryQueryKey } from '../../api/generated';
import { renderScreen } from '../../test/render';
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
      { supplierId: 'supplier-1', name: 'СтройБаза Алматы' },
      { supplierId: 'supplier-2', name: 'Бумага оптом' },
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
    const rail = await screen.findByRole('navigation', { name: 'Разделы кабинета' });
    expect(rail.className).toContain('lg:flex');
    expect(rail.className).toContain('hidden');

    // Лист — телефону: на мониторе та же кнопка складывает колонку,
    // а не выкладывает поверх неё второй такой же список.
    await userEvent.click(screen.getByRole('button', { name: 'Меню' }));
    expect(await screen.findByRole('dialog', { name: 'Меню' })).toBeInTheDocument();
  });

  it('избранное, вопросы, отзывы и доставка открываются как разделы', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/favorites' });
    expect(await screen.findByRole('heading', { name: 'Избранное' })).toBeInTheDocument();

    renderScreen(<Shell />, { route: '/questions' });
    expect(await screen.findByRole('heading', { name: 'Вопросы продавцу' })).toBeInTheDocument();

    renderScreen(<Shell />, { route: '/reviews' });
    expect(await screen.findByRole('heading', { name: 'Мои отзывы' })).toBeInTheDocument();

    renderScreen(<Shell />, { route: '/delivery' });
    expect(await screen.findByRole('heading', { name: 'Доставка и самовывоз' })).toBeInTheDocument();
  });

  it('раздел «Мои отзывы» стоит в списке разделов', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const rail = await screen.findByRole('navigation', { name: 'Разделы кабинета' });
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
        { supplierId: 'supplier-1', name: 'Стройбаза', logoUrl: 'https://cdn.example.kz/sb.png' },
      ]),
      ...shellRules(),
    ]);

    renderScreen(<Shell />, { route: '/catalog' });

    const mark = await screen.findByAltText('Стройбаза');
    expect(mark).toHaveAttribute('src', 'https://cdn.example.kz/sb.png');
    expect(screen.getAllByText('Стройбаза').length).toBeGreaterThan(0);
  });

  it('поставщик без знака показан одним именем, без заглушки', async () => {
    stubFetch([
      get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'Стройбаза' }]),
      ...shellRules(),
    ]);

    renderScreen(<Shell />, { route: '/catalog' });

    expect(await screen.findByText('Стройбаза')).toBeInTheDocument();
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

    const rail = await screen.findByRole('navigation', { name: 'Разделы кабинета' });
    const mark = within(rail).getByTestId('rail-logo');
    // Ниже разделов, а не десятым пунктом среди них.
    const last = within(rail).getByRole('link', { name: 'Поставщики' });
    expect(last.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();

    expect(within(rail).getAllByText('Q-Order')).toHaveLength(1);
  });

  it('на мониторе кабинет разложен в три колонки: разделы, витрина, заявка', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const grid = await screen.findByTestId('shell-grid');
    expect(grid.className).toContain('lg:grid-cols-[232px_minmax(0,1fr)_340px]');
  });

  /**
   * Заявка на мониторе — колонка, на телефоне — нижняя полоса.
   *
   * Вместе они не показываются никогда: полоса поверх колонки закрывала бы
   * ту же сумму вторым слоем. Проверяется именно пара классов — разъедься
   * они, на мониторе оказались бы два итога сразу.
   */
  it('на мониторе заявка стоит колонкой справа, а нижняя полоса уступает ей место', async () => {
    stubFetch(shellRules(filledCart));

    renderScreen(<Shell />, { route: '/catalog' });

    const panel = await screen.findByTestId('cart-panel');
    expect(panel.className).toContain('hidden');
    expect(panel.className).toContain('lg:flex');

    const bar = await screen.findByTestId('cart-bar');
    expect(bar.className).toContain('lg:hidden');
  });

  /**
   * На оформлении заявка и есть экран: колонка справа показывала бы тот же
   * состав второй раз и отнимала бы у формы треть ширины.
   */
  it('на экране оформления колонка заявки не дублирует сам экран', async () => {
    stubFetch(shellRules(filledCart));

    renderScreen(<Shell />, { route: '/checkout' });

    expect(await screen.findByRole('heading', { name: 'Оформление' })).toBeInTheDocument();
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument();
  });

  /**
   * Избранное и заявка в шапке телефона — значки без подписи: подпись рядом
   * с именем поставщика не помещается. Значок обязан быть назван словом,
   * иначе кнопка для экранного диктора остаётся «ссылкой», и он в неё
   * не пойдёт. Сорок четыре точки — потому что кабинет открывают пальцем.
   */
  it('в шапке телефона избранное и заявка — цели в 44 точки с названным назначением', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Избранное' }).className).toContain('size-11');

    const cart = within(header).getByRole('link', { name: 'Заявка' });
    expect(cart.className).toContain('size-11');
    // На мониторе итог заявки стоит колонкой справа: значок в шапке был бы
    // третьим местом с той же суммой.
    expect(cart.className).toContain('lg:hidden');
  });

  /**
   * Поиск в шапке — только на мониторе: на телефоне поле поиска стоит на самой
   * витрине, и второе в шапке спрашивало бы то же самое дважды.
   */
  it('поиск в шапке появляется только на широком экране', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const search = screen.getByRole('search');
    expect(search.className).toContain('hidden');
    expect(search.className).toContain('lg:flex');
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

describe('новости у других поставщиков', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('пункт «Поставщики» считает остальных, а не текущего', async () => {
    stubWideScreen();
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/catalog' });

    const rail = await screen.findByRole('navigation', { name: 'Разделы кабинета' });
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
        { supplierId: 'supplier-1', name: 'СтройБаза Алматы' },
      ]),
      ...shellRules(),
    ]);

    const { queryClient } = renderScreen(<Shell />, { route: '/catalog' });

    const rail = await screen.findByRole('navigation', { name: 'Разделы кабинета' });

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

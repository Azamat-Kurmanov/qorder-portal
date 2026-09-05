import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from './Shell';
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
    get('/api/portal/notifications', []),
    get('/api/portal/categories', []),
    get('/api/portal/catalog', { page: 0, size: 50, totalElements: 0, items: [] }),
    get('/api/portal/favorites', []),
    get('/api/portal/questions', []),
    get('/api/portal/delivery', { mode: 'PICKUP_ONLY', methods: [], pickupPoints: [] }),
    get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'СтройБаза Алматы' }]),
    get('/api/portal/cart', cart),
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

  it('избранное, вопросы и доставка открываются как разделы', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/favorites' });
    expect(await screen.findByRole('heading', { name: 'Избранное' })).toBeInTheDocument();

    renderScreen(<Shell />, { route: '/questions' });
    expect(await screen.findByRole('heading', { name: 'Вопросы продавцу' })).toBeInTheDocument();

    renderScreen(<Shell />, { route: '/delivery' });
    expect(await screen.findByRole('heading', { name: 'Доставка и самовывоз' })).toBeInTheDocument();
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

  it('выбранный раздел назван выбранным, а не только подкрашен', async () => {
    stubFetch(shellRules());

    renderScreen(<Shell />, { route: '/favorites' });

    await userEvent.click(screen.getByRole('button', { name: 'Меню' }));
    const links = await screen.findAllByRole('link', { name: 'Избранное' });
    // Цвет читает не всякий: состояние обязано быть сказано словами.
    expect(links.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { PromotionsPage } from './PromotionsPage';
import { CartSavings } from '../cart/CartSavings';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch, type StubbedResponse } from '../../test/http';
import type { CartDto } from '../../api/generated';

const COAT = {
  id: 'item-1', name: 'Тренч Classic Beige', unit: 'шт', price: 39992, oldPrice: 49990, discountPercent: 20,
  vatRate: 12, stock: 'IN_STOCK', favorite: false,
};

const PROMOTIONS = {
  sale: {
    title: 'Осенняя распродажа верхней одежды', text: 'Пуховики и тренчи', maxPercent: 20,
    endsOn: '2099-09-30', endsAt: '2099-10-01T00:00:00Z',
  },
  volumeTiers: [{ from: 150000, percent: 3 }, { from: 400000, percent: 5 }],
  firstOrder: { percent: 5, status: 'USED' },
  subscription: { subscribed: false },
  deals: [COAT],
  dealCount: 1,
  saleCategories: [],
  // Магазин подсказывает «ещё N ₸», когда до порога осталось не больше половины.
  volumeHintPercent: 50,
};

function rules(extra: StubbedResponse[] = [], promotions: unknown = PROMOTIONS): StubbedResponse[] {
  return [
    ...extra,
    get('/api/portal/promotions', promotions),
    get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'ИП «Мухамедиева»' }]),
    get('/api/portal/cart', { lines: [], total: 0, skipped: [] }),
    get('/api/portal/notifications', []),
  ];
}

describe('акции и скидки в кабинете', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('показывает выгоду по корзине, распродажу с отсчётом и товары со скидкой', async () => {
    stubFetch(rules());
    renderScreen(<PromotionsPage />);

    expect(await screen.findByRole('heading', { name: 'Осенняя распродажа верхней одежды' })).toBeInTheDocument();
    expect(screen.getByText('Скидки считаются в корзине сами — ничего вводить не нужно')).toBeInTheDocument();
    // Действуют распродажа и оптовая; первая заявка уже использована.
    expect(screen.getByText('Распродажа · до −20%')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Смотреть 1 товар/ })).toHaveAttribute('href', '/catalog?sale=1');

    // Пустая корзина далеко от порога — условие скидки без полоски (подсказка — от половины пути).
    expect(screen.getByRole('heading', { name: /^От 150\s000 ₸ — −3% на всю заявку$/ })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Уже использована')).toBeInTheDocument();

    const deals = screen.getByRole('region', { name: 'Товары со скидкой' });
    const card = within(deals).getByTestId('deal-card');
    expect(within(card).getByText('Тренч Classic Beige')).toBeInTheDocument();
    expect(within(card).getByText('−20%')).toBeInTheDocument();
    expect(within(card).getByText(/^Выгода 9\s998 ₸$/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /В корзину/ })).toBeInTheDocument();

    // «Как работают скидки» в «Варианте Б» нет — макет SimplePicWebPromotions.
    expect(screen.queryByRole('heading', { name: 'Как работают скидки' })).not.toBeInTheDocument();
    // Согласие на уведомления — и здесь, не только в профиле (новинки, §4.4).
    expect(screen.getByRole('switch', { name: 'Сообщать о новинках и акциях' })).toHaveAttribute('aria-checked', 'false');
  });

  it('открытый раздел гасит уведомление о начале распродажи', async () => {
    const started = { id: 'n-sale', kind: 'PROMO_STARTED', createdAt: '2026-10-22T05:00:00Z', detail: '45' };
    const { calls } = stubFetch(rules([
      get('/api/portal/notifications', [started]),
      method('POST', '/api/portal/notifications/n-sale/read', null, 204),
    ]));
    renderScreen(<PromotionsPage />);

    await waitFor(() => expect(calls.some((call) =>
      call.url.includes('/api/portal/notifications/n-sale/read') && call.init?.method === 'POST')).toBe(true));
  });

  it('чипы рубрик — из рубрик распродажи с сервера: «Все · N» и названия по порядку', async () => {
    // В первых карточках — только одна рубрика, но распродажа идёт в трёх:
    // чипы строятся не по показанному, а по тому, что прислал сервер.
    stubFetch(rules([], {
      ...PROMOTIONS,
      deals: [{ ...COAT, categoryId: 'cat-1' }],
      dealCount: 14,
      saleCategories: [
        { categoryId: 'cat-1', name: 'Пуховики', count: 8 },
        { categoryId: 'cat-2', name: 'Тренчи', count: 4 },
        { categoryId: 'cat-3', name: 'Пальто', count: 2 },
      ],
    }));
    renderScreen(<PromotionsPage />);

    const deals = await screen.findByRole('region', { name: 'Товары со скидкой' });
    const group = within(deals).getByRole('group', { name: 'Рубрики' });
    expect(within(group).getAllByRole('button').map((chip) => chip.textContent))
      .toEqual(['Все · 14', 'Пуховики', 'Тренчи', 'Пальто']);
    expect(within(group).getByRole('button', { name: 'Все · 14' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('выбор рубрики грузит товары распродажи этой рубрики, «Все» возвращает первые', async () => {
    const PARKA = { ...COAT, id: 'item-7', name: 'Пуховик Nord', categoryId: 'cat-2' };
    const { calls } = stubFetch(rules([
      get('/api/portal/catalog', { page: 0, size: 50, totalElements: 1, items: [PARKA] }),
    ], {
      ...PROMOTIONS,
      deals: [{ ...COAT, categoryId: 'cat-1' }],
      dealCount: 5,
      saleCategories: [
        { categoryId: 'cat-1', name: 'Тренчи', count: 3 },
        { categoryId: 'cat-2', name: 'Пуховики', count: 2 },
      ],
    }));
    renderScreen(<PromotionsPage />);

    const deals = await screen.findByRole('region', { name: 'Товары со скидкой' });
    await userEvent.click(within(deals).getByRole('button', { name: 'Пуховики' }));

    expect(await within(deals).findByText('Пуховик Nord')).toBeInTheDocument();
    expect(within(deals).queryByText('Тренч Classic Beige')).not.toBeInTheDocument();
    expect(within(deals).getByRole('button', { name: 'Пуховики' })).toHaveAttribute('aria-pressed', 'true');
    const asked = calls.find((call) => call.url.includes('/api/portal/catalog'));
    expect(asked?.url).toContain('onSale=true');
    expect(asked?.url).toContain('categoryId=cat-2');

    await userEvent.click(within(deals).getByRole('button', { name: 'Все · 5' }));
    expect(within(deals).getByText('Тренч Classic Beige')).toBeInTheDocument();
    expect(within(deals).queryByText('Пуховик Nord')).not.toBeInTheDocument();
  });

  it('распродажа в одной рубрике — чипов нет', async () => {
    stubFetch(rules([], {
      ...PROMOTIONS,
      saleCategories: [{ categoryId: 'cat-1', name: 'Тренчи', count: 1 }],
    }));
    renderScreen(<PromotionsPage />);

    const deals = await screen.findByRole('region', { name: 'Товары со скидкой' });
    expect(within(deals).queryByRole('group')).not.toBeInTheDocument();
  });

  it('по корзине с первой скидкой — «до оптовой цены», а билет говорит, что скидка применится', async () => {
    stubFetch(rules([get('/api/portal/cart', {
      lines: [], total: 95000, skipped: [], goodsTotal: 100000, saleSavings: 0, ageConfirmed: false,
      discount: { kind: 'FIRST_ORDER', percent: 5, amount: 5000 },
      nextTier: { from: 150000, percent: 3, missing: 50000 },
    })], { ...PROMOTIONS, firstOrder: { percent: 5, status: 'ELIGIBLE' } }));
    renderScreen(<PromotionsPage />);

    expect(await screen.findByRole('heading', { name: /^Ещё 50\s000 ₸ до оптовой цены$/ })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
    // Обёртка полосы позиционирована — контур-коробка (absolute) не ложится поверх неё.
    expect(screen.getByRole('progressbar').parentElement).toHaveClass('relative');
    expect(screen.getByText('Применится к этой заявке')).toBeInTheDocument();
    expect(screen.getByText(/Экономия по текущей корзине — 5\s000 ₸/)).toBeInTheDocument();
    expect(screen.getByText('Скидки не складываются — корзина применит бо́льшую.')).toBeInTheDocument();
  });

  it('когда оптовая сработала, билет первой заявки уступает ей', async () => {
    stubFetch(rules([get('/api/portal/cart', {
      lines: [], total: 388000, skipped: [], goodsTotal: 400000, saleSavings: 0, ageConfirmed: false,
      discount: { kind: 'VOLUME', percent: 5, amount: 20000 },
    })], { ...PROMOTIONS, firstOrder: { percent: 5, status: 'ELIGIBLE' } }));
    renderScreen(<PromotionsPage />);

    expect(await screen.findByRole('heading', { name: 'Скидка −5% ваша' })).toBeInTheDocument();
    expect(screen.getByText(/Экономия 20\s000 ₸/)).toBeInTheDocument();
    expect(screen.getByText('Уступила оптовой')).toBeInTheDocument();
  });

  /** Издалека магазин не пугает полоской — показывает условие скидки. */
  it('далеко от порога — условие скидки без полоски', async () => {
    stubFetch(rules([get('/api/portal/cart', {
      lines: [], total: 40000, skipped: [], goodsTotal: 40000, saleSavings: 0, ageConfirmed: false,
    })], { ...PROMOTIONS, volumeHintPercent: 30 }));
    renderScreen(<PromotionsPage />);

    expect(await screen.findByRole('heading', { name: /^От 150\s000 ₸ — −3% на всю заявку$/ })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('в другой валюте магазина пороги показываются с её знаком', async () => {
    stubFetch(rules());
    renderScreen(<PromotionsPage />, { currency: 'RUB' });

    expect(await screen.findByRole('heading', { name: /^От 150\s000 ₽ — −3% на всю заявку$/ })).toBeInTheDocument();
  });

  it('без отсчёта у распродажи остаётся последний день', async () => {
    stubFetch(rules([], { ...PROMOTIONS, sale: { ...PROMOTIONS.sale, countdown: false } }));
    renderScreen(<PromotionsPage />);

    await screen.findByRole('heading', { name: 'Осенняя распродажа верхней одежды' });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByText(/Последний день/)).toBeInTheDocument();
  });

  it('скидка на первую заявку с порогом говорит, сколько осталось', async () => {
    stubFetch(rules([get('/api/portal/cart', {
      lines: [], total: 12000, skipped: [], goodsTotal: 12000, saleSavings: 0, ageConfirmed: false,
    })], { ...PROMOTIONS, firstOrder: { percent: 5, status: 'ELIGIBLE', minTotal: 20000 } }));
    renderScreen(<PromotionsPage />);

    expect(await screen.findByText(/^От 20\s000 ₸ в заявке$/)).toBeInTheDocument();
    expect(screen.getByText(/осталось 8\s000 ₸/)).toBeInTheDocument();
  });

  /** «Сейчас в магазине»: распродажа первым слайдом, за ней баннеры из редактора. */
  it('в «Сейчас в магазине» за распродажей идут баннеры магазина', async () => {
    stubFetch(rules([get('/api/portal/banners', [{
      id: 'b1', visible: true, template: 'NEW_ITEM', scheme: 'SAGE', title: 'Юбка миди Pleated',
      buttonText: 'Посмотреть', target: 'CATALOG',
    }])]));
    renderScreen(<PromotionsPage />);

    expect(await screen.findByRole('heading', { name: 'Осенняя распродажа верхней одежды' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Слайд 2' }));
    expect(await screen.findByText('Юбка миди Pleated')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Осенняя распродажа верхней одежды' })).not.toBeInTheDocument();
  });

  it('баннер «распродажа» не показывается, когда распродажа не идёт', async () => {
    stubFetch(rules([get('/api/portal/banners', [
      { id: 'b1', visible: true, template: 'NEW_ITEM', scheme: 'SAGE', title: 'Слайд распродажи', buttonText: 'Смотреть', target: 'SALE' },
      { id: 'b2', visible: true, template: 'NEW_ITEM', scheme: 'SAGE', title: 'Юбка миди Pleated', buttonText: 'Посмотреть', target: 'CATALOG' },
    ])], { ...PROMOTIONS, sale: undefined, deals: [], dealCount: 0 }));
    renderScreen(<PromotionsPage />);

    expect(await screen.findByText('Юбка миди Pleated')).toBeInTheDocument();
    expect(screen.queryByText('Слайд распродажи')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Слайд 2' })).not.toBeInTheDocument();
  });

  /** Кнопки слайдов «распродажа» и «новинки» ведут в отборы витрины. */
  it.each([
    ['SALE', '?sale=1'],
    ['NOVELTY', '?novelty=1'],
  ])('кнопка слайда %s ведёт в витрину с отбором %s', async (target, search) => {
    stubFetch(rules([get('/api/portal/banners', [{
      id: 'b1', visible: true, template: 'NEW_ITEM', scheme: 'SAGE', title: 'Слайд', buttonText: 'Посмотреть', target,
    }])], { ...PROMOTIONS, sale: undefined }));
    function Where() {
      return <h1>{`Каталог${useLocation().search}`}</h1>;
    }
    renderScreen(
      <Routes>
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/catalog" element={<Where />} />
      </Routes>,
      { route: '/promotions' },
    );

    await userEvent.click(await screen.findByRole('button', { name: /Посмотреть/ }));
    expect(await screen.findByRole('heading', { name: `Каталог${search}` })).toBeInTheDocument();
  });
});

/**
 * Ширина колонки экрана акций — по ней он выбирает раскладку телефона.
 * jsdom размеров не считает и отдаёт нули («ещё не знаем» — раскладка монитора),
 * поэтому подменяется само измерение, как в тестах витрины.
 */
function stubColumnWidth(width: number) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('товары со скидкой: на мониторе один ряд', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const SIX = Array.from({ length: 6 }, (_, index) => ({ ...COAT, id: `item-${index + 1}`, name: `Тренч ${index + 1}` }));

  /** Сколько карточек видно на мониторе: лишние спрятаны классом `lg:hidden`. */
  async function visibleOnMonitor(width: number) {
    stubColumnWidth(width);
    stubFetch(rules([], { ...PROMOTIONS, deals: SIX, dealCount: 14 }));
    renderScreen(<PromotionsPage />);
    const deals = await screen.findByRole('region', { name: 'Товары со скидкой' });
    const cards = within(deals).getAllByTestId('deal-card');
    expect(cards).toHaveLength(6);
    expect(within(deals).getByRole('link', { name: 'Смотреть 14 товаров со скидкой' })).toHaveAttribute('href', '/catalog?sale=1');
    return cards.filter((card) => !card.className.split(' ').includes('lg:hidden')).length;
  }

  it('широкая колонка — ровно четыре карточки', async () => {
    expect(await visibleOnMonitor(1200)).toBe(4);
  });

  it('колонка уже — ровно три карточки', async () => {
    expect(await visibleOnMonitor(900)).toBe(3);
  });

  it('на телефоне лента показывает все', async () => {
    stubColumnWidth(390);
    stubFetch(rules([], { ...PROMOTIONS, deals: SIX, dealCount: 14 }));
    renderScreen(<PromotionsPage />);
    const deals = await screen.findByRole('region', { name: 'Товары со скидкой' });
    const cards = within(deals).getAllByTestId('deal-card');
    expect(cards.filter((card) => card.className.split(' ').includes('lg:hidden'))).toHaveLength(0);
  });
});

describe('акции и скидки на телефоне', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('собирает экран коротко: первая заявка с несложением, «Смотреть N товаров», порог без процента', async () => {
    stubColumnWidth(390);
    stubFetch(rules([get('/api/portal/cart', {
      lines: [], total: 76600, skipped: [], goodsTotal: 76600, saleSavings: 0, ageConfirmed: false,
    })], {
      ...PROMOTIONS,
      firstOrder: { percent: 5, status: 'ELIGIBLE' },
      subscription: { subscribed: false },
    }));
    renderScreen(<PromotionsPage />);

    expect(await screen.findByRole('heading', { name: 'Осенняя распродажа верхней одежды' })).toBeInTheDocument();
    // Распродажа, оптовая и первая заявка — три, короткой пилюлей вместо длинной фразы.

    const ticket = screen.getByTestId('first-ticket');
    expect(within(ticket).getByText('−5%')).toBeInTheDocument();
    expect(within(ticket).getByText('На первую заявку')).toBeInTheDocument();
    expect(within(ticket).getByText('Применится в корзине сама')).toBeInTheDocument();
    expect(within(ticket).getByText('Не складывается с оптовой — действует бо́льшая.')).toBeInTheDocument();

    // Полоса оптовой: справа только порог.
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/^150\s000 ₸$/)).toBeInTheDocument();

    // Распродажа без описания.
    expect(screen.queryByText('Пуховики и тренчи')).not.toBeInTheDocument();

    const deals = screen.getByRole('region', { name: 'Товары со скидкой' });
    expect(within(deals).getByRole('link', { name: /^Смотреть \d+ товар/ })).toHaveAttribute('href', '/catalog?sale=1');
    expect(within(deals).queryByText(/^Выгода/)).not.toBeInTheDocument();
  });

  it('без оптовой билет не говорит о несложении', async () => {
    stubColumnWidth(390);
    stubFetch(rules([], { ...PROMOTIONS, volumeTiers: [], firstOrder: { percent: 5, status: 'ELIGIBLE' } }));
    renderScreen(<PromotionsPage />);

    const ticket = await screen.findByTestId('first-ticket');
    expect(within(ticket).getByText('Применится в корзине сама')).toBeInTheDocument();
    expect(screen.queryByText('Не складывается с оптовой — действует бо́льшая.')).not.toBeInTheDocument();
  });

  it('«Назад» у имени раздела всегда ведёт на «Главную»', async () => {
    stubColumnWidth(390);
    stubFetch(rules());
    renderScreen(
      <Routes>
        <Route path="/" element={<><h1>Заявки</h1><Link to="/promotions">К акциям</Link></>} />
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/home" element={<h1>Главная</h1>} />
      </Routes>,
    );

    // Пришли из «Заявок», но стрелка раздела — не «назад по истории», а на «Главную».
    await userEvent.click(await screen.findByRole('link', { name: 'К акциям' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Назад' }));
    expect(await screen.findByRole('heading', { name: 'Главная' })).toBeInTheDocument();
  });
});

describe('выгода в корзине', () => {
  it('подсказывает порог, показывает скидку на заявку и выгоду', () => {
    const cart: CartDto = {
      creditLimitExceeded: false,
      lines: [{ itemId: 'a', name: 'Цемент', quantity: 80, unit: 'мешок', priceAtAdding: 2500, price: 2500, priceChanged: false, total: 200000,
        terms: { hit: false, novelty: false, ageRestricted: false } }],
      total: 194000, skipped: [], goodsTotal: 200000, volumeGoods: 200000, saleSavings: 0, ageConfirmed: false, vatPayer: true, vatIncluded: false,
      discount: { kind: 'VOLUME', percent: 3, amount: 6000 },
      nextTier: { from: 400000, percent: 5, missing: 200000 },
    };
    renderScreen(<CartSavings cart={cart} />);

    expect(screen.getByTestId('cart-tier')).toHaveTextContent('— и будет 5%.');
    expect(screen.getByTestId('cart-discount')).toHaveTextContent('Скидка за объём −3%');
    expect(screen.getByTestId('cart-saved')).toHaveTextContent('Ваша выгода');
  });

  it('при оптовых строках скидка на заявку помечена: только на штучные товары', () => {
    const retail = { itemId: 'a', name: 'Цемент', quantity: 80, unit: 'мешок', priceAtAdding: 2500, price: 2500, priceChanged: false,
      total: 200000, terms: { hit: false, novelty: false, ageRestricted: false } };
    const cart: CartDto = {
      creditLimitExceeded: false,
      lines: [retail, { ...retail, itemId: 'b', quantity: 60, total: 5400, split: { packs: 3, packUnit: 'упаковка', packQty: 20, packPrice: 1800, rest: 0 } }],
      total: 199400, skipped: [], goodsTotal: 205400, volumeGoods: 200000, saleSavings: 0, ageConfirmed: false, vatPayer: true, vatIncluded: false,
      discount: { kind: 'VOLUME', percent: 3, amount: 6000 },
    };
    const { unmount } = renderScreen(<CartSavings cart={cart} />);
    expect(screen.getByTestId('cart-discount')).toHaveTextContent('только на штучные товары');
    unmount();

    renderScreen(<CartSavings cart={{ ...cart, lines: [retail] }} />);
    expect(screen.getByTestId('cart-discount')).not.toHaveTextContent('только на штучные товары');
  });

  it('порог не выше действующей скидки на заявку не подсказывает: первая заявка 5% перекрывает «и 3%»', () => {
    const cart: CartDto = {
      creditLimitExceeded: false,
      lines: [{ itemId: 'a', name: 'Цемент', quantity: 20, unit: 'мешок', priceAtAdding: 2500, price: 2500, priceChanged: false, total: 50000,
        terms: { hit: false, novelty: false, ageRestricted: false } }],
      total: 47500, skipped: [], goodsTotal: 50000, volumeGoods: 50000, saleSavings: 0, ageConfirmed: false, vatPayer: true, vatIncluded: false,
      discount: { kind: 'FIRST_ORDER', percent: 5, amount: 2500 },
      nextTier: { from: 100000, percent: 3, missing: 50000 },
    };
    renderScreen(<CartSavings cart={cart} />);

    expect(screen.queryByTestId('cart-tier')).not.toBeInTheDocument();
    expect(screen.getByTestId('cart-discount')).toBeInTheDocument();
  });

  it('корень страницы без запаса под полосу корзины — её здесь нет, отступ под меню даёт оболочка', async () => {
    stubFetch(rules());
    const { container } = renderScreen(<PromotionsPage />);

    await screen.findByRole('heading', { name: 'Осенняя распродажа верхней одежды' });
    expect(container.querySelector('.pb-20')).toBeNull();
  });
});

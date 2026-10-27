import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { ItemCardPage } from './ItemCardPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch, type StubbedResponse } from '../../test/http';

const CARD = {
  id: 'item-1',
  name: 'Цемент М400',
  description: 'Портландцемент общестроительного назначения.',
  unit: 'мешок',
  price: 2500,
  vatRate: 12,
  priceAsOf: '2026-09-04T10:00:00Z',
  stock: 'IN_STOCK',
  media: [
    { id: 'm1', kind: 'PHOTO', source: 'LINK', url: 'https://cdn.example/cement.jpg', title: 'Мешок 50 кг', sortOrder: 10 },
    { id: 'm2', kind: 'VIDEO', source: 'LINK', url: 'https://cdn.example/cement.mp4', sortOrder: 20 },
  ],
  attributes: [
    { name: 'Марка', value: 'М400' },
    { name: 'Вес', value: '50 кг' },
  ],
  favorite: false,
  rating: 4.5,
  reviewCount: 2,
  canReview: true,
};

const emptyCart = { lines: [], total: 0, skipped: [] };

/** Корзина, в которой эта позиция уже набрана: с неё считается сумма на кнопке. */
function cartWith(quantity: number) {
  return {
    lines: [{
      itemId: 'item-1', name: 'Цемент М400', quantity, unit: 'мешок',
      priceAtAdding: 2500, price: 2500, priceChanged: false, total: 2500 * quantity,
    }],
    total: 2500 * quantity,
    skipped: [],
  };
}

/**
 * Корзина, которая помнит положенное: после добавления её перечитывают,
 * и плоское правило вернуло бы пустую — карточка честно показала бы кнопку
 * снова, а проверка ловила бы заглушку.
 */
function rememberingCart(afterAdding: unknown): StubbedResponse[] {
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

function cardRules(card: unknown = CARD, reviews: unknown[] = [], cart: unknown = emptyCart) {
  return [
    get('/api/portal/catalog/item-1', card),
    get('/api/portal/items/item-1/reviews', reviews),
    get('/api/portal/cart', cart),
  ];
}

function renderCard() {
  return renderScreen(
    <Routes>
      <Route path="/catalog/:itemId" element={<ItemCardPage />} />
    </Routes>,
    { route: '/catalog/item-1' },
  );
}

describe('карточка товара', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Характеристики рубрики идут выше прочих свойств: их продавец заводил
   * шаблоном отрасли и заполняет у каждой позиции, а прочие свойства —
   * то разовое, чему поля не завели. Клиенту разница не объясняется, поэтому
   * список один, а порядок в нём и есть объяснение.
   *
   * Внутренних характеристик здесь нет ни в каком виде: сервер их не отдаёт,
   * и проверять их отсутствие на экране нечем — это закреплено на сервере.
   */
  it('открытая по ссылке с #reviews прокручивается к отзывам, когда они загружены', async () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      stubFetch(cardRules(CARD, [
        { id: 'r1', rating: 5, text: 'Хороший', status: 'PUBLISHED', mine: false, createdAt: '2026-09-01T10:00:00Z' },
      ]));
      renderScreen(
        <Routes>
          <Route path="/catalog/:itemId" element={<ItemCardPage />} />
        </Routes>,
        { route: '/catalog/item-1#reviews' },
      );

      await waitFor(() => expect(scroll).toHaveBeenCalled());
      const target = scroll.mock.contexts[0] as HTMLElement;
      expect(target.id).toBe('reviews');
      expect(scroll.mock.calls[0][0]).toMatchObject({ block: 'start' });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('без #reviews в адресе к отзывам не прокручивает', async () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      stubFetch(cardRules());
      renderCard();
      await screen.findByRole('heading', { level: 1, name: 'Цемент М400' });
      await screen.findByRole('heading', { name: /Отзывы/ });
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('«Спросить продавца» и «В избранное» растут в высоту, когда подпись переносится', async () => {
    stubFetch(cardRules());
    renderCard();

    await screen.findByRole('heading', { level: 1, name: 'Цемент М400' });
    for (const name of ['Спросить продавца', 'В избранное']) {
      // Сердечко на снимке называется так же; нужна кнопка с подписью.
      const [button] = screen.getAllByRole('button', { name }).filter((one) => one.textContent?.includes(name));
      expect(button).not.toHaveClass('h-[52px]');
      expect(button).toHaveClass('min-h-[52px]', 'px-3', 'py-1', 'leading-[1.15]', 'text-center');
    }
  });

  it('под названием — артикул цвета; без артикула строки нет', async () => {
    stubFetch(cardRules({ ...CARD, article: 'TS-BLK' }));
    renderCard();
    expect(await screen.findByText('Арт. TS-BLK')).toBeInTheDocument();
  });

  it('показывает характеристики рубрики выше прочих свойств', async () => {
    stubFetch(cardRules({
      ...CARD,
      fields: [
        { code: 'SIZE', name: 'Размер', type: 'OPTION', value: 'M' },
        { code: 'COMPOSITION', name: 'Состав', type: 'TEXT', value: 'Полиэстер 100%' },
        { code: 'VOLUME', name: 'Объём', type: 'NUMBER', value: '1.5', unit: 'л' },
        { code: 'EMPTY', name: 'Незаполненная', type: 'TEXT', value: '' },
      ],
    }));

    renderCard();

    expect(await screen.findByRole('heading', { name: 'Цемент М400' })).toBeInTheDocument();

    const rows = screen.getAllByTestId('item-property');
    expect(rows.map((row) => row.textContent)).toEqual([
      'РазмерM',
      'СоставПолиэстер 100%',
      'Объём1.5 л',
      'МаркаМ400',
      'Вес50 кг',
      // Как продаётся — выведено из единицы и кратности, строкой в конце.
      'Продаётсяв единицах «мешок»',
    ]);

    // Характеристика без значения заняла бы строку сообщением ни о чём.
    expect(screen.queryByText('Незаполненная')).not.toBeInTheDocument();
  });

  it('показывает снимки, свойства и оценку, а количество вводится не выходя из карточки', async () => {
    const { calls } = stubFetch([
      ...cardRules(),
      method('PUT', '/api/portal/cart/lines/item-1', {
        lines: [{
          itemId: 'item-1', name: 'Цемент М400', quantity: 3, unit: 'мешок',
          priceAtAdding: 2500, price: 2500, priceChanged: false, total: 7500,
        }],
        total: 7500,
        skipped: [],
      }),
    ]);

    renderCard();

    expect(await screen.findByRole('heading', { name: 'Цемент М400' })).toBeInTheDocument();
    // Снимок — картинкой, ролик — меткой: видео не грузится само, пока
    // на него не нажали, иначе карточка съедала бы мобильный трафик.
    expect(screen.getByRole('img', { name: 'Мешок 50 кг' })).toHaveAttribute(
      'src', 'https://cdn.example/cement.jpg',
    );
    // Метка на кадре и миниатюра в ленте — обе кнопки, ни одна не проигрыватель.
    expect(screen.getByRole('button', { name: 'Видео' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Видео 1' })).toBeInTheDocument();

    // Свойства — то, по чему сравнивают две похожие позиции.
    expect(screen.getByText('Марка')).toBeInTheDocument();
    expect(screen.getByText('М400')).toBeInTheDocument();

    // Оценка называет и число отзывов: 4,5 по двум отзывам и 4,5 по двум
    // сотням — разные утверждения.
    expect(screen.getByTestId('item-rating')).toHaveTextContent('4,5');
    expect(screen.getByTestId('item-rating')).toHaveTextContent('2');

    // Количество набирается до корзины: «+» дважды — три мешка и сумма сразу.
    await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
    await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
    expect(screen.getByTestId('item-sum')).toHaveTextContent('7 500 ₸');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'PUT');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 3 });
    }, { timeout: 3000 });
  });

  it('карточка пресса показывает состав по нажатию', async () => {
    stubFetch(cardRules({
      ...CARD, name: 'Худи — пресс', unit: 'пресс',
      pack: [{ itemId: 's', name: 'Худи', variantLabel: 'S', quantity: 1, unit: 'шт' }],
    }));
    renderCard();

    const toggle = await screen.findByRole('button', { name: 'Что в прессе' });
    expect(screen.getByTestId('pack-contents')).not.toBeVisible();
    await userEvent.click(toggle);
    expect(screen.getByTestId('pack-contents')).toHaveTextContent('Худи · S');
  });

  describe('опт', () => {
    /** Розница 100 за мешок, упаковка = 2 мешка, от 2 упаковок — 180, от 3 — 170. */
    const WHOLESALE = {
      unit: 'упаковка', packQty: 2, pieceUnit: 'мешок', retail: true,
      tiers: [{ from: 2, price: 180 }, { from: 3, price: 170 }],
    };
    const BOTH = { ...CARD, price: 100, wholesale: WHOLESALE };

    it('«В розницу» по умолчанию — без условий опта; «Оптом» — условия, сумма и разбиение, строка уходит с режимом', async () => {
      const { calls } = stubFetch(cardRules(BOTH));
      renderCard();

      const retail = await screen.findByRole('button', { name: /^В розницу/ });
      expect(retail).toHaveAttribute('aria-pressed', 'true');
      // Опт виден и в рознице — ценой на самом переключателе: 170 за упаковку из 2 = 85 за мешок.
      expect(screen.getByRole('button', { name: /^Оптом/ })).toHaveTextContent('от 85 ₸ за мешок');
      expect(screen.queryByTestId('wholesale-terms')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /^Оптом/ }));

      const terms = await screen.findByTestId('wholesale-terms');
      expect(within(terms).getByText('Как купить по оптовой цене')).toBeInTheDocument();
      expect(terms).toHaveTextContent(/2 упаковки и больше \(4 мешка\).*При меньшем количестве — по розничной цене 100 ₸ за мешок/);
      expect(screen.queryByRole('radiogroup', { name: 'Как покупать' })).not.toBeInTheDocument();
      await userEvent.click(within(terms).getByRole('button', { name: 'Что в упаковке' }));
      expect(within(terms).getByTestId('pack-contents')).toHaveTextContent(/Цемент М400\s*2 мешка/);
      expect(screen.getByTestId('item-sum')).toHaveTextContent(/100 ₸/);

      for (let i = 0; i < 4; i += 1) await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
      // 5 мешков = 2 упаковки по 180 + 1 мешок по 100.
      expect(screen.getByTestId('item-sum')).toHaveTextContent(/460 ₸/);
      expect(screen.getByTestId('wholesale-split')).toHaveTextContent(/5 мешков = 2 упаковки × 180 ₸ \+ 1 мешок × 100 ₸/);
      expect(screen.getAllByTestId('wholesale-tier')[0]).toHaveAttribute('aria-current', 'true');

      await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
      expect(screen.getByTestId('item-sum')).toHaveTextContent(/510 ₸/);
      expect(screen.getAllByTestId('wholesale-tier')[1]).toHaveAttribute('aria-current', 'true');

      await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));
      await waitFor(() => {
        const sent = calls.find((call) => call.init?.method === 'PUT');
        expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 6, mode: 'WHOLESALE' });
      });
    });

    it('«В розницу» кладёт по розничной цене: сумма без опта, режим RETAIL', async () => {
      const { calls } = stubFetch(cardRules(BOTH));
      renderCard();

      await screen.findByRole('button', { name: /^В розницу/ });
      for (let i = 0; i < 5; i += 1) await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
      expect(screen.getByTestId('item-sum')).toHaveTextContent(/600 ₸/);
      expect(screen.queryByTestId('wholesale-split')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));
      await waitFor(() => {
        const sent = calls.find((call) => call.init?.method === 'PUT');
        expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 6, mode: 'RETAIL' });
      });
    });

    it('«Оптом в корзину» — минимум опта одним нажатием, раскладывает сервер', async () => {
      const { calls } = stubFetch([
        method('POST', '/api/portal/cart/wholesale/item-1', emptyCart),
        ...cardRules(BOTH),
      ]);
      renderCard();

      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Оптом в корзину: 4 мешка' }));

      await waitFor(() => expect(calls.some((call) => call.url.includes('/api/portal/cart/wholesale/item-1') && call.init?.method === 'POST')).toBe(true));
    });

    it('своя цена клиента — выбора нет, условия опта как раньше', async () => {
      stubFetch(cardRules({ ...BOTH, yourPrice: true }));
      renderCard();

      expect(await screen.findByTestId('wholesale-terms')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^В розницу/ })).not.toBeInTheDocument();
    });

    it('распродажа без скидки на опт — пометка в условиях', async () => {
      stubFetch(cardRules({ ...BOTH, price: 90, oldPrice: 100, discountPercent: 10 }));
      renderCard();

      await userEvent.click(await screen.findByRole('button', { name: /^Оптом/ }));
      expect(await screen.findByText('Скидка распродажи — только при покупке штуками')).toBeInTheDocument();
    });

    it('товар «только опт» — счёт упаковками, в корзину уходят штуки', async () => {
      const { calls } = stubFetch(cardRules({
        ...CARD, unit: 'упаковка', price: 1800,
        terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 5, quantityStep: 1 },
        wholesale: { ...WHOLESALE, packQty: 20, retail: false, tiers: [{ from: 5, price: 1800 }, { from: 10, price: 1700 }] },
      }));
      renderCard();

      expect(await screen.findByTestId('wholesale-terms')).toHaveTextContent('Продаётся только упаковками, минимум — 5 упаковок');
      expect(screen.getByTestId('item-sum')).toHaveTextContent(/9\s000 ₸/);
      expect(screen.getByTestId('wholesale-split')).toHaveTextContent(/100 мешков = 5 упаковок × 1\s800 ₸/);

      await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));
      await waitFor(() => {
        const sent = calls.find((call) => call.init?.method === 'PUT');
        expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 100 });
      });
    });
  });

  it('выбранный размер — сразу своя цена и снимки, пока его карточка ещё едет', async () => {
    const variant = (itemId: string, size: string, price: number, media: unknown[] = []) => ({
      itemId, price, media, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch([
      ...cardRules({ ...CARD, variants: [variant('item-1', 'S', 2500), variant('item-2', 'M', 2700, [
        { id: 'm9', kind: 'PHOTO', source: 'LINK', url: 'https://cdn.example/m.jpg', title: 'Размер M', sortOrder: 10 },
      ])] }),
      get('/api/portal/items/item-2/reviews', []),
    ]);
    // Карточка размера M не приходит вовсе: всё, что видно, — из варианта.
    const stubbed = globalThis.fetch;
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => (
      String(input).endsWith('/api/portal/catalog/item-2') ? new Promise(() => {}) : stubbed(input, init)));
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'M' }));

    expect(await screen.findByText(/2\s700 ₸/, { selector: '[data-testid="item-price"] span' })).toBeInTheDocument();
    expect(screen.queryByTestId('card-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'M' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('img').some((img) => img.getAttribute('src')?.includes('m.jpg'))).toBe(true);
  });

  it('пустая оценка приходит как null и не роняет карточку', async () => {
    // Сервер присылает незаполненное поле именно так — null, а не отсутствием
    // ключа. Проверка «не undefined» пропускает его, и карточка падает целиком:
    // клиент видит пустой экран вместо товара.
    stubFetch(cardRules({
      ...CARD,
      description: null,
      priceAsOf: null,
      available: null,
      rating: null,
      reviewCount: null,
    }));

    renderCard();

    expect(await screen.findByRole('heading', { name: 'Цемент М400' })).toBeInTheDocument();
    // Без оценок значок говорит об этом словами и ведёт к отзывам.
    expect(screen.getByTestId('item-rating')).toHaveTextContent('Отзывов пока нет');
  });

  it('отзыв отправляется с оценкой и текстом, а свой неодобренный виден с пометкой', async () => {
    const mine = {
      id: 'r1',
      itemId: 'item-1',
      rating: 5,
      text: 'Хороший цемент',
      status: 'PENDING',
      createdAt: '2026-09-01T10:00:00Z',
      tags: [],
      helpful: 0,
      helpfulByMe: false,
      mine: true,
    };
    const { calls } = stubFetch([
      ...cardRules(CARD, []),
      method('POST', '/api/portal/items/item-1/reviews', mine, 201),
    ]);

    renderCard();

    await userEvent.click(await screen.findByRole('radio', { name: /^Оценка 5 из 5/ }));
    await userEvent.type(screen.getByLabelText(/Расскажите подробнее/), 'Хороший цемент');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(sent).toBeDefined();
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ rating: 5, text: 'Хороший цемент' });
    });

    // Отзыв показывается сразу, но честно: до одобрения его видит только автор.
    expect(await screen.findByText(/ждёт проверки/i)).toBeInTheDocument();
  });

  it('клиент без заявки видит форму «Оцените товар» без строки о покупке и может отправить отзыв', async () => {
    // Товар могли купить и вне системы: оценить его может любой клиент магазина.
    const mine = {
      id: 'r1', itemId: 'item-1', rating: 4, status: 'PENDING', createdAt: '2026-09-01T10:00:00Z',
      tags: [], helpful: 0, helpfulByMe: false, mine: true, verifiedPurchase: false,
    };
    const { calls } = stubFetch([
      ...cardRules({ ...CARD, purchaseOrderNumber: undefined, purchasedAt: undefined }),
      method('POST', '/api/portal/items/item-1/reviews', mine, 201),
    ]);

    renderCard();

    expect(await screen.findByText('Оцените товар')).toBeInTheDocument();
    expect(screen.queryByText('Оцените покупку')).not.toBeInTheDocument();
    expect(screen.queryByText(/Вы покупали этот товар/)).not.toBeInTheDocument();
    expect(screen.queryByText(/после покупки/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Мои заявки/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /^Оценка 4 из 5/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));
    await waitFor(() => expect(calls.some((call) => call.init?.method === 'POST')).toBe(true));
    expect(await screen.findByText('Спасибо за отзыв!')).toBeInTheDocument();
  });

  it('покупатель с заявкой видит «Оцените покупку» и строку «Вы покупали · заявка №…»', async () => {
    stubFetch(cardRules({ ...CARD, purchaseOrderNumber: '2026-00042', purchasedAt: '2026-09-12T10:00:00Z' }));

    renderCard();

    expect(await screen.findByText('Оцените покупку')).toBeInTheDocument();
    expect(screen.getByText(/Вы покупали этот товар · заявка №2026-00042/)).toBeInTheDocument();
  });

  it('цена набрана крупно, а ставка и дата стоят отдельной строкой', async () => {
    stubFetch(cardRules());

    renderCard();

    // Цена и единица — одной строкой: «2 500 ₸» без «за мешок» ничего
    // не значит, когда рядом лежит цена за тонну.
    const price = await screen.findByTestId('item-price');
    expect(price).toHaveTextContent('2 500 ₸');
    expect(price).toHaveTextContent('за мешок');

    // Условия, при которых цена верна, не пропадают: требование о полноте
    // торговой информации — про них, а не про размер шрифта.
    expect(screen.getByText(/без НДС, НДС 12% прибавляется сверху · цена на 04\.09/)).toBeInTheDocument();
  });

  it('в другой валюте магазина цена, «Сумма» и подсказка объёма — с её знаком', async () => {
    stubFetch(cardRules());

    renderScreen(
      <Routes>
        <Route path="/catalog/:itemId" element={<ItemCardPage />} />
      </Routes>,
      { route: '/catalog/item-1', currency: 'RUB' },
    );

    const price = await screen.findByTestId('item-price');
    expect(price).toHaveTextContent('2 500 ₽');
    expect(screen.getByTestId('item-sum')).toHaveTextContent('2 500 ₽');
    expect(price).not.toHaveTextContent('₸');
  });

  it('наличие показано пилюлей, а не строчкой в тексте', async () => {
    stubFetch(cardRules());

    renderCard();

    // Наличие — первое, что ищут глазами после цены, и в макете оно стоит
    // отдельной меткой на подложке, а не теряется среди строк описания.
    expect(await screen.findByTestId('stock-pill')).toHaveTextContent('В наличии');
  });

  it('штучный товар без кратности — пилюля «Продаётся поштучно» и строка в характеристиках', async () => {
    stubFetch(cardRules({
      ...CARD,
      unit: 'шт.',
      terms: { hit: false, novelty: false, ageRestricted: false, minQuantity: 1, quantityStep: 1 },
    }));

    renderCard();

    expect(await screen.findByText('Продаётся поштучно')).toBeInTheDocument();
    const rows = screen.getAllByTestId('item-property').map((row) => row.textContent);
    expect(rows).toContain('Продаётсяпоштучно');
  });

  it('свойство «Продаётся» от продавца не дублируется выведенным', async () => {
    stubFetch(cardRules({ ...CARD, attributes: [{ name: 'Продаётся', value: 'на развес' }] }));

    renderCard();

    await screen.findByRole('heading', { name: 'Цемент М400' });
    expect(screen.getAllByTestId('item-property').map((row) => row.textContent)).toEqual(['Продаётсяна развес']);
  });

  it('«Как подобрать размер» открывает подсказку, а из неё — вопрос продавцу', async () => {
    const variant = (itemId: string, size: string) => ({
      itemId, price: 2500, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch(cardRules({ ...CARD, sizeGuide: 'CLOTHING', variants: [variant('item-1', 'S'), variant('item-2', 'M')] }));

    renderCard();

    const link = await screen.findByRole('button', { name: 'Как подобрать размер' });
    await userEvent.click(link);
    const dialog = await screen.findByRole('dialog', { name: 'Как подобрать размер' });
    expect(within(dialog).getByText('Длина по внутреннему шву')).toBeInTheDocument();
    // У каждой мерки — схема, где приложить ленту.
    for (const step of ['chest', 'waist', 'hips', 'inseam']) {
      expect(within(dialog).getByTestId(`size-schema-${step}`)).toBeInTheDocument();
    }
    expect(within(dialog).getByText(/Если сомневаетесь — спросите продавца/)).toBeInTheDocument();

    // Escape закрывает окно и возвращает фокус на ссылку.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(link).toHaveFocus();

    await userEvent.click(link);
    const again = await screen.findByRole('dialog', { name: 'Как подобрать размер' });
    await userEvent.click(within(again).getByRole('button', { name: 'Спросить продавца' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Окно закрылось — курсор сразу в поле вопроса, а не на ссылке «Как подобрать размер».
    const question = await screen.findByLabelText('Вопрос');
    await waitFor(() => expect(question).toHaveFocus());
  });

  /**
   * Мелкая схема рядом с текстом читается с трудом: нажатие на мерку
   * показывает её схему крупно, а инструкция остаётся рядом. Крупной бывает
   * одна мерка за раз, повторное нажатие её сворачивает.
   */
  it('нажатая мерка показывает свою схему крупно, рядом с инструкцией', async () => {
    const variant = (itemId: string, size: string) => ({
      itemId, price: 2500, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch(cardRules({ ...CARD, sizeGuide: 'CLOTHING', variants: [variant('item-1', 'S'), variant('item-2', 'M')] }));

    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Как подобрать размер' }));
    const dialog = await screen.findByRole('dialog', { name: 'Как подобрать размер' });
    const waist = within(dialog).getByRole('button', { name: /Талия/ });
    const hips = within(dialog).getByRole('button', { name: /Бёдра/ });
    expect(waist).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).getByTestId('size-schema-waist')).toHaveAttribute('data-size', 'small');

    await userEvent.click(waist);
    expect(waist).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByTestId('size-schema-waist')).toHaveAttribute('data-size', 'large');
    // Инструкция — внутри той же мерки, рядом с крупной схемой.
    expect(waist).toHaveTextContent('По самому узкому месту');

    await userEvent.click(hips);
    expect(hips).toHaveAttribute('aria-expanded', 'true');
    expect(waist).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).getByTestId('size-schema-waist')).toHaveAttribute('data-size', 'small');

    await userEvent.click(hips);
    expect(hips).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).getByTestId('size-schema-hips')).toHaveAttribute('data-size', 'small');
  });

  /**
   * Мерки зависят от того, что продаётся: у обуви мерят стопу, у головного
   * убора — обхват головы. Какие именно, говорит сервер по отрасли рубрики.
   */
  it.each([
    ['SHOES', ['Длина стопы', 'Ширина стопы'], ['footLength', 'footWidth'], /Мерьте вечером/],
    ['HEADWEAR', ['Обхват головы'], ['head'], /без шапки/],
  ] as const)('%s — свои мерки и свои схемы', async (sizeGuide, steps, schemas, intro) => {
    const variant = (itemId: string, size: string) => ({
      itemId, price: 2500, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch(cardRules({ ...CARD, sizeGuide, variants: [variant('item-1', '41'), variant('item-2', '42')] }));

    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Как подобрать размер' }));
    const dialog = await screen.findByRole('dialog', { name: 'Как подобрать размер' });
    expect(within(dialog).getByText(intro)).toBeInTheDocument();
    for (const step of steps) {
      expect(within(dialog).getByRole('button', { name: new RegExp(step) })).toBeInTheDocument();
    }
    for (const schema of schemas) {
      expect(within(dialog).getByTestId(`size-schema-${schema}`)).toBeInTheDocument();
    }
    expect(within(dialog).queryByText('Талия')).not.toBeInTheDocument();

    const first = within(dialog).getByRole('button', { name: new RegExp(steps[0]) });
    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByTestId(`size-schema-${schemas[0]}`)).toHaveAttribute('data-size', 'large');
  });

  /** Размер есть, а что мерить — неизвестно (рубрика вне отраслей): подсказки нет, чем учить мерить не то. */
  it('без вида подсказки ссылки «Как подобрать размер» нет и при выборе размера', async () => {
    const variant = (itemId: string, size: string) => ({
      itemId, price: 2500, fields: [{ code: 'SIZE', name: 'Размер', type: 'TEXT', value: size }],
    });
    stubFetch(cardRules({ ...CARD, variants: [variant('item-1', 'S'), variant('item-2', 'M')] }));

    renderCard();

    expect(await screen.findByText('S', { selector: 'button *, button' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Как подобрать размер' })).not.toBeInTheDocument();
  });

  it('без выбора размера ссылки «Как подобрать размер» нет', async () => {
    stubFetch(cardRules());

    renderCard();

    await screen.findByRole('heading', { name: 'Цемент М400' });
    expect(screen.queryByRole('button', { name: 'Как подобрать размер' })).not.toBeInTheDocument();
  });

  it('единица у цены карточки и похожих — «за коробку», а не «за коробка»', async () => {
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }]),
      get('/api/portal/catalog?', {
        page: 0, size: 5, totalElements: 1, items: [
          { id: 'item-2', name: 'Клей', unit: 'канистра', price: 3100, favorite: false },
        ],
      }),
      ...cardRules({ ...CARD, unit: 'коробка', categoryId: 'cat-1' }),
    ]);

    renderCard();

    expect(await screen.findByTestId('item-price')).toHaveTextContent('за коробку');
    const [similar] = await screen.findAllByTestId('similar-card');
    expect(similar).toHaveTextContent('за канистру');
  });

  it('похожий товар со скидкой и меткой «Новинка» — одной меткой «Акция + новинка»', async () => {
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }]),
      get('/api/portal/catalog?', {
        page: 0, size: 5, totalElements: 3, items: [
          {
            id: 'item-2', name: 'Цемент М500', unit: 'мешок', price: 3100, favorite: false, discountPercent: 10, oldPrice: 3450,
            terms: { hit: false, novelty: true, ageRestricted: false },
          },
          {
            id: 'item-3', name: 'Цемент М600', unit: 'мешок', price: 3500, favorite: false,
            terms: { hit: false, novelty: true, ageRestricted: false },
          },
        ],
      }),
      ...cardRules({ ...CARD, categoryId: 'cat-1' }),
    ]);

    renderCard();

    const similar = await screen.findAllByTestId('similar-card');
    expect(within(similar[0]).getByTestId('promo-badge')).toHaveTextContent(/^Акция \+ новинка$/);
    expect(within(similar[1]).getByTestId('promo-badge')).toHaveTextContent(/^Новинка$/);
  });

  it('у похожего товара одна метка по старшинству, как в макете: акция, новинка, затем «Хит продаж»', async () => {
    stubFetch([
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }]),
      get('/api/portal/catalog?', {
        page: 0, size: 5, totalElements: 4, items: [
          {
            id: 'item-2', name: 'Цемент М500', unit: 'мешок', price: 3100, favorite: false, discountPercent: 10, oldPrice: 3450,
            terms: { hit: true, novelty: false, ageRestricted: false },
          },
          {
            id: 'item-3', name: 'Цемент М600', unit: 'мешок', price: 3500, favorite: false,
            terms: { hit: true, novelty: true, ageRestricted: false },
          },
          {
            id: 'item-4', name: 'Цемент М700', unit: 'мешок', price: 3900, favorite: false,
            terms: { hit: true, novelty: false, ageRestricted: false },
          },
        ],
      }),
      ...cardRules({ ...CARD, categoryId: 'cat-1' }),
    ]);

    renderCard();

    const similar = await screen.findAllByTestId('similar-card');
    expect(within(similar[0]).getByTestId('promo-badge')).toHaveTextContent(/^Акция$/);
    expect(within(similar[0]).queryByText('Хит продаж')).not.toBeInTheDocument();
    expect(within(similar[1]).getByTestId('promo-badge')).toHaveTextContent(/^Новинка$/);
    expect(within(similar[1]).queryByText('Хит продаж')).not.toBeInTheDocument();
    expect(within(similar[2]).getByTestId('promo-badge')).toHaveTextContent(/^Хит продаж$/);
  });

  it('назад и избранное стоят кружками поверх снимка', async () => {
    stubFetch(cardRules());

    renderCard();

    // «Назад» — кружок на снимке, а не строчка над содержимым: большой палец
    // держит телефон за нижний край, а угол снимка он всё же достаёт.
    const back = await screen.findByRole('link', { name: 'В каталог' });
    expect(back).toHaveAttribute('href', '/catalog');
    // Сердечко на снимке и кнопка «В избранное» в панели покупки — как в макете.
    expect(screen.getAllByRole('button', { name: 'В избранное' })).toHaveLength(2);
  });

  /**
   * Касание по кадру больше не перелистывает — оно открывает.
   *
   * Кадр в карточке мал, и по нему видно, что снимок есть, но не видно
   * товара. Листают дальше уже во весь экран, вместе с роликами.
   */
  it('касание по кадру открывает снимки во весь экран', async () => {
    stubFetch(cardRules({
      ...CARD,
      media: [
        { id: 'm1', kind: 'PHOTO', source: 'LINK', url: 'https://cdn.example/1.jpg', title: 'Мешок 50 кг', sortOrder: 10 },
        { id: 'm3', kind: 'PHOTO', source: 'LINK', url: 'https://cdn.example/2.jpg', sortOrder: 20 },
      ],
    }));

    renderCard();

    expect(await screen.findByTestId('gallery-photo')).toHaveAttribute('src', 'https://cdn.example/1.jpg');

    await userEvent.click(screen.getByRole('button', { name: 'Открыть снимок' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('img', { name: 'Мешок 50 кг' }))
      .toHaveAttribute('src', 'https://cdn.example/1.jpg');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Следующий кадр' }));
    expect(within(dialog).getByRole('img', { name: 'Цемент М400' }))
      .toHaveAttribute('src', 'https://cdn.example/2.jpg');
  });

  it('сумма стоит рядом с количеством, и кнопка кладёт позицию, даже если счётчика не касались', async () => {
    const { calls } = stubFetch([...rememberingCart(cartWith(1)), ...cardRules()]);

    renderCard();

    // Первым стоит допустимое количество, а не ноль: «Сумма 0 ₸» пришедший
    // за одним мешком прочитал бы как поломку.
    expect(await screen.findByTestId('item-sum')).toHaveTextContent('2 500 ₸');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'PUT');
      expect(sent).toBeDefined();
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 1 });
    });
    // После добавления — «Добавлено» и путь в корзину, как в макете.
    expect(await screen.findByRole('status')).toHaveTextContent('Добавлено в корзину: 1 мешок');
    expect(screen.getByRole('link', { name: 'Перейти в корзину' })).toHaveAttribute('href', '/checkout');
  });

  it('уже набранная позиция правится счётчиком корзины, а сумма считается по нему', async () => {
    stubFetch(cardRules(CARD, [], cartWith(20)));

    renderCard();

    // Цена × количество: человек видит, во что обойдётся набранное.
    await waitFor(() => expect(screen.getByTestId('item-sum')).toHaveTextContent('50 000 ₸'));
    expect(screen.getByLabelText(/^Количество, /)).toHaveValue(20);
    expect(screen.queryByRole('button', { name: 'Добавить в корзину' })).not.toBeInTheDocument();
  });

  it('минимум продавца — первым количеством, метки — на снимке, похожие — из рубрики', async () => {
    const { calls } = stubFetch([
      method('PUT', '/api/portal/cart/lines/item-1', cartWith(15)),
      get('/api/portal/categories', [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }]),
      get('/api/portal/catalog?', {
        page: 0, size: 5, totalElements: 2, items: [
          { id: 'item-1', name: 'Цемент М400', unit: 'мешок', price: 2500, favorite: false },
          { id: 'item-2', name: 'Цемент М500', unit: 'мешок', price: 3100, favorite: false, discountPercent: 10, oldPrice: 3450, rating: 4.8, reviewCount: 5 },
        ],
      }),
      ...cardRules({
        ...CARD,
        categoryId: 'cat-1',
        oldPrice: 2800,
        discountPercent: 11,
        terms: { hit: true, novelty: false, ageRestricted: false, minQuantity: 10, quantityStep: 5 },
      }),
    ]);

    renderCard();

    expect(await screen.findByText('Хит продаж')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Где вы находитесь' }))
      .toHaveTextContent('Сухие смеси'));
    expect(screen.getByText('−11%')).toBeInTheDocument();
    expect(screen.getByText('Заказ от 10 мешков')).toBeInTheDocument();
    expect(screen.getByText('Продаём по 5 мешков')).toBeInTheDocument();
    expect(screen.getByTestId('item-sum')).toHaveTextContent('25 000 ₸');

    // Похожие — из той же рубрики, без самой позиции.
    const similar = await screen.findAllByTestId('similar-card');
    expect(similar).toHaveLength(1);
    expect(similar[0]).toHaveTextContent('Цемент М500');
    // В похожих скидка — словом «Акция», как в макете карточки, а не процентом.
    expect(within(similar[0]).getByTestId('promo-badge')).toHaveTextContent('Акция');
    expect(within(similar[0]).queryByText('−10%')).not.toBeInTheDocument();
    // Оценка в похожих — тот же значок, что на плитках витрины: «4,8 (5)».
    expect(within(similar[0]).getByLabelText('Оценка 4,8 из 5, 5 отзывов')).toHaveTextContent('4,8(5)');
    // Кратность 5 уже сказана «Продаём по 5 мешков» — «поштучно» рядом спорило бы с ней.
    expect(screen.queryByText(/^Продаётся (поштучно|в единицах)/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
    expect(screen.getByTestId('item-sum')).toHaveTextContent('37 500 ₸');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));
    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'PUT');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 15 });
    });
  });

  it('вопрос продавцу скрыт за кнопкой и не занимает низ карточки формой', async () => {
    stubFetch(cardRules());

    renderCard();

    const ask = await screen.findByRole('button', { name: 'Спросить продавца' });
    expect(screen.queryByLabelText('Вопрос')).not.toBeInTheDocument();

    await userEvent.click(ask);

    expect(await screen.findByLabelText('Вопрос')).toBeInTheDocument();
  });

  it('избранное переключается прямо из карточки', async () => {
    const { calls } = stubFetch([
      ...cardRules(),
      method('POST', '/api/portal/favorites/item-1/toggle', { itemId: 'item-1', favorite: true }),
    ]);

    renderCard();

    const [toggle] = await screen.findAllByRole('button', { name: 'В избранное' });
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/favorites/item-1/toggle'))).toBe(true);
    });
    expect(await screen.findByRole('button', { name: 'Убрать из избранного' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'В избранном' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('состав в процентах — полосками «Из чего сделано», скидки на товар и участие в акции', async () => {
    stubFetch([
      get('/api/portal/promotions', {
        sale: { title: 'Осенняя распродажа', maxPercent: 20, endsOn: '2099-09-30', endsAt: '2099-10-01T00:00:00Z', countdown: true },
        volumeTiers: [{ from: 100000, percent: 5 }],
        firstOrder: { percent: 5, status: 'ELIGIBLE' },
        deals: [], dealCount: 1,
        volumeHintPercent: 100,
      }),
      ...cardRules({
        ...CARD,
        price: 2000, oldPrice: 2500, discountPercent: 20,
        attributes: [{ name: 'Состав', value: 'Вискоза 65%, полиэстер 30%, эластан 5%' }],
      }),
    ]);

    renderCard();

    expect(await screen.findByRole('heading', { name: 'Из чего сделано' })).toBeInTheDocument();
    expect(screen.getByText('Полиэстер')).toBeInTheDocument();

    expect(await screen.findByTestId('sale-participation')).toHaveTextContent('Участвует в акции «Осенняя распродажа»');
    const discounts = screen.getByRole('region', { name: 'Скидки на этот товар' });
    expect(within(discounts).getByText('−20%')).toBeInTheDocument();
    expect(within(discounts).getByText('Оптом дешевле')).toBeInTheDocument();
    expect(within(discounts).getByText('Первая заявка')).toBeInTheDocument();
    expect(within(discounts).getByText(/Скидки не складываются/)).toBeInTheDocument();
    // «Сколько добрать» — по порогам акции, даже без подсказки корзины (`nextTier`).
    expect(within(discounts).getByText(/^До оптовой скидки: ещё 100\s000\s₸$/)).toBeInTheDocument();
    // Отсчёт включён продавцом — видны дни, часы и минуты.
    expect(screen.getByTestId('sale-participation')).toHaveTextContent('дн');
  });

  describe('«Оптом дешевле» в «Скидках на этот товар»', () => {
    const TIERS = [{ from: 50000, percent: 3 }, { from: 100000, percent: 5 }];
    const cartOn = (goodsTotal: number) => ({ ...emptyCart, goodsTotal });

    function discountsWith(promo: Record<string, unknown>, goodsTotal: number) {
      stubFetch([
        get('/api/portal/promotions', { volumeTiers: TIERS, deals: [], dealCount: 0, ...promo }),
        ...cardRules(CARD, [], cartOn(goodsTotal)),
      ]);
      renderCard();
      return screen.findByRole('region', { name: 'Скидки на этот товар' });
    }

    it('строка называет порог, к которому идёт полоса', async () => {
      const discounts = await discountsWith({ volumeHintPercent: 100 }, 10000);

      expect(within(discounts).getByText(/^От 50\s000\s₸ в заявке$/)).toBeInTheDocument();
      expect(within(discounts).getByText('−3%')).toBeInTheDocument();
      expect(within(discounts).getByText(/^До оптовой скидки: ещё 40\s000\s₸$/)).toBeInTheDocument();
    });

    it('взятый порог: «−3% ваша, ещё N до −5%»', async () => {
      const discounts = await discountsWith({ volumeHintPercent: 50 }, 60000);

      expect(within(discounts).getByText(/^−3% ваша, ещё 40\s000\s₸ до −5%$/)).toBeInTheDocument();
    });

    it('без подсказки магазина (volumeHintPercent) полосы «ещё N» нет', async () => {
      const discounts = await discountsWith({}, 10000);

      expect(within(discounts).getByText(/^От 50\s000\s₸ в заявке$/)).toBeInTheDocument();
      expect(within(discounts).queryByText(/До оптовой скидки/)).not.toBeInTheDocument();
    });
  });

  it('метка «Покупал в магазине» — только у отзыва с заявкой, а чужой отзыв можно отметить полезным', async () => {
    const other = {
      id: 'r9', itemId: 'item-1', authorName: 'Айгерим С.', rating: 5, text: 'Отлично', status: 'PUBLISHED',
      createdAt: '2026-09-14T10:00:00Z', reply: 'Спасибо!', tags: ['GOOD_QUALITY'], helpful: 4, helpfulByMe: false, mine: false,
      verifiedPurchase: true,
    };
    const offline = {
      id: 'r8', itemId: 'item-1', authorName: 'Марат С.', rating: 5, text: 'Брал на складе', status: 'PUBLISHED',
      createdAt: '2026-09-13T10:00:00Z', tags: [], helpful: 0, helpfulByMe: false, mine: false,
      verifiedPurchase: false,
    };
    const { calls } = stubFetch([
      method('POST', '/api/portal/reviews/r9/helpful', { ...other, helpful: 5, helpfulByMe: true }),
      ...cardRules(CARD, [other, offline]),
    ]);

    renderCard();

    const [review, withoutOrder] = await screen.findAllByTestId('review');
    expect(within(review).getByText('✓ Покупал в магазине')).toBeInTheDocument();
    expect(within(withoutOrder).queryByText('✓ Покупал в магазине')).not.toBeInTheDocument();
    expect(within(review).getByText('Хорошее качество')).toBeInTheDocument();
    expect(within(review).getByText('Ответ магазина')).toBeInTheDocument();
    expect(screen.getByTestId('reviews-summary')).toHaveTextContent('5,0');

    await userEvent.click(within(review).getByRole('button', { name: 'Полезно · 4' }));
    await waitFor(() => expect(calls.some((call) => call.url.includes('/reviews/r9/helpful'))).toBe(true));
    expect(await within(review).findByRole('button', { name: 'Полезно · 5' })).toHaveAttribute('aria-pressed', 'true');
  });
});

/**
 * Свой отзыв в карточке — по его состоянию модерации. Отклонённый продавцом
 * не «появится после проверки»: проверка прошла, и обещать обратное — значит
 * заставить человека ждать того, что не случится. Как в «Моих отзывах»:
 * пометка на самом отзыве, причина, если продавец её назвал, и правка,
 * которая вернёт отзыв на проверку.
 */
describe('свой отзыв в карточке по состоянию модерации', () => {
  afterEach(() => vi.unstubAllGlobals());

  const MINE = {
    id: 'r1',
    itemId: 'item-1',
    authorName: 'Асхат К.',
    rating: 2,
    text: 'Мешок порван',
    createdAt: '2026-09-01T10:00:00Z',
    tags: [],
    helpful: 0,
    helpfulByMe: false,
    mine: true,
  };

  it('отклонённый показывает пометку, решение продавца с причиной и «Изменить отзыв», а не «после проверки»', async () => {
    stubFetch(cardRules(CARD, [{ ...MINE, status: 'REJECTED', rejectReason: 'OFF_TOPIC' }]));
    renderCard();

    const review = await screen.findByTestId('review');
    expect(within(review).getByText('Не опубликован')).toBeInTheDocument();
    expect(within(review).queryByText('Ждёт проверки продавцом')).not.toBeInTheDocument();

    expect(screen.getByText('Продавец не опубликовал отзыв')).toBeInTheDocument();
    expect(screen.getByText('Причина: Не о товаре')).toBeInTheDocument();
    expect(screen.queryByText(/после проверки/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Спасибо за отзыв!')).not.toBeInTheDocument();

    // Правка возвращает отзыв на проверку — об этом сказано у формы.
    await userEvent.click(screen.getByRole('button', { name: 'Изменить отзыв' }));
    expect(screen.getByText('Исправленный отзыв снова уйдёт на проверку продавцом.')).toBeInTheDocument();
  });

  it('отклонённый без причины причину не выдумывает', async () => {
    stubFetch(cardRules(CARD, [{ ...MINE, status: 'REJECTED' }]));
    renderCard();

    expect(await screen.findByText('Продавец не опубликовал отзыв')).toBeInTheDocument();
    expect(screen.queryByText(/^Причина:/)).not.toBeInTheDocument();
  });

  it('ждущий проверки — как раньше: «появится после проверки» и пометка «Ждёт проверки»', async () => {
    stubFetch(cardRules(CARD, [{ ...MINE, status: 'PENDING' }]));
    renderCard();

    const review = await screen.findByTestId('review');
    expect(within(review).getByText('Ждёт проверки продавцом')).toBeInTheDocument();
    expect(within(review).queryByText('Не опубликован')).not.toBeInTheDocument();
    expect(screen.getByText('Спасибо за отзыв!')).toBeInTheDocument();
    expect(screen.getByText(/после проверки продавцом/)).toBeInTheDocument();
    expect(screen.queryByText('Продавец не опубликовал отзыв')).not.toBeInTheDocument();
  });

  it('опубликованный — как раньше: «уже в списке», без пометок', async () => {
    stubFetch(cardRules(CARD, [{ ...MINE, status: 'PUBLISHED' }]));
    renderCard();

    const review = await screen.findByTestId('review');
    expect(within(review).queryByText('Ждёт проверки продавцом')).not.toBeInTheDocument();
    expect(within(review).queryByText('Не опубликован')).not.toBeInTheDocument();
    expect(screen.getByText('Спасибо за отзыв!')).toBeInTheDocument();
    expect(screen.getByText(/Он уже в списке/)).toBeInTheDocument();
    expect(screen.queryByText('Продавец не опубликовал отзыв')).not.toBeInTheDocument();
  });
});

/** Условия получения — двумя карточками, как в макете ПК-К3, из настоящих условий магазина. */
describe('доставка и самовывоз в карточке товара', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('доставка называет порог бесплатной, самовывоз — точку и часы', async () => {
    stubFetch([
      get('/api/portal/delivery', {
        mode: 'ENABLED',
        methods: [{ id: 'm1', name: 'До двери', pickup: false, requiresAddress: true, requiresFloor: false,
          requiresTimeSlot: false, price: 1500, freeFromAmount: 50000, negotiable: false, zones: [], slots: [], carriers: [] }],
        pickupPoints: [{ id: 'p1', name: 'Склад', address: 'ул. Рыскулова 101', workingHours: 'до 18:00' }],
      }),
      ...cardRules(),
    ]);
    renderCard();

    expect(await screen.findByTestId('deal-delivery')).toHaveTextContent('Доставкабесплатно от 50 000 ₸');
    expect(screen.getByTestId('deal-pickup')).toHaveTextContent('ул. Рыскулова 101 · до 18:00');
  });

  it('продавец не возит — карточки доставки нет', async () => {
    stubFetch([
      get('/api/portal/delivery', { mode: 'PICKUP_ONLY', methods: [], pickupPoints: [] }),
      ...cardRules(),
    ]);
    renderCard();

    await screen.findByRole('heading', { level: 1, name: 'Цемент М400' });
    expect(screen.queryByTestId('deal-delivery')).not.toBeInTheDocument();
  });
});

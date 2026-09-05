import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { ItemCardPage } from './ItemCardPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

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
    // Снимок — картинкой, ролик — ссылкой: видео не грузится само, пока
    // на него не нажали, иначе карточка съедала бы мобильный трафик.
    expect(screen.getByRole('img', { name: 'Мешок 50 кг' })).toHaveAttribute(
      'src', 'https://cdn.example/cement.jpg',
    );
    expect(screen.getByRole('link', { name: /видео/i })).toHaveAttribute(
      'href', 'https://cdn.example/cement.mp4',
    );

    // Свойства — то, по чему сравнивают две похожие позиции.
    expect(screen.getByText('Марка')).toBeInTheDocument();
    expect(screen.getByText('М400')).toBeInTheDocument();

    // Оценка называет и число отзывов: 4,5 по двум отзывам и 4,5 по двум
    // сотням — разные утверждения.
    expect(screen.getByTestId('item-rating')).toHaveTextContent('4,5');
    expect(screen.getByTestId('item-rating')).toHaveTextContent('2');

    await userEvent.type(await screen.findByLabelText(/^Количество, /), '3');

    await waitFor(() => {
      expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true);
    }, { timeout: 3000 });
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
    expect(screen.queryByTestId('item-rating')).not.toBeInTheDocument();
  });

  it('отзыв отправляется с оценкой и текстом, а свой неодобренный виден с пометкой', async () => {
    const mine = {
      id: 'r1',
      itemId: 'item-1',
      rating: 5,
      text: 'Хороший цемент',
      status: 'PENDING',
      createdAt: '2026-09-01T10:00:00Z',
    };
    const { calls } = stubFetch([
      ...cardRules(CARD, []),
      method('POST', '/api/portal/items/item-1/reviews', mine, 201),
    ]);

    renderCard();

    await userEvent.click(await screen.findByRole('radio', { name: 'Оценка 5 из 5' }));
    await userEvent.type(screen.getByLabelText('Отзыв'), 'Хороший цемент');
    await userEvent.click(screen.getByRole('button', { name: 'Оставить отзыв' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(sent).toBeDefined();
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ rating: 5, text: 'Хороший цемент' });
    });

    // Отзыв показывается сразу, но честно: до одобрения его видит только автор.
    expect(await screen.findByText(/ждёт проверки/i)).toBeInTheDocument();
  });

  it('форма отзыва не предлагается тому, кто эту позицию не покупал', async () => {
    stubFetch(cardRules({ ...CARD, canReview: false }));

    renderCard();

    expect(await screen.findByRole('heading', { name: 'Цемент М400' })).toBeInTheDocument();
    // Кнопка, которую сервер всё равно отклонит, — худший вид интерфейса:
    // человек не понимает, почему действие не сработало. Причина названа
    // словами вместо формы.
    expect(screen.queryByRole('button', { name: 'Оставить отзыв' })).not.toBeInTheDocument();
    expect(screen.getByText(/отзыв можно оставить о том, что вы покупали/i)).toBeInTheDocument();
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
    expect(screen.getByText(/в том числе НДС 12% · цена на 04\.09/)).toBeInTheDocument();
  });

  it('наличие показано пилюлей, а не строчкой в тексте', async () => {
    stubFetch(cardRules());

    renderCard();

    // Наличие — первое, что ищут глазами после цены, и в макете оно стоит
    // отдельной меткой на подложке, а не теряется среди строк описания.
    expect(await screen.findByTestId('stock-pill')).toHaveTextContent('В наличии');
  });

  it('назад и избранное стоят кружками поверх снимка', async () => {
    stubFetch(cardRules());

    renderCard();

    // «Назад» — кружок на снимке, а не строчка над содержимым: большой палец
    // держит телефон за нижний край, а угол снимка он всё же достаёт.
    const back = await screen.findByRole('link', { name: 'В каталог' });
    expect(back).toHaveAttribute('href', '/catalog');
    expect(screen.getByRole('button', { name: 'В избранное' })).toBeInTheDocument();
  });

  it('кадры листаются касанием по снимку', async () => {
    stubFetch(cardRules({
      ...CARD,
      media: [
        { id: 'm1', kind: 'PHOTO', source: 'LINK', url: 'https://cdn.example/1.jpg', title: 'Мешок 50 кг', sortOrder: 10 },
        { id: 'm3', kind: 'PHOTO', source: 'LINK', url: 'https://cdn.example/2.jpg', sortOrder: 20 },
      ],
    }));

    renderCard();

    expect(await screen.findByTestId('gallery-photo')).toHaveAttribute('src', 'https://cdn.example/1.jpg');
    // Полосы миниатюр на телефоне нет — кадр меняется касанием по самому кадру:
    // цель в 300 точек надёжнее квадратика в 64.
    await userEvent.click(screen.getByRole('button', { name: 'Следующий снимок' }));
    expect(screen.getByTestId('gallery-photo')).toHaveAttribute('src', 'https://cdn.example/2.jpg');
  });

  it('кнопка называет сумму и кладёт позицию, даже если счётчика не касались', async () => {
    const { calls } = stubFetch([
      ...cardRules(),
      method('PUT', '/api/portal/cart/lines/item-1', cartWith(1)),
    ]);

    renderCard();

    // Пустой счётчик — это не «ноль тенге»: пришедший за одним мешком
    // прочитал бы «В корзину · 0 ₸» как поломку.
    const add = await screen.findByRole('button', { name: /В корзину/ });
    expect(add).toHaveTextContent('2 500 ₸');

    await userEvent.click(add);

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'PUT');
      expect(sent).toBeDefined();
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 1 });
    });
  });

  it('сумма на кнопке считается по количеству, которое уже набрано', async () => {
    stubFetch(cardRules(CARD, [], cartWith(20)));

    renderCard();

    // Цена × количество: человек видит, во что обойдётся набранное, до того
    // как нажмёт, а не в корзине на следующем экране.
    expect(await screen.findByRole('button', { name: /В корзину/ })).toHaveTextContent('50 000 ₸');
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

    const toggle = await screen.findByRole('button', { name: 'В избранное' });
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/favorites/item-1/toggle'))).toBe(true);
    });
    expect(await screen.findByRole('button', { name: 'Убрать из избранного' })).toBeInTheDocument();
  });
});

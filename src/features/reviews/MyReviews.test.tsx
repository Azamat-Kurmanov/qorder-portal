import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyReviewsPage } from './MyReviewsPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const PUBLISHED = {
  id: 'r1',
  itemId: 'item-1',
  itemName: 'Цемент М400',
  rating: 5,
  text: 'Мешки целые, привезли вовремя',
  status: 'PUBLISHED',
  createdAt: '2026-09-01T10:00:00Z',
  reply: 'Спасибо, ждём снова.',
  repliedAt: '2026-09-01T12:00:00Z',
};

const REJECTED = {
  id: 'r2',
  itemId: 'item-2',
  itemName: 'Песок мытый',
  rating: 2,
  text: 'Половину привезли мокрой',
  status: 'REJECTED',
  createdAt: '2026-09-02T10:00:00Z',
};

// Сервер намеренно отдаёт отзыв о снятой позиции без наименования —
// вести на карточку, которая не откроется, нет смысла.
const DELISTED = {
  id: 'r3',
  itemId: 'item-3',
  rating: 4,
  text: 'Брали для фундамента, всё подошло',
  status: 'PUBLISHED',
  createdAt: '2026-09-03T10:00:00Z',
};

const AWAITING = {
  itemId: 'item-3',
  itemName: 'Гвозди 100',
  purchasedAt: '2026-09-03T10:00:00Z',
};

// Та же позиция, что и PUBLISHED, но со стороны «купили и не оценили» —
// именно в неё сервер превращает отзыв после удаления.
const AWAITING_ITEM_1 = {
  itemId: 'item-1',
  itemName: 'Цемент М400',
  purchasedAt: '2026-09-01T10:00:00Z',
};

const SAVED_AWAITING_REVIEW = {
  id: 'r3',
  itemId: 'item-3',
  itemName: 'Гвозди 100',
  rating: 4,
  status: 'PENDING',
  createdAt: '2026-09-04T10:00:00Z',
};

describe('мои отзывы', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('показывает свои отзывы во всех состояниях вместе с ответом продавца', async () => {
    stubFetch([
      get('/api/portal/reviews/awaiting', []),
      get('/api/portal/reviews', [REJECTED, PUBLISHED]),
    ]);

    renderScreen(<MyReviewsPage />);

    expect(await screen.findByText('Мешки целые, привезли вовремя')).toBeInTheDocument();
    expect(screen.getByText('Половину привезли мокрой')).toBeInTheDocument();
    // Отклонённый отзыв показывается автору с честной пометкой: спрятанный
    // от него, он неотличим от неотправленного.
    expect(screen.getByText(/отклонён продавцом/i)).toBeInTheDocument();
    expect(screen.getByText(/ответ продавца/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Цемент М400' })).toHaveAttribute(
      'href',
      '/catalog/item-1',
    );
  });

  it('правка уходит по адресу той же позиции и с новой оценкой', async () => {
    const { calls } = stubFetch([
      get('/api/portal/reviews/awaiting', []),
      get('/api/portal/reviews', [PUBLISHED]),
      method('POST', '/api/portal/items/item-1/reviews', { ...PUBLISHED, rating: 3, status: 'PENDING' }, 201),
    ]);

    renderScreen(<MyReviewsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Оценка 3 из 5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(sent?.url).toContain('/api/portal/items/item-1/reviews');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({
        rating: 3,
        text: 'Мешки целые, привезли вовремя',
      });
    });
  });

  it('удаление спрашивает подтверждение и только потом зовёт сервер', async () => {
    const { calls } = stubFetch([
      get('/api/portal/reviews/awaiting', []),
      get('/api/portal/reviews', [PUBLISHED]),
      method('DELETE', '/api/portal/items/item-1/reviews', undefined, 204),
    ]);

    renderScreen(<MyReviewsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
    // Нажатие «Удалить» ничего не удаляет: отзыв пишут один раз, а нажимают
    // мимо — каждый день.
    expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Да, удалить' }));

    await waitFor(() => {
      expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(true);
    });
  });

  it('отзыв о снятой с продажи позиции рисуется без ссылки на карточку', async () => {
    stubFetch([
      get('/api/portal/reviews/awaiting', []),
      get('/api/portal/reviews', [DELISTED]),
    ]);

    renderScreen(<MyReviewsPage />);

    expect(await screen.findByText('Брали для фундамента, всё подошло')).toBeInTheDocument();
    expect(screen.getByText('Позиция снята с продажи')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('пустой список объясняет, зачем раздел, а не показывает пустоту', async () => {
    stubFetch([
      get('/api/portal/reviews/awaiting', []),
      get('/api/portal/reviews', []),
    ]);

    renderScreen(<MyReviewsPage />);

    expect(await screen.findByText(/вы ещё не оценивали/i)).toBeInTheDocument();
  });

  it('купленное без оценки предлагается оценить прямо здесь', async () => {
    const { calls } = stubFetch([
      get('/api/portal/reviews/awaiting', [AWAITING]),
      get('/api/portal/reviews', []),
      method('POST', '/api/portal/items/item-3/reviews', {
        id: 'r3', itemId: 'item-3', itemName: 'Гвозди 100', rating: 4,
        status: 'PENDING', createdAt: '2026-09-04T10:00:00Z',
      }, 201),
    ]);

    renderScreen(<MyReviewsPage />);

    expect(await screen.findByText(/ждут вашей оценки/i)).toBeInTheDocument();
    expect(screen.getByText('Гвозди 100')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Оценка 4 из 5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Оценить' }));

    // Отправлять человека за оценкой обратно в карточку незачем: он дошёл
    // сюда именно затем, чтобы оценить.
    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(sent?.url).toContain('/api/portal/items/item-3/reviews');
    });
  });

  it('когда оценивать нечего, заголовка над пустотой нет', async () => {
    stubFetch([
      get('/api/portal/reviews/awaiting', []),
      get('/api/portal/reviews', [PUBLISHED]),
    ]);

    renderScreen(<MyReviewsPage />);

    await screen.findByText('Мешки целые, привезли вовремя');
    expect(screen.queryByText(/ждут вашей оценки/i)).not.toBeInTheDocument();
  });

  it('после удаления отзыва позиция возвращается в «Ждут вашей оценки»', async () => {
    // Правило захватывается по ссылке: подменяем его тело между действиями
    // теста, чтобы повторный запрос после удаления отвечал уже так, как
    // ответил бы сервер, — позиция снова считается неоценённой.
    // /api/portal/reviews/awaiting — строго раньше /api/portal/reviews:
    // второй адрес — префикс первого, и порядок правил в stubFetch важен.
    const awaitingRule = get('/api/portal/reviews/awaiting', []);
    const reviewsRule = get('/api/portal/reviews', [PUBLISHED]);
    const { calls } = stubFetch([
      awaitingRule,
      reviewsRule,
      method('DELETE', '/api/portal/items/item-1/reviews', undefined, 204),
    ]);

    renderScreen(<MyReviewsPage />);

    await screen.findByText('Мешки целые, привезли вовремя');
    expect(screen.queryByText(/ждут вашей оценки/i)).not.toBeInTheDocument();

    awaitingRule.body = [AWAITING_ITEM_1];
    reviewsRule.body = [];

    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await userEvent.click(screen.getByRole('button', { name: 'Да, удалить' }));

    await waitFor(() => {
      expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(true);
    });

    expect(await screen.findByText(/ждут вашей оценки/i)).toBeInTheDocument();
    expect(screen.getByText('Цемент М400')).toBeInTheDocument();
  });

  it('после отправки оценки из «Ждут вашей оценки» позиция уходит оттуда и появляется в списке отзывов', async () => {
    const awaitingRule = get('/api/portal/reviews/awaiting', [AWAITING]);
    const reviewsRule = get('/api/portal/reviews', []);
    const { calls } = stubFetch([
      awaitingRule,
      reviewsRule,
      method('POST', '/api/portal/items/item-3/reviews', SAVED_AWAITING_REVIEW, 201),
    ]);

    renderScreen(<MyReviewsPage />);

    expect(await screen.findByText(/ждут вашей оценки/i)).toBeInTheDocument();

    awaitingRule.body = [];
    reviewsRule.body = [SAVED_AWAITING_REVIEW];

    await userEvent.click(screen.getByRole('radio', { name: 'Оценка 4 из 5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Оценить' }));

    await waitFor(() => {
      expect(calls.some((call) => call.init?.method === 'POST')).toBe(true);
    });

    await waitFor(() => {
      expect(screen.queryByText(/ждут вашей оценки/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText('Гвозди 100')).toBeInTheDocument();
  });
});

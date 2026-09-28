import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewsBlock } from './ReviewsBlock';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

function review(id: string, rating: number, extra: object = {}) {
  return {
    id, itemId: 'item-1', authorName: 'Покупатель', rating, text: `Отзыв ${id}`, status: 'PUBLISHED',
    createdAt: '2026-09-12T10:00:00Z', tags: [], helpful: 0, helpfulByMe: false, mine: false, ...extra,
  };
}

describe('блок отзывов', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('средняя оценка для диктора — одним знаком после запятой, в записи языка', async () => {
    stubFetch([get('/api/portal/items/item-1/reviews', [review('a', 5), review('b', 4), review('c', 4)])]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview={false} />);

    await screen.findAllByTestId('review');
    expect(within(screen.getByTestId('reviews-summary')).getByLabelText('Оценка 4,3 из 5')).toBeInTheDocument();
  });

  it('после отправки своего отзыва отбор сбрасывается на «Все» — свежий отзыв виден', async () => {
    const mine = review('m', 3, { status: 'PENDING', mine: true, text: 'Мой отзыв' });
    stubFetch([
      get('/api/portal/items/item-1/reviews', [review('a', 5)]),
      method('POST', '/api/portal/items/item-1/reviews', mine, 201),
    ]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview />);

    const filters = await screen.findByRole('group', { name: 'Отбор по оценке' });
    await userEvent.click(within(filters).getByRole('button', { name: /^5 ★/ }));
    expect(within(filters).getByRole('button', { name: /^5 ★/ })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('radio', { name: /^Оценка 3 из 5/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    await waitFor(() => expect(screen.getByText('Мой отзыв')).toBeInTheDocument());
    expect(within(screen.getByRole('group', { name: 'Отбор по оценке' })).getByRole('button', { name: /^Все/ }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('без отзывов звёзды сводки для диктора — «Пока нет оценок», а не «0 из 5»', async () => {
    stubFetch([get('/api/portal/items/item-1/reviews', [])]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview={false} />);

    const summary = await screen.findByTestId('reviews-summary');
    expect(within(summary).getByLabelText('Пока нет оценок')).toBeInTheDocument();
    expect(within(summary).queryByLabelText(/из 5/)).not.toBeInTheDocument();
  });

  it('«Полезно» недоступно — видно по кнопке: бледная и с запрещающим курсором', async () => {
    stubFetch([get('/api/portal/items/item-1/reviews', [review('a', 5, { helpful: 2 })])]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview={false} />);

    const button = await screen.findByRole('button', { name: /Полезно/ });
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
  });
});

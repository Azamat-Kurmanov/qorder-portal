import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ReviewsBlock } from './ReviewsBlock';
import { MyReviewsPage } from './MyReviewsPage';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const PUBLISHED = {
  id: 'r1',
  itemId: 'item-1',
  authorName: 'Асхат К.',
  rating: 5,
  text: 'Мешки целые',
  status: 'PUBLISHED',
  createdAt: '2026-09-12T10:00:00Z',
  tags: [],
  helpful: 2,
  helpfulByMe: false,
  mine: false,
  photos: [],
};

/**
 * Сотрудник магазина в своей витрине отзывов не пишет и не отмечает
 * полезными: сервер отвечает ему отказом и формы не предлагает. Кабинет
 * объясняет, почему формы нет, а «Полезно» показывает только числом.
 */
describe('отзывы глазами сотрудника магазина', () => {
  beforeEach(() => window.sessionStorage.setItem('qo.portal.viewer', 'staff'));
  afterEach(() => {
    window.sessionStorage.removeItem('qo.portal.viewer');
    vi.unstubAllGlobals();
  });

  it('вместо приглашения оценить — пояснение, «Полезно» не нажимается', async () => {
    stubFetch([get('/api/portal/items/item-1/reviews', [PUBLISHED])]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview={false} />);

    await screen.findByTestId('review');
    expect(screen.getByText('Сотрудники магазина не оставляют отзывы')).toBeInTheDocument();
    expect(screen.queryByText(/Оценить товар может любой клиент/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Полезно/ })).toBeDisabled();
  });

  it('клиенту — как раньше: приглашение оценить и живая «Полезно»', async () => {
    window.sessionStorage.removeItem('qo.portal.viewer');
    stubFetch([get('/api/portal/items/item-1/reviews', [PUBLISHED])]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview />);

    await screen.findByTestId('review');
    expect(screen.queryByText('Сотрудники магазина не оставляют отзывы')).not.toBeInTheDocument();
    expect(screen.getByText(/Оценить товар может любой клиент/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Полезно/ })).toBeEnabled();
  });

  it('в «Моих отзывах» у сотрудника нет правки и удаления — сервер их не примет', async () => {
    stubFetch([
      get('/api/portal/reviews/awaiting', []),
      get('/api/portal/reviews', [{ ...PUBLISHED, mine: true, itemName: 'Цемент М400' }]),
    ]);

    renderScreen(<MyReviewsPage />);

    expect(await screen.findByText('Мешки целые')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Изменить' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить' })).not.toBeInTheDocument();
  });
});

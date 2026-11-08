import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { MessagesPage } from './MessagesPage';
import { messageCounts } from './messageCounts';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const note = (kind: string, draftId?: string) => ({ id: `${kind}-${draftId}`, kind, draftId, createdAt: '2026-11-03T10:00:00Z' });

describe('«Сообщения»: сколько нового в каждом разделе', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('раскладывает непрочитанное по заявкам, вопросам и отзывам; долг и акции не считает', () => {
    expect(messageCounts([
      note('RENEGOTIATION', 'o1'), note('ORDER_ANSWERED', 'o1'), note('ACCEPTED', 'o2'),
      note('QUESTION_ANSWERED', 'q1'), note('REVIEW_ANSWERED', 'r1'),
      note('DEBT_PAYMENT_RECEIVED'), note('PROMO_STARTED'),
    ] as never)).toEqual({ orders: 3, questions: 1, reviews: 1, total: 5 });
  });

  it('у разделов — свои числа; прочитанного раздела число не показывает', async () => {
    stubFetch([
      get('/api/portal/notifications', [note('RENEGOTIATION', 'o1'), note('ORDER_ANSWERED', 'o2'), note('QUESTION_ANSWERED', 'q1')]),
      get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'Магазин', currency: 'KZT', reviews: true }]),
    ]);

    renderScreen(<MessagesPage />);

    expect(await screen.findByTestId('messages-count-questions')).toHaveTextContent('1');
    // «Мои заявки» здесь не повторяются: они с числом стоят на «Главной».
    expect(screen.queryByRole('link', { name: /Мои заявки/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('messages-count-orders')).not.toBeInTheDocument();
    expect(screen.queryByTestId('messages-count-reviews')).not.toBeInTheDocument();
  });
});

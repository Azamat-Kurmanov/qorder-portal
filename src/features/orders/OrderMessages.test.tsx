import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderMessages } from './OrderMessages';

/**
 * Лента переписки по заявке — вынесена из карточки списка заявок, чтобы
 * то же самое показывала и страница одной заявки: клиент кабинета видит
 * вопросы и ответы там, где их читает, а не только в списке.
 */
describe('лента переписки по заявке', () => {
  it('лента: клиент справа, продавец слева, подписи', () => {
    render(<OrderMessages messages={[
      { author: 'CUSTOMER', text: 'Размер 44 будет?', createdAt: '2026-09-18T10:00:00Z' },
      { author: 'MANAGER', text: 'Уточняем у поставщика', createdAt: '2026-09-18T11:00:00Z' },
      { author: 'MANAGER', text: 'Будет в понедельник', createdAt: '2026-09-19T09:00:00Z' },
    ]} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveClass('self-end');
    expect(items[1]).toHaveClass('self-start');
    expect(screen.getAllByText(/Магазин ·|Продавец ·/)).toHaveLength(2);
  });

  it('без сообщений ничего не выводит', () => {
    const { container } = render(<OrderMessages messages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

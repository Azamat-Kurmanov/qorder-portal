import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderDelivery } from './OrderDelivery';

// Где открывать карту — не забота этих проверок.
vi.mock('../maps/useMapHome', () => ({ useMapHome: () => null }));

describe('доставка заявки', () => {
  it('способ, адрес, перевозчик с телефоном, кому платить и трек со ссылкой', () => {
    render(<OrderDelivery delivery={{
      methodName: 'Межгород', address: 'Кенесары 1', city: 'Астана', carrierName: 'СДЭК',
      carrierPhone: '+7 727 000 00 00', transportPayee: 'DIRECT', deliverTo: 'DOOR',
      trackingNumber: 'AB123', trackingUrl: 'https://track.example/AB123',
    }} />);

    const block = screen.getByTestId('order-delivery-block');
    expect(block).toHaveTextContent('Межгород');
    expect(block).toHaveTextContent('Астана, Кенесары 1');
    expect(block).toHaveTextContent('СДЭК');
    // Номер — текстом, звонит маленькая кнопка рядом (решение владельца 2026-11-04).
    expect(block).toHaveTextContent('+7 727 000 00 00');
    expect(screen.getByRole('link', { name: 'Позвонить перевозчику' })).toHaveAttribute('href', 'tel:+77270000000');
    expect(block).toHaveTextContent('За перевозку платите перевозчику при получении');
    expect(screen.getByRole('link', { name: /AB123/ })).toHaveAttribute('href', 'https://track.example/AB123');
  });

  it('называет день и окно доставки; без окна — только день', () => {
    const { rerender } = render(<OrderDelivery delivery={{ methodName: 'По городу', date: '2026-10-29', slot: '10:00–14:00' }} />);
    expect(screen.getByTestId('order-delivery-date')).toHaveTextContent('Привезут 29 октября, 10:00–14:00');

    rerender(<OrderDelivery delivery={{ methodName: 'По городу', date: '2026-10-29' }} />);
    expect(screen.getByTestId('order-delivery-date')).toHaveTextContent(/^Привезут 29 октября$/);
  });

  it('без перевозчика — только способ и адрес', () => {
    render(<OrderDelivery delivery={{ methodName: 'По городу', address: 'ул. Абая 1' }} />);

    expect(screen.getByTestId('order-delivery-block')).toHaveTextContent('По городу');
    expect(screen.queryByTestId('order-tracking')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-delivery-date')).not.toBeInTheDocument();
  });
});

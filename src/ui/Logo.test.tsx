import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo, PRODUCT_NAME } from './Logo';

describe('Logo', () => {
  it('по умолчанию подписан именем системы', () => {
    render(<Logo />);

    expect(screen.getByAltText(PRODUCT_NAME)).toBeInTheDocument();
  });

  it('рядом с надписью «FastOrders» знак остаётся без подписи', () => {
    // Иначе экранный читатель произносит имя системы дважды подряд — в шапке
    // кабинета и на экране активации знак стоит именно рядом с надписью.
    render(<Logo decorative />);

    expect(screen.queryByAltText(PRODUCT_NAME)).not.toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute('aria-hidden', 'true');
  });

  it('высота задаётся вызывающим, ширина считается по ней', () => {
    render(<Logo height={40} />);

    expect(screen.getByAltText(PRODUCT_NAME)).toHaveStyle({ height: '40px', width: 'auto' });
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo, PRODUCT_NAME } from './Logo';

describe('Logo', () => {
  it('по умолчанию подписан именем системы', () => {
    render(<Logo />);

    // Изображений два — светлое и тёмное; какое видно, решает CSS
    // по настройке браузера, и подпись обязана быть у обоих.
    const marks = screen.getAllByAltText(PRODUCT_NAME);
    expect(marks).toHaveLength(2);
  });

  it('рядом с надписью «FastOrders» знак остаётся без подписи', () => {
    // Иначе экранный читатель произносит имя системы дважды подряд — в шапке
    // кабинета и на экране активации знак стоит именно рядом с надписью.
    render(<Logo decorative />);

    expect(screen.queryByAltText(PRODUCT_NAME)).not.toBeInTheDocument();
    for (const mark of document.querySelectorAll('img')) {
      expect(mark).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('высота задаётся вызывающим, ширина считается по ней', () => {
    render(<Logo height={40} />);

    for (const mark of screen.getAllByAltText(PRODUCT_NAME)) {
      expect(mark).toHaveStyle({ height: '40px', width: 'auto' });
    }
  });
});

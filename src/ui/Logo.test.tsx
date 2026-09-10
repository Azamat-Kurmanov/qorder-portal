import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo, PRODUCT_NAME } from './Logo';

describe('Logo', () => {
  it('по умолчанию подписан именем системы', () => {
    render(<Logo />);

    expect(screen.getByAltText(PRODUCT_NAME)).toBeInTheDocument();
  });

  /*
   * Знак один, и второго — тёмного — быть не должно.
   *
   * Тёмный вариант тут был и ломал ровно то, ради чего заводился: выбирала
   * его настройка системы (`prefers-color-scheme`), а полотно кабинета
   * от неё не зависит — тёмной темы у кабинета нет. У человека с тёмной
   * системой тёмная плашка знака ложилась на светлую бумагу карточки.
   */
  it('не подменяется по настройке системы: знак один', () => {
    render(<Logo />);

    expect(document.querySelectorAll('img')).toHaveLength(1);
  });

  it('рядом с надписью «Q-Order» знак остаётся без подписи', () => {
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

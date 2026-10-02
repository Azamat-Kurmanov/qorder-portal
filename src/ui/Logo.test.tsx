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
   * системой тёмный знак ложился на светлую бумагу карточки.
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

  it('по умолчанию знак целиком: он стоит там, где стоит один', () => {
    render(<Logo />);

    expect(screen.getByAltText(PRODUCT_NAME)).toHaveAttribute('data-qo-logo-variant', 'full');
  });

  it('рядом с надписью знак берёт другой файл, а не тот же с обрезанным словом', () => {
    // Иначе «Q-Order» читалось бы дважды подряд — картинкой и подписью.
    const full = render(<Logo />).container.querySelector('img');
    const mark = render(<Logo variant="mark" />).container.querySelector('img');

    expect(mark).toHaveAttribute('data-qo-logo-variant', 'mark');
    expect(mark?.getAttribute('src')).not.toBe(full?.getAttribute('src'));
  });

  it('в ожидании знак берёт анимированный файл', () => {
    const still = render(<Logo variant="mark" />).container.querySelector('img');
    const waiting = render(<Logo variant="mark" animated />).container.querySelector('img');

    expect(waiting?.getAttribute('src')).not.toBe(still?.getAttribute('src'));
  });

  it('высота задаётся вызывающим, ширина считается по ней', () => {
    render(<Logo height={40} />);

    expect(screen.getByAltText(PRODUCT_NAME)).toHaveStyle({ height: '40px', width: 'auto' });
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('кнопка', () => {
  it('несёт вариант для вида темы (`liveTheme.css`)', () => {
    render(<Button variant="accent">В корзину</Button>);
    const button = screen.getByRole('button', { name: 'В корзину' });
    expect(button).toHaveClass('qo-btn');
    expect(button).toHaveAttribute('data-variant', 'accent');
    render(<Button>Сохранить</Button>);
    expect(screen.getByRole('button', { name: 'Сохранить' })).toHaveAttribute('data-variant', 'primary');
  });

  it('«идёт отправка» — кружок, подпись остаётся для диктора, второе нажатие не проходит', async () => {
    const click = vi.fn();
    render(<Button busy onClick={click}>Оформить заявку</Button>);
    const button = screen.getByRole('button', { name: 'Оформить заявку' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(button.querySelector('[data-spinner]')).not.toBeNull();
    await userEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });

  it('«готово» — галочка поверх подписи', () => {
    render(<Button done>Отправить отзыв</Button>);
    const button = screen.getByRole('button', { name: 'Отправить отзыв' });
    expect(button).toHaveAttribute('data-done');
    expect(button.querySelector('[data-check]')).not.toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n';
import { pageItems } from './pageItems';
import { Pagination } from './Pagination';

describe('постраничная навигация', () => {
  it('до семи страниц — все номера подряд', () => {
    expect(pageItems(1, 2)).toEqual([1, 2]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('больше семи — первая, последняя, соседи текущей и «…», не больше семи кнопок', () => {
    expect(pageItems(2, 25)).toEqual([1, 2, 3, 4, 5, 'gap', 25]);
    expect(pageItems(12, 25)).toEqual([1, 'gap', 11, 12, 13, 'gap', 25]);
    expect(pageItems(24, 25)).toEqual([1, 'gap', 21, 22, 23, 24, 25]);
  });

  it('пишет диапазон последней неполной страницы и переходит назад', async () => {
    const onPage = vi.fn();
    render(<Pagination page={1} size={10} total={12} onPage={onPage} label="Страницы" />);
    expect(screen.getByText('Показано 11–12 из 12')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Страницы' });
    expect(within(nav).getByRole('button', { name: 'Страница 2' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(nav).getByRole('button', { name: 'Назад' }));
    expect(onPage).toHaveBeenCalledWith(0);
  });

  it('одна страница — навигации нет', () => {
    const { container } = render(<Pagination page={0} size={10} total={7} onPage={() => {}} label="Страницы" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('размер страницы выбирается из списка', async () => {
    const onSize = vi.fn();
    render(<Pagination page={0} size={10} total={40} sizes={[10, 20, 50]} onPage={() => {}} onSize={onSize} label="Страницы" />);
    await userEvent.selectOptions(screen.getByLabelText('На странице'), '20');
    expect(onSize).toHaveBeenCalledWith(20);
  });

  it('выбрав больше на странице, можно вернуться к меньшему, хотя страница одна', () => {
    render(<Pagination page={0} size={20} total={12} sizes={[10, 20, 50]} onPage={() => {}} onSize={() => {}} label="Страницы" />);
    expect(screen.getByLabelText('На странице')).toHaveValue('20');
    expect(screen.queryByRole('navigation', { name: 'Страницы' })).not.toBeInTheDocument();
  });

  it('больше десяти страниц — поле «Перейти к»', async () => {
    const onPage = vi.fn();
    render(<Pagination page={0} size={10} total={248} onPage={onPage} label="Страницы" />);
    await userEvent.type(screen.getByLabelText('Перейти к'), '13{Enter}');
    expect(onPage).toHaveBeenCalledWith(12);
  });
});

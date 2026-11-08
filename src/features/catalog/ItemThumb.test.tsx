import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemThumb } from './ItemThumb';

/** Листание снимков прямо в плитке (решение владельца 2026-10-30). */
describe('снимки в плитке', () => {
  const photos = ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg', 'https://cdn.example/c.jpg'];

  it('точка на каждый снимок; нажатие листает к своему и не открывает карточку', async () => {
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo;
    const open = vi.fn();
    render(<div onClick={open}><ItemThumb itemId="i1" src={photos[0]} photos={photos} /></div>);

    const dots = within(screen.getByRole('group', { name: 'Снимков: 3' })).getAllByRole('button');
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute('aria-current', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Фото 3 из 3' }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(open).not.toHaveBeenCalled();
  });

  it('один снимок — ни ленты, ни точек', () => {
    render(<ItemThumb itemId="i1" src={photos[0]} photos={photos.slice(0, 1)} />);
    expect(screen.queryByTestId('photo-strip')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LineThumb } from './LineThumb';

describe('миниатюра строки', () => {
  it('с адресом показывает настоящий снимок', () => {
    render(<LineThumb seed="item-1" src="https://cdn.example.kz/cement.jpg" />);

    const photo = screen.getByTestId('line-thumb-photo');
    expect(photo.tagName).toBe('IMG');
    expect(photo).toHaveAttribute('src', 'https://cdn.example.kz/cement.jpg');
    // Декоративно: название стоит рядом, диктору нечего добавить.
    expect(photo).toHaveAttribute('alt', '');
    expect(photo).toHaveAttribute('loading', 'lazy');
  });

  it('без адреса — заглушка', () => {
    render(<LineThumb seed="item-1" />);

    expect(screen.getByTestId('line-thumb')).toBeInTheDocument();
    expect(screen.queryByTestId('line-thumb-photo')).not.toBeInTheDocument();
  });

  it('снимок не загрузился — возвращается заглушка', () => {
    render(<LineThumb seed="item-1" src="https://cdn.example.kz/broken.jpg" />);

    fireEvent.error(screen.getByTestId('line-thumb-photo'));

    expect(screen.queryByTestId('line-thumb-photo')).not.toBeInTheDocument();
    expect(screen.getByTestId('line-thumb')).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import '../../i18n';
import type { ShowcaseVariantDto } from '../../api/generated';
import { VariantPicker, axesOf } from './VariantPicker';

function variant(itemId: string, size: string, colour?: string, composition = 'Хлопок 100%'): ShowcaseVariantDto {
  return {
    itemId,
    price: 29990,
    fields: [
      { code: 'SIZE', name: 'Размер', type: 'TEXT', value: size },
      ...(colour ? [{ code: 'COLOR', name: 'Цвет', type: 'TEXT' as const, value: colour }] : []),
      { code: 'COMPOSITION', name: 'Состав', type: 'TEXT', value: composition },
    ],
  } as ShowcaseVariantDto;
}

function Opened() {
  const { itemId } = useParams();
  return <span data-testid="opened">{itemId}</span>;
}

function renderPicker(itemId: string, variants: ShowcaseVariantDto[]) {
  render(
    <MemoryRouter initialEntries={[`/catalog/${itemId}`]}>
      <Routes>
        <Route path="/catalog/:itemId" element={<><VariantPicker itemId={itemId} variants={variants} /><Opened /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Выбор варианта товара', () => {
  it('выбирает только из различающихся полей, цвет первым', () => {
    const axes = axesOf([variant('a', 'S', 'Чёрный'), variant('b', 'M', 'Чёрный'), variant('c', 'S', 'Бежевый')]);
    expect(axes.map((axis) => axis.name)).toEqual(['Цвет', 'Размер']);
    expect(axes[1].options).toEqual(['S', 'M']);
  });

  it('размер плашками: выбранный отмечен, другой открывает свою позицию', async () => {
    renderPicker('a', [variant('a', 'S'), variant('b', 'M'), variant('c', 'L')]);

    expect(screen.getByText('Размер:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'S' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'M' }));
    expect(screen.getByTestId('opened')).toHaveTextContent('b');
  });

  it('цвет кружком по цвету продавца — и для названия, которого нет в таблице («Изумрудный»)', () => {
    const coloured = (itemId: string, name: string, hex?: string) => ({
      itemId, price: 7200,
      fields: [{ code: 'COLOUR', name: 'Цвет', type: 'OPTION', value: name, ...(hex ? { hex } : {}) }],
    }) as ShowcaseVariantDto;
    renderPicker('a', [coloured('a', 'Бежевый'), coloured('b', 'Изумрудный', '#2E8B6E')]);

    expect(screen.getByRole('button', { name: 'Цвет: Изумрудный' })).toHaveStyle({ background: '#2E8B6E' });
    // Без цвета продавца — по названию, как раньше.
    expect(screen.getByRole('button', { name: 'Цвет: Бежевый' })).toHaveStyle({ background: '#D8CFC2' });
  });

  it('цвет кружками и смена цвета сохраняет размер', async () => {
    renderPicker('a', [
      variant('a', 'M', 'Чёрный'), variant('b', 'L', 'Чёрный'),
      variant('c', 'S', 'Бежевый'), variant('d', 'M', 'Бежевый'),
    ]);

    const beige = screen.getByRole('button', { name: 'Цвет: Бежевый' });
    expect(beige).toHaveStyle({ background: '#D8CFC2' });
    await userEvent.click(beige);
    expect(screen.getByTestId('opened')).toHaveTextContent('d');
  });
});

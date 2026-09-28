import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { CartButton, useHeaderSearch } from './headerParts';
import { renderScreen } from '../../../test/render';
import { get, stubFetch } from '../../../test/http';

/** Поле поиска шапки и кнопка, которая, как кнопка баннера, снимает запрос адресом. */
function Probe() {
  const { query, setQuery, search } = useHeaderSearch();
  const navigate = useNavigate();
  return (
    <form onSubmit={search}>
      <input aria-label="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button type="submit">Найти</button>
      <button type="button" onClick={() => navigate('/catalog')}>Баннер</button>
      <button type="button" onClick={() => navigate('/catalog/item-1')}>Карточка</button>
    </form>
  );
}

describe('поиск в шапке', () => {
  afterEach(() => vi.restoreAllMocks());

  it('очищается, когда витрина сняла запрос из адреса (кнопка баннера)', async () => {
    renderScreen(<Probe />, { route: '/catalog' });
    const field = screen.getByLabelText('Поиск');
    await userEvent.type(field, 'цемент');
    await userEvent.click(screen.getByRole('button', { name: 'Найти' }));
    expect(field).toHaveValue('цемент');

    await userEvent.click(screen.getByRole('button', { name: 'Баннер' }));

    expect(field).toHaveValue('');
  });

  it('уход в карточку товара запрос не стирает', async () => {
    renderScreen(<Probe />, { route: '/catalog' });
    const field = screen.getByLabelText('Поиск');
    await userEvent.type(field, 'цемент');
    await userEvent.click(screen.getByRole('button', { name: 'Найти' }));

    await userEvent.click(screen.getByRole('button', { name: 'Карточка' }));

    expect(field).toHaveValue('цемент');
  });
});

describe('корзина в шапке шаблона', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('сумма — в валюте магазина, без «₸»', async () => {
    stubFetch([
      get('/api/portal/cart', {
        lines: [{ itemId: 'item-1', name: 'Цемент М400', quantity: 1, unit: 'мешок', priceAtAdding: 9900, price: 9900, priceChanged: false, total: 9900 }],
        total: 9900,
        skipped: [],
      }),
    ]);

    renderScreen(<CartButton ready />, { currency: 'RUB' });

    expect(await screen.findByText(/9\s900\s₽/)).toBeInTheDocument();
    expect(screen.getByRole('button')).not.toHaveTextContent('₸');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogPage } from './CatalogPage';
import { RubricPicture } from './PhoneFilters';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const DRESS = { id: 'item-1', name: 'Платье «Лето»', unit: 'шт', price: 7200, favorite: false };

function stand() {
  return stubFetch([
    get('/api/portal/categories', [{ id: 'cat-1', name: 'Одежда', sortOrder: 1 }]),
    get('/api/portal/catalog/filters', [
      { code: 'SIZE', name: 'Размер', type: 'OPTION', options: [
        { code: 'S44', name: '44', count: 3 }, { code: 'S46', name: '46', count: 2 },
        { code: 'M', name: 'M', count: 4 }, { code: 'XL', name: 'XL', count: 1 }] },
      { code: 'FIT', name: 'Как сидит', type: 'OPTION', options: [{ code: 'FREE', name: 'Свободно', count: 2 }] },
    ]),
    get('/api/portal/catalog', { page: 0, size: 50, totalElements: 1, items: [DRESS] }),
    get('/api/portal/cart', { lines: [], total: 0, skipped: [] }),
  ]);
}

const lastCatalog = (calls: { url: string }[]) => calls.filter((call) => call.url.includes('/api/portal/catalog?')).at(-1)?.url ?? '';

/** Телефон: фильтры — одной строкой; поле — окном снизу, все — панелью слева (решение владельца 2026-11-05). */
describe('фильтры каталога на телефоне', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('поле — окном снизу: выбор уходит только по «Применить», размеры — цифровые и буквенные отдельно', async () => {
    const { calls } = stand();
    renderScreen(<CatalogPage />);

    await userEvent.click(await screen.findByRole('button', { name: /^Размер/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Размер' });
    expect(within(sheet).getByRole('group', { name: 'Цифровые' })).toHaveTextContent(/44.*46/);
    expect(within(sheet).getByRole('group', { name: 'Буквенные' })).toHaveTextContent(/M.*XL/);
    await userEvent.click(within(sheet).getByRole('button', { name: /^46/ }));
    expect(lastCatalog(calls)).not.toContain('field=');

    await userEvent.click(within(sheet).getByRole('button', { name: 'Применить' }));
    await waitFor(() => expect(lastCatalog(calls)).toContain('field=SIZE%3AS46'));
    expect(screen.getByRole('button', { name: /^Размер: 46/ })).toBeInTheDocument();

    // «Сбросить» снимает выбор поля, а «Применить» отправляет его.
    await userEvent.click(screen.getByRole('button', { name: /^Размер: 46/ }));
    const again = await screen.findByRole('dialog', { name: 'Размер' });
    await userEvent.click(within(again).getByRole('button', { name: 'Сбросить' }));
    await userEvent.click(within(again).getByRole('button', { name: 'Применить' }));
    await waitFor(() => expect(lastCatalog(calls)).not.toContain('field='));
  });

  it('закрытое без «Применить» окно ничего не меняет; панель слева показывает все поля', async () => {
    const { calls } = stand();
    renderScreen(<CatalogPage />);

    await userEvent.click(await screen.findByRole('button', { name: /^Как сидит/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Как сидит' });
    await userEvent.click(within(sheet).getByRole('button', { name: /^Свободно/ }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Как сидит' })).not.toBeInTheDocument());
    expect(lastCatalog(calls)).not.toContain('field=');

    await userEvent.click(screen.getByRole('button', { name: /^Все фильтры/ }));
    const panel = await screen.findByRole('dialog', { name: 'Все фильтры' });
    expect(within(panel).getByRole('heading', { name: 'Размер' })).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Как сидит' })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: /^Свободно/ }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Применить' }));
    await waitFor(() => expect(lastCatalog(calls)).toContain('field=FIT%3AFREE'));
  });
});

describe('картинка раздела', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('картинка от менеджера — первой, снимок товара тогда не запрашивается', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderScreen(<RubricPicture id="cat-1" image="/api/files/abc" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/api/files/abc');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

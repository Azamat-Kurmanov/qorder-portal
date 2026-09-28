import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { CategoryTabs } from './CategoryTabs';
import { renderScreen } from '../../../test/render';
import { get, stubFetch } from '../../../test/http';

const PROMO_NONE = { volumeTiers: [], deals: [], dealCount: 0 };
const PROMO_SALE = { volumeTiers: [], deals: [], dealCount: 3 };

function rules(options: { categories?: unknown[]; promo?: unknown; counts?: unknown }) {
  return [
    get('/api/portal/catalog/counts', options.counts ?? { all: 10, sale: 0, novelty: 0, byCategory: {} }),
    get('/api/portal/categories', options.categories ?? []),
    get('/api/portal/catalog', { page: 0, size: 50, totalElements: 0, items: [] }),
    get('/api/portal/promotions', options.promo ?? PROMO_NONE),
  ];
}

/**
 * Вкладки раскладки «вкладки»: рубрики, «Со скидкой» и «Новинки».
 * Без рубрик вкладки не прячутся, когда есть распродажа или новинки.
 */
describe('вкладки рубрик', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('вкладка «Новинки» ведёт на отбор новинок', async () => {
    stubFetch(rules({
      categories: [{ id: 'cat-1', name: 'Сухие смеси', sortOrder: 0 }],
      counts: { all: 10, sale: 0, novelty: 2, byCategory: { 'cat-1': 5 } },
    }));
    renderScreen(<CategoryTabs ready />, { route: '/catalog?novelty=1' });

    const nav = await screen.findByTestId('category-tabs');
    const tab = await within(nav).findByRole('link', { name: /Новинки/ });
    expect(tab).toHaveAttribute('href', '/catalog?novelty=1');
    expect(tab).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Все товары/ })).not.toHaveAttribute('aria-current');
  });

  it('без рубрик вкладки стоят, если идёт распродажа', async () => {
    stubFetch(rules({ promo: PROMO_SALE, counts: { all: 10, sale: 3, novelty: 0, byCategory: {} } }));
    renderScreen(<CategoryTabs ready />, { route: '/catalog' });

    const nav = await screen.findByTestId('category-tabs');
    expect(await within(nav).findByRole('link', { name: /Со скидкой/ })).toHaveAttribute('href', '/catalog?sale=1');
  });

  it('без рубрик вкладки стоят, если есть новинки', async () => {
    stubFetch(rules({ counts: { all: 10, sale: 0, novelty: 4, byCategory: {} } }));
    renderScreen(<CategoryTabs ready />, { route: '/catalog' });

    const nav = await screen.findByTestId('category-tabs');
    expect(await within(nav).findByRole('link', { name: /Новинки/ })).toBeInTheDocument();
  });

  it('без рубрик, распродажи и новинок вкладок нет', async () => {
    const { calls } = stubFetch(rules({}));
    renderScreen(<CategoryTabs ready />, { route: '/catalog' });

    await vi.waitFor(() => expect(calls.some((call) => call.url.includes('/counts'))).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByTestId('category-tabs')).not.toBeInTheDocument();
  });
});

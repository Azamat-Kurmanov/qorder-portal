import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';
import { useMainSections } from '../shell/sections';
import { destinationOf, opensWithoutSubject } from '../notifications/NotificationsBell';
import { NewArrivalsIcon } from './NewArrivalsIcon';
import { NewArrivalsPage } from './NewArrivalsPage';
import ru from '../../i18n/ru.json';
import kk from '../../i18n/kk.json';
import en from '../../i18n/en.json';

const PROMOTIONS = { volumeTiers: [], dealCount: 0, subscription: { subscribed: true } };

const ARRIVED = { id: 'n-arr', draftId: 'batch-1', kind: 'NEW_ARRIVALS', createdAt: '2026-10-22T05:00:00Z', detail: '3' };

const ITEM = {
  id: 'i1', name: 'Пальто Milano', unit: 'шт', price: 59990, photos: [], inCart: false,
  terms: { hit: false, novelty: true, ageRestricted: false, noveltySince: '2026-10-22' },
};

/** Показывает ключи главных разделов — ровно то, что рисуют все раскладки меню. */
function SectionsProbe() {
  const { sections, arrivals } = useMainSections(true);
  return <span data-testid="sections">{sections.map((section) => section.key).join(',')}|{arrivals}</span>;
}

function counts(novelty: number) {
  return get('/api/portal/catalog/counts', { all: 10, sale: 0, novelty, byCategory: {} });
}

describe('новые поступления в кабинете', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('пункт «Новые поступления» с числом — пока новинки есть', async () => {
    stubFetch([get('/api/portal/promotions', PROMOTIONS), counts(3)]);
    renderScreen(<SectionsProbe />);

    await waitFor(() => expect(screen.getByTestId('sections')).toHaveTextContent('newArrivals'));
    expect(screen.getByTestId('sections')).toHaveTextContent('|3');
    // Сразу за каталогом: туда смотрят первым делом.
    expect(screen.getByTestId('sections').textContent).toMatch(/^catalog,newArrivals,/);
  });

  it('у пункта есть короткая подпись нижней панели телефона на всех языках', async () => {
    stubFetch([get('/api/portal/promotions', PROMOTIONS), counts(3)]);
    renderScreen(<SectionsProbe />);
    await waitFor(() => expect(screen.getByTestId('sections')).toHaveTextContent('newArrivals'));

    const keys = screen.getByTestId('sections').textContent!.split('|')[0].split(',');
    for (const bundle of [ru, kk, en]) {
      const tabs = bundle.shell.tabs as Record<string, string>;
      for (const key of keys) expect(tabs[key], key).toBeTruthy();
    }
  });

  it('новинок нет — пункта нет', async () => {
    stubFetch([get('/api/portal/promotions', PROMOTIONS), counts(0)]);
    renderScreen(<SectionsProbe />);

    await waitFor(() => expect(screen.getByTestId('sections')).toHaveTextContent('|0'));
    expect(screen.getByTestId('sections')).not.toHaveTextContent('newArrivals');
  });

  it('пункт подсвечен, пока о поступлении есть непрочитанное уведомление', async () => {
    stubFetch([get('/api/portal/notifications', [ARRIVED])]);
    renderScreen(<NewArrivalsIcon aria-label="значок" />);

    await waitFor(() => expect(screen.getByLabelText('значок')).toHaveAttribute('data-hot', 'true'));
  });

  it('раздел показывает новинки и гасит уведомление о поступлении', async () => {
    const { calls } = stubFetch([
      get('/api/portal/catalog?', { items: [ITEM], page: 0, size: 60, totalElements: 1, totalPages: 1 }),
      get('/api/portal/notifications', [ARRIVED]),
      get('/api/portal/cart', { lines: [], total: 0, skipped: [] }),
      method('POST', '/api/portal/notifications/n-arr/read', null, 204),
    ]);
    renderScreen(<NewArrivalsPage />, { route: '/new-arrivals' });

    expect(await screen.findByText('Пальто Milano')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Новые поступления' })).toBeInTheDocument();
    const page = calls.find((call) => call.url.includes('/api/portal/catalog?'));
    expect(page?.url).toContain('novelty=true');
    expect(page?.url).toContain('sort=NEWEST');
    await waitFor(() => expect(calls.some((call) =>
      call.url.includes('/api/portal/notifications/n-arr/read') && call.init?.method === 'POST')).toBe(true));
  });

  it('на телефоне новинки сгруппированы по дням: сегодня и раньше', async () => {
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    stubFetch([
      get('/api/portal/catalog?', { items: [
        { ...ITEM, id: 'i2', name: 'Тренч Classic', terms: { ...ITEM.terms, noveltySince: today } },
        { ...ITEM, terms: { ...ITEM.terms, noveltySince: '2020-01-01' } },
      ], page: 0, size: 60, totalElements: 2, totalPages: 1 }),
      get('/api/portal/notifications', []),
      get('/api/portal/cart', { lines: [], total: 0, skipped: [] }),
    ]);
    renderScreen(<NewArrivalsPage />, { route: '/new-arrivals' });

    const fresh = await screen.findByRole('region', { name: 'Сегодня' });
    expect(fresh).toHaveTextContent('Тренч Classic');
    expect(screen.getByRole('region', { name: 'Раньше' })).toHaveTextContent('Пальто Milano');
    expect(screen.queryByRole('region', { name: 'На этой неделе' })).not.toBeInTheDocument();
  });

  it('плашки объявлений ведут в свои разделы', () => {
    expect(destinationOf('NEW_ARRIVALS', 'batch-1')).toBe('/new-arrivals');
    expect(destinationOf('PROMO_STARTED', '')).toBe('/promotions');
    // Ждавшаяся позиция — в свою карточку.
    expect(destinationOf('BACK_IN_STOCK', 'item-1')).toBe('/catalog/item-1');
  });

  it('push об акции открывается и без предмета — у распродажи его нет', () => {
    expect(opensWithoutSubject('PROMO_STARTED')).toBe(true);
    expect(opensWithoutSubject('NEW_ARRIVALS')).toBe(true);
    expect(opensWithoutSubject('RENEGOTIATION')).toBe(false);
  });
});

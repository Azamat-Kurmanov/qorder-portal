import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileCity } from './ProfileCity';
import { BranchNote } from '../city/BranchNote';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

describe('город в профиле', () => {
  it('показывает город и меняет его', async () => {
    let city: Record<string, unknown> = { ask: false, country: 'KZ', placeId: 42, name: 'Шымкент' };
    const { calls } = stubFetch([
      { match: (url, init) => {
        const hit = url.includes('/api/portal/me/city') && init?.method === 'PUT';
        if (hit) city = { ask: false, country: 'KZ', placeId: 7, name: 'Алматы' };
        return hit;
      }, status: 204 },
      { match: (url, init) => url.includes('/api/portal/me/city') && (init?.method ?? 'GET') === 'GET',
        get body() { return city; } },
      get('/api/portal/geo/places', [{ country: 'KZ', placeId: 7, name: 'Алматы' }]),
    ]);
    renderScreen(<ProfileCity />);

    expect(await screen.findByText('Шымкент, Казахстан')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Изменить' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Город' }), 'алм');
    await userEvent.click(await screen.findByRole('button', { name: 'Алматы' }));

    expect(await screen.findByText('Алматы, Казахстан')).toBeInTheDocument();
    const put = calls.find((call) => call.init?.method === 'PUT');
    expect(JSON.parse(String(put?.init?.body))).toEqual({ country: 'KZ', placeId: 7 });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Город' })).not.toBeInTheDocument());
  });

  it('сотруднику блока нет', async () => {
    stubFetch([get('/api/portal/me/city', { ask: false })]);
    renderScreen(<ProfileCity />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Город')).not.toBeInTheDocument();
  });

  it('смена города перезапрашивает филиал', async () => {
    let branch = { name: 'Шымкент-склад', placeName: 'Шымкент' };
    stubFetch([
      { match: (url, init) => {
        const hit = url.includes('/api/portal/me/city') && init?.method === 'PUT';
        if (hit) branch = { name: 'Алматы-склад', placeName: 'Алматы' };
        return hit;
      }, status: 204 },
      get('/api/portal/me/city', { ask: false, country: 'KZ', placeId: 42, name: 'Шымкент' }),
      { match: (url) => url.includes('/api/portal/branch'), get body() { return branch; } },
      get('/api/portal/geo/places', [{ country: 'KZ', placeId: 7, name: 'Алматы' }]),
    ]);
    renderScreen(<><ProfileCity /><BranchNote /></>);

    expect(await screen.findByText('Филиал: Шымкент')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Изменить' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Город' }), 'алм');
    await userEvent.click(await screen.findByRole('button', { name: 'Алматы' }));

    expect(await screen.findByText('Филиал: Алматы')).toBeInTheDocument();
  });
});

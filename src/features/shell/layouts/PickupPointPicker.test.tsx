import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PickupPointPicker } from './PickupPointPicker';
import { renderScreen } from '../../../test/render';
import { get, stubFetch } from '../../../test/http';
import { currentPickupPoint, setPickupPoint } from '../../../supplier/pickupPoint';
import { setCurrentSupplierId } from '../../../supplier/supplier';

const ABAYA = { id: 'p1', name: 'Абая', address: 'Абая 1' };
const RAIYMBEK = { id: 'p2', name: 'Райымбека', address: 'Райымбека 5' };

function options(points: unknown[]) {
  return get('/api/portal/delivery', { mode: 'DELIVERY_AND_PICKUP', methods: [], pickupPoints: points });
}

describe('точка самовывоза в шапке', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setPickupPoint(null);
    window.localStorage.clear();
    setCurrentSupplierId(null);
  });

  it('выбор точки и «Все точки»', async () => {
    setCurrentSupplierId('supplier-1');
    stubFetch([options([ABAYA, RAIYMBEK])]);
    renderScreen(<PickupPointPicker ready />);
    await userEvent.click(await screen.findByRole('button', { name: 'Где заберёте?' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: /Райымбека/ }));
    expect(currentPickupPoint()).toBe('p2');
    expect(screen.getByRole('button', { name: 'Заберу в: Райымбека' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Заберу в: Райымбека' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Все точки' }));
    expect(currentPickupPoint()).toBeNull();
  });

  it('одна точка — выбирать нечего', async () => {
    const { calls } = stubFetch([options([ABAYA])]);
    renderScreen(<PickupPointPicker ready />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('button', { name: /заберёте|Заберу/ })).toBeNull();
  });

  it('сбрасывает пропавшую точку', async () => {
    setCurrentSupplierId('supplier-1');
    setPickupPoint('p9');
    stubFetch([options([ABAYA, RAIYMBEK])]);
    renderScreen(<PickupPointPicker ready />);
    await screen.findByRole('button', { name: 'Где заберёте?' });
    expect(currentPickupPoint()).toBeNull();
  });

  it('в листе «Ещё» под выбранной точкой — карта с её адресом', async () => {
    setCurrentSupplierId('supplier-1');
    stubFetch([options([ABAYA, { ...RAIYMBEK, latitude: 43.25, longitude: 76.9 }])]);
    renderScreen(<PickupPointPicker ready withMap />);
    await userEvent.click(await screen.findByRole('button', { name: 'Где заберёте?' }));
    expect(screen.queryByTestId('map-thumbnail')).toBeNull();
    await userEvent.click(screen.getByRole('menuitemradio', { name: /Райымбека/ }));
    expect(screen.getByRole('button', { name: 'Райымбека — открыть карту' })).toBeInTheDocument();
  });
});

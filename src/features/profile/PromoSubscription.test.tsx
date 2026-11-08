import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { PromoSubscription } from './PromoSubscription';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

describe('подписка на новинки и акции', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('до выбора магазина не спрашивает акции: без X-Supplier-Id сервер ответил бы 403', async () => {
    const { calls } = stubFetch([get('/api/portal/promotions', { subscription: { subscribed: true } })]);
    renderScreen(<PromoSubscription />, { supplierId: null });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toHaveLength(0);
  });

  it('в магазине — переключатель подписки', async () => {
    stubFetch([get('/api/portal/promotions', { subscription: { subscribed: true } })]);
    renderScreen(<PromoSubscription />, { supplierId: 'sup-1' });

    expect(await screen.findByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});

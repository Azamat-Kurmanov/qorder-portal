import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { VolumeHint } from './VolumeHint';
import { renderScreen } from '../../../test/render';
import { get, stubFetch } from '../../../test/http';
import type { PortalPromotionsDto } from '../../../api/generated';

const cart = { lines: [], total: 0, goodsTotal: 0, volumeGoods: 0, skipped: [], vatPayer: true };

function promo(extra: Partial<PortalPromotionsDto>): PortalPromotionsDto {
  return { volumeTiers: [], deals: [], dealCount: 0, saleCategories: [], ...extra };
}

describe('подсказка скидки над витриной шаблона', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('без порогов за объём показывает билет скидки на первую заявку', async () => {
    stubFetch([get('/api/portal/cart', cart)]);
    renderScreen(<VolumeHint data={promo({ firstOrder: { percent: 5, status: 'ELIGIBLE' } })} compact={false} />);

    const hint = await screen.findByTestId('volume-hint');
    expect(hint).toHaveTextContent('−5% на первую заявку');
    expect(hint).toHaveAttribute('href', '/promotions');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('без порогов и с условием «от суммы» называет сумму', async () => {
    stubFetch([get('/api/portal/cart', cart)]);
    renderScreen(<VolumeHint data={promo({ firstOrder: { percent: 5, status: 'ELIGIBLE', minTotal: 50000 } })} compact />);

    const hint = await screen.findByTestId('volume-hint');
    expect(hint).toHaveTextContent('−5% на первую заявку');
    expect(hint).toHaveTextContent(/От 50\s000\s₸ в заявке/);
  });

  it('в другой валюте магазина сумма показывается с её знаком', async () => {
    stubFetch([get('/api/portal/cart', cart)]);
    renderScreen(
      <VolumeHint data={promo({ firstOrder: { percent: 5, status: 'ELIGIBLE', minTotal: 50000 } })} compact />,
      { currency: 'RUB' },
    );

    const hint = await screen.findByTestId('volume-hint');
    expect(hint).toHaveTextContent(/От 50\s000\s₽ в заявке/);
  });

  it('исключённые товары не приближают к порогу скидки за объём', async () => {
    stubFetch([get('/api/portal/cart', { ...cart, goodsTotal: 210000, volumeGoods: 110000 })]);
    renderScreen(<VolumeHint data={promo({ volumeTiers: [{ from: 150000, percent: 3 }], volumeHintPercent: 30 })} compact />);

    const hint = await screen.findByTestId('volume-hint');
    await waitFor(() => expect(hint).toHaveTextContent(/Ещё 40\s000\s₸ — и −3% на всю заявку/));
    expect(hint).not.toHaveTextContent(/Скидка 3% уже действует/);
  });

  it('без порогов и без положенной скидки на первую заявку подсказки нет', () => {
    stubFetch([get('/api/portal/cart', cart)]);
    renderScreen(<VolumeHint data={promo({ firstOrder: { percent: 5, status: 'USED' } })} compact={false} />);

    expect(screen.queryByTestId('volume-hint')).not.toBeInTheDocument();
  });
});

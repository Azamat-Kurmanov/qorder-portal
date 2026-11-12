import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { BranchNote } from './BranchNote';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

describe('филиал клиента', () => {
  it('показывает город филиала и ведёт в профиль', async () => {
    stubFetch([get('/api/portal/branch', { name: 'Шымкент-склад', placeName: 'Шымкент' })]);
    renderScreen(<BranchNote />, { supplierId: 'supplier-1' });

    const link = await screen.findByRole('link', { name: /Филиал: Шымкент/ });
    expect(link).toHaveAttribute('href', '/profile');
  });

  it('без города склада — по названию склада', async () => {
    stubFetch([get('/api/portal/branch', { name: 'Склад на Райымбека' })]);
    renderScreen(<BranchNote />, { supplierId: 'supplier-1' });

    expect(await screen.findByText('Филиал: Склад на Райымбека')).toBeInTheDocument();
  });

  it('магазин без филиалов или ошибка — ничего', async () => {
    stubFetch([get('/api/portal/branch', {})]);
    const { container } = renderScreen(<BranchNote />, { supplierId: 'supplier-1' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });
});

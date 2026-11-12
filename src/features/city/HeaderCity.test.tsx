import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { HeaderCity } from './HeaderCity';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

describe('город в шапке', () => {
  it('показывает город клиента и ведёт в профиль, где он меняется', async () => {
    stubFetch([get('/api/portal/me/city', { ask: false, country: 'KZ', placeId: 7, name: 'Алматы' })]);
    renderScreen(<HeaderCity />);

    const link = await screen.findByRole('link', { name: 'Ваш город: Алматы. Изменить в профиле' });
    expect(link).toHaveAttribute('href', '/profile');
    expect(link).toHaveTextContent('Алматы');
  });

  it('город не выбран — ничего: его спросит окно «Откуда вы?»', async () => {
    stubFetch([get('/api/portal/me/city', { ask: true })]);
    const { container } = renderScreen(<HeaderCity />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });
});

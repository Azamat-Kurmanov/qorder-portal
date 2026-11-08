import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FontScalePicker } from './FontScale';
import { renderScreen } from '../../test/render';

describe('переключатель размера шрифта', () => {
  beforeEach(() => {
    window.localStorage.removeItem('q-order.portal.font-scale');
    delete document.documentElement.dataset.fontScale;
  });

  // Признак живёт на корне страницы, а корень в jsdom переживает границу
  // файла: оставленный «очень крупный» не должен достаться соседям.
  afterEach(() => {
    delete document.documentElement.dataset.fontScale;
    window.localStorage.removeItem('q-order.portal.font-scale');
  });

  it('называет себя словами, а не одними буквами «Аа»', async () => {
    renderScreen(<FontScalePicker />);

    expect(await screen.findByRole('button', { name: /Размер шрифта/ })).toBeInTheDocument();
  });

  it('укрупняет кабинет выбором ступени', async () => {
    renderScreen(<FontScalePicker />);

    await userEvent.click(screen.getByRole('button', { name: /Размер шрифта/ }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Крупный' }));

    expect(document.documentElement.dataset.fontScale).toBe('large');
  });

  it('помнит ступень между заходами', async () => {
    renderScreen(<FontScalePicker />);

    await userEvent.click(screen.getByRole('button', { name: /Размер шрифта/ }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Крупный' }));

    expect(window.localStorage.getItem('q-order.portal.font-scale')).toBe('large');
  });

  // Выбранная ступень названа выбранной, а не только подкрашена: человек,
  // пришедший сюда за крупным шрифтом, скорее всего плохо видит подсветку.
  it('называет выбранную ступень выбранной', async () => {
    renderScreen(<FontScalePicker />);

    await userEvent.click(screen.getByRole('button', { name: /Размер шрифта/ }));

    expect(await screen.findByRole('menuitemradio', { name: 'Обычный' }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('возвращает кабинет к обычному размеру', async () => {
    renderScreen(<FontScalePicker />);

    await userEvent.click(screen.getByRole('button', { name: /Размер шрифта/ }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Крупный' }));
    await userEvent.click(screen.getByRole('button', { name: /Размер шрифта/ }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Обычный' }));

    expect(document.documentElement.dataset.fontScale).toBeUndefined();
  });
});

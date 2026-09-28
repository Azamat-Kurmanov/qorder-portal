import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';
import { renderScreen } from '../../test/render';
import { setSupplierTheme } from '../../ui/theme';

describe('переключатель темы', () => {
  /** Имя постоянное, состояние — нажатостью: диктор прочтёт «Тёмная тема, нажата». */
  it('называет себя словами и говорит, включена ли тёмная', async () => {
    renderScreen(<ThemeToggle />);

    expect(await screen.findByRole('button', { name: 'Тёмная тема' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('включает тёмную тему и запоминает выбор', async () => {
    renderScreen(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button', { name: 'Тёмная тема' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('q-order.portal.theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Тёмная тема' })).toHaveAttribute('aria-pressed', 'true');
  });

  /** Кабинет «Ночь» открывается тёмным, но покупатель вправе вернуть светлый. */
  it('возвращает светлую тему поверх тёмной темы магазина', async () => {
    setSupplierTheme('dark');
    renderScreen(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: 'Тёмная тема' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(toggle);

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('q-order.portal.theme')).toBe('light');
  });
});

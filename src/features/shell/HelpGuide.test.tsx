import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { HelpGuide } from './HelpGuide';
import { renderScreen } from '../../test/render';

describe('«Как этим пользоваться» в кабинете покупателя', () => {
  it('открывает схему и шаги инструкции текущего экрана', async () => {
    renderScreen(<HelpGuide />, { route: '/checkout' });
    await userEvent.click(screen.getByRole('button', { name: 'Как этим пользоваться' }));
    const sheet = screen.getByRole('dialog', { name: 'Как пользоваться: Оформление заявки' });
    const flow = within(sheet).getByRole('list', { name: 'Схема' });
    expect(within(flow).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Заявка', 'Получение', 'Отправить', 'Без оплаты']);
    expect(sheet).toHaveTextContent('Отправить заявку продавцу');
  });

  it('карточка товара и открытая заявка — свои инструкции', async () => {
    for (const [route, name] of [['/catalog/i1', 'Как пользоваться: Товар'], ['/orders/o1', 'Как пользоваться: Заявка']] as const) {
      const { unmount } = renderScreen(<HelpGuide />, { route });
      await userEvent.click(screen.getByRole('button', { name: 'Как этим пользоваться' }));
      expect(screen.getByRole('dialog', { name })).toBeInTheDocument();
      unmount();
    }
  });

  it('«Показать» — только у шага, чья кнопка есть на экране, и обводит её', async () => {
    renderScreen(<><button type="button">Отправить заявку продавцу</button><HelpGuide /></>, { route: '/checkout' });
    await userEvent.click(screen.getByRole('button', { name: 'Как этим пользоваться' }));
    const show = screen.getAllByRole('button', { name: 'Показать на экране' });
    expect(show).toHaveLength(1);

    await userEvent.click(show[0]);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Отправить заявку продавцу' })).toHaveClass('qo-help-spot'));
  });

  it('у экрана без инструкции кнопки нет', () => {
    renderScreen(<HelpGuide />, { route: '/activate' });
    expect(screen.queryByRole('button', { name: 'Как этим пользоваться' })).not.toBeInTheDocument();
  });

  it('у каждого экрана подписей схемы столько же, сколько шагов', () => {
    const guide = i18n.getResourceBundle('ru', 'translation').guide as Record<string, unknown>;
    for (const [screenKey, value] of Object.entries(guide)) {
      if (typeof value !== 'object' || value === null) continue;
      const keys = Object.keys(value);
      expect(keys.filter((k) => /^f\d$/.test(k)).length, screenKey).toBe(keys.filter((k) => /^s\d$/.test(k)).length);
    }
  });
});

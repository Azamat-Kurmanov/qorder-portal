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
    const flow = within(sheet).getByRole('tablist', { name: 'Схема' });
    expect(within(flow).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['1. Заявка', '2. Получение', '3. Отправить', '4. Без оплаты']);
    expect(within(sheet).getByRole('tabpanel')).toHaveTextContent('Здесь ваша заявка');
  });

  it('нажатие на значок шага показывает именно этот шаг: что сделать, что получится, пример, дальше', async () => {
    renderScreen(<HelpGuide />, { route: '/checkout' });
    await userEvent.click(screen.getByRole('button', { name: 'Как этим пользоваться' }));
    await userEvent.click(screen.getByRole('tab', { name: '3. Отправить' }));
    const step = screen.getByRole('tabpanel');
    expect(step).toHaveTextContent('Шаг 3 из 4');
    expect(step).toHaveTextContent('Отправить заявку продавцу');
    expect(step).toHaveTextContent('Что получится:');
    expect(step).toHaveTextContent('Пример');
    expect(step).toHaveTextContent('Дальше:');
    expect(screen.getByText('Что дальше')).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('tab', { name: '3. Отправить' }));
    const show = screen.getAllByRole('button', { name: 'Показать на экране' });
    expect(show).toHaveLength(1);

    await userEvent.click(show[0]);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Отправить заявку продавцу' })).toHaveClass('qo-help-spot'));
  });

  it('«Пройти по шагам» ведёт по кнопкам экрана: пузырь, рамка, «Далее», «Готово»', async () => {
    renderScreen(
      <><button type="button">В корзину</button><button type="button">Открыть корзину</button><HelpGuide /></>,
      { route: '/catalog' },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Как этим пользоваться' }));
    await userEvent.click(screen.getByRole('button', { name: 'Пройти по шагам' }));

    const first = await screen.findByRole('dialog', { name: 'Шаг 1 из 2' });
    expect(first).toHaveTextContent('В корзину');
    expect(screen.getByRole('button', { name: 'В корзину' })).toHaveClass('qo-help-spot');

    await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
    expect(screen.getByRole('dialog', { name: 'Шаг 2 из 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Открыть корзину' })).toHaveClass('qo-help-spot');

    await userEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(screen.queryByRole('dialog', { name: /Шаг/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Открыть корзину' })).not.toHaveClass('qo-help-spot');
  });

  it('выбранный фильтр «Моих заявок» — своя инструкция', async () => {
    renderScreen(<><button type="button" aria-pressed="true">Можно забирать</button><HelpGuide /></>, { route: '/orders' });
    await userEvent.click(screen.getByRole('button', { name: 'Как этим пользоваться' }));
    expect(screen.getByRole('dialog', { name: 'Как пользоваться: Мои заявки: можно забирать' })).toBeInTheDocument();
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

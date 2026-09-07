import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { LanguagePicker } from './LanguagePicker';
import { renderScreen } from '../../test/render';

describe('переключатель языка', () => {
  // Язык возвращается перед каждой проверкой, а не после: детектор помнит
  // выбор в хранилище, и проверка, начавшаяся с чужого языка, ищет подпись,
  // которой на экране нет.
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage('ru');
  });

  // И после себя: детектор пишет выбор в хранилище, а среда jsdom переживает
  // границу файла. Оставленный английский язык уронил бы соседний набор,
  // который ищет русские подписи, — и выглядело бы это как поломка оболочки.
  afterEach(async () => {
    await i18n.changeLanguage('ru');
    window.localStorage.clear();
  });

  it('называет текущий язык на нём самом', async () => {
    renderScreen(<LanguagePicker />);

    expect(await screen.findByRole('button', { name: /Язык интерфейса/ }))
      .toHaveTextContent('РУС');
  });

  it('меняет язык приложения выбором из трёх', async () => {
    renderScreen(<LanguagePicker />);

    await userEvent.click(screen.getByRole('button', { name: /Язык интерфейса/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'ҚАЗ' }));

    expect(i18n.resolvedLanguage).toBe('kk');
  });

  it('выбранный язык назван выбранным, а не только подкрашен', async () => {
    renderScreen(<LanguagePicker />);

    await userEvent.click(screen.getByRole('button', { name: /Язык интерфейса/ }));

    // Цвет читает не всякий: состояние обязано быть сказано словами.
    expect(screen.getByRole('menuitem', { name: 'РУС' }))
      .toHaveAttribute('aria-current', 'true');
  });

  it('смена языка сбрасывает кеш запросов', async () => {
    const { queryClient } = renderScreen(<LanguagePicker />);
    queryClient.setQueryData(['проверка'], 'ответ сервера на прежнем языке');

    await userEvent.click(screen.getByRole('button', { name: /Язык интерфейса/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'ENG' }));

    // Тексты ошибок и уведомление о согласии приходят с сервера переведёнными.
    // Оставь их в кеше — экран переключится, а серверные строки останутся
    // на прежнем языке.
    expect(queryClient.getQueryData(['проверка'])).toBeUndefined();
  });
});

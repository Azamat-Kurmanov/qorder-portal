import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { LanguageAsk } from './LanguageAsk';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

/**
 * Хранилище чистится вокруг каждой проверки, а язык возвращается русским.
 *
 * Общий `setup.ts` помечает язык выбранным за весь набор — иначе окно всплыло
 * бы поверх каждого чужого экрана. Здесь проверяется само окно, и метку
 * приходится снимать: с ней вопрос не задаётся ни разу.
 */
beforeEach(async () => {
  window.localStorage.clear();
  await i18n.changeLanguage('ru');
});

afterEach(async () => {
  await i18n.changeLanguage('ru');
  window.localStorage.clear();
});

describe('вопрос о языке при первом заходе', () => {
  it('спрашивает, пока человек не ответил', async () => {
    renderScreen(<LanguageAsk />);

    // Заголовок назван сразу на трёх языках — вопрос обязан быть понятен
    // и тому, кому кабинет открылся не на его языке.
    expect(await screen.findByRole('dialog', { name: /Выберите язык/ })).toBeInTheDocument();
  });

  it('называет языки на них самих, а не в переводе', async () => {
    renderScreen(<LanguageAsk />);
    const dialog = await screen.findByRole('dialog');

    // Человек, которому кабинет открылся на чужом языке, ищет своё слово.
    for (const name of ['Қазақша', 'Русский', 'English']) {
      expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    }
    expect(dialog).toBeInTheDocument();
  });

  it('выбор переключает язык, помнится и закрывает окно', async () => {
    renderScreen(<LanguageAsk />);

    await userEvent.click(await screen.findByRole('button', { name: 'Қазақша' }));

    await waitFor(() => expect(i18n.resolvedLanguage).toBe('kk'));
    expect(window.localStorage.getItem('q-order.portal.language-chosen')).toBe('kk');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('выбор сбрасывает кеш запросов', async () => {
    const { queryClient } = renderScreen(<LanguageAsk />);
    queryClient.setQueryData(['проверка'], 'ответ сервера на прежнем языке');

    await userEvent.click(await screen.findByRole('button', { name: 'English' }));

    // Ответы сервера переведены по заголовку `Accept-Language`: оставленные
    // в кеше тексты пережили бы смену языка.
    await waitFor(() => expect(queryClient.getQueryData(['проверка'])).toBeUndefined());
  });

  it('повторный заход не спрашивает', async () => {
    window.localStorage.setItem('q-order.portal.language-chosen', 'ru');

    renderScreen(<LanguageAsk />);

    // Не `findBy`: окно не должно появиться и позже — ждать тут нечего.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('закрытие без выбора оставляет язык браузера и тоже считается ответом', async () => {
    renderScreen(<LanguageAsk />);
    await screen.findByRole('dialog');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(i18n.resolvedLanguage).toBe('ru');
    expect(window.localStorage.getItem('q-order.portal.language-chosen')).toBe('ru');
  });

  it('не роняет экран, когда хранилище запрещено', async () => {
    const denied = () => {
      throw new Error('доступ к хранилищу запрещён');
    };
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get: denied });

    try {
      renderScreen(<LanguageAsk />);

      // Вопрос задаётся: помнить ответ негде, и это лучше, чем не открыть
      // кабинет вовсе.
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      await userEvent.click(await screen.findByRole('button', { name: 'Русский' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});

describe('язык в учётной записи', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('язык из учётной записи открывает кабинет на нём и вопроса не задаёт', async () => {
    stubFetch([get('/api/portal/me/language', { language: 'kk' })]);

    renderScreen(<LanguageAsk />);

    await waitFor(() => expect(i18n.language).toBe('kk'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('пустая учётная запись — вопрос; выбор уходит в учётную запись', async () => {
    const { calls } = stubFetch([
      get('/api/portal/me/language', {}),
      method('PUT', '/api/portal/me/language', null, 204),
    ]);

    renderScreen(<LanguageAsk />);
    await userEvent.click(await screen.findByRole('button', { name: 'Қазақша' }));

    await waitFor(() => {
      const put = calls.find((call) => call.url.includes('/api/portal/me/language') && call.init?.method === 'PUT');
      expect(put?.init?.body).toBe(JSON.stringify({ language: 'kk' }));
    });
  });

  it('без входа учётную запись не спрашивает', async () => {
    const { calls } = stubFetch([]);

    renderScreen(<LanguageAsk />, { auth: { authenticated: false } });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

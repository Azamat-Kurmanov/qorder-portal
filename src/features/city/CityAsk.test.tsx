import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CityAsk } from './CityAsk';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const SHYMKENT = { country: 'KZ', placeId: 42, name: 'Шымкент' };

/** Тело последнего PUT города — то, что ушло на сервер. */
function savedBody(calls: { url: string; init?: RequestInit }[]) {
  const put = calls.filter((call) => call.url.includes('/api/portal/me/city') && call.init?.method === 'PUT').at(-1);
  return put ? JSON.parse(String(put.init?.body)) : undefined;
}

describe('вопрос «Откуда вы?» после входа', () => {
  it('предлагает город по IP и запоминает его одной кнопкой', async () => {
    // Сервер помнит запись: после PUT город уже выбран, и перечитанный ответ окно закрывает.
    let saved = false;
    const { calls } = stubFetch([
      { match: (url, init) => {
        const hit = url.includes('/api/portal/me/city') && init?.method === 'PUT';
        if (hit) saved = true;
        return hit;
      }, status: 204 },
      { match: (url, init) => url.includes('/api/portal/me/city') && (init?.method ?? 'GET') === 'GET',
        get body() { return saved ? { ask: false, ...SHYMKENT } : { ask: true }; } },
      get('/api/portal/geo/guess', SHYMKENT),
    ]);
    renderScreen(<CityAsk />);

    expect(await screen.findByRole('dialog', { name: 'Откуда вы?' })).toBeInTheDocument();
    expect(await screen.findByText('Похоже, вы в городе Шымкент')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Да, я здесь' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(savedBody(calls)).toEqual({ country: 'KZ', placeId: 42 });
  });

  it('без подсказки сразу даёт выбрать страну и город', async () => {
    stubFetch([
      get('/api/portal/me/city', { ask: true }),
      get('/api/portal/geo/guess', {}),
      get('/api/portal/geo/places', []),
    ]);
    renderScreen(<CityAsk />);

    expect(await screen.findByRole('combobox', { name: 'Страна' })).toHaveValue('Казахстан');
    expect(screen.getByRole('textbox', { name: 'Город' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Да, я здесь' })).not.toBeInTheDocument();
  });

  it('другая страна и город, которого нет в списке, — записывается как вписан', async () => {
    const { calls } = stubFetch([
      get('/api/portal/me/city', { ask: true }),
      get('/api/portal/geo/guess', SHYMKENT),
      get('/api/portal/geo/places', []),
      method('PUT', '/api/portal/me/city', null, 204),
    ]);
    renderScreen(<CityAsk />);

    await userEvent.click(await screen.findByRole('button', { name: 'Выбрать другой город' }));
    // Список стран — свой, не системный: раскрывается щелчком, пока открыт — города не видно.
    const country = screen.getByRole('combobox', { name: 'Страна' });
    await userEvent.click(country);
    expect(screen.queryByRole('textbox', { name: 'Город' })).not.toBeInTheDocument();
    await userEvent.type(country, 'тур');
    await userEvent.click(screen.getByRole('option', { name: 'Турция' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(country).toHaveValue('Турция');
    await userEvent.type(screen.getByRole('textbox', { name: 'Город' }), 'Измир');
    await userEvent.click(await screen.findByRole('button', { name: 'Нет в списке — записать «Измир»' }));

    await waitFor(() => expect(savedBody(calls)).toEqual({ country: 'TR', cityName: 'Измир' }));
  });

  it('город из поиска записывается местом справочника', async () => {
    const { calls } = stubFetch([
      get('/api/portal/me/city', { ask: true }),
      get('/api/portal/geo/guess', {}),
      get('/api/portal/geo/places', [{ country: 'KZ', placeId: 7, name: 'Алматы' }]),
      method('PUT', '/api/portal/me/city', null, 204),
    ]);
    renderScreen(<CityAsk />);

    await userEvent.type(await screen.findByRole('textbox', { name: 'Город' }), 'алм');
    await userEvent.click(await screen.findByRole('button', { name: 'Алматы' }));

    await waitFor(() => expect(savedBody(calls)).toEqual({ country: 'KZ', placeId: 7 }));
  });

  it('не спрашивает, когда город уже есть или это сотрудник', async () => {
    stubFetch([get('/api/portal/me/city', { ask: false })]);
    renderScreen(<CityAsk />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('не записалось — говорит об этом и окно остаётся', async () => {
    stubFetch([
      get('/api/portal/me/city', { ask: true }),
      get('/api/portal/geo/guess', SHYMKENT),
      method('PUT', '/api/portal/me/city', { title: 'Ошибка' }, 500),
    ]);
    renderScreen(<CityAsk />);

    await userEvent.click(await screen.findByRole('button', { name: 'Да, я здесь' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Не получилось сохранить. Попробуйте ещё раз.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Escape не закрывает окно', async () => {
    stubFetch([
      get('/api/portal/me/city', { ask: true }),
      get('/api/portal/geo/guess', SHYMKENT),
    ]);
    renderScreen(<CityAsk />);

    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

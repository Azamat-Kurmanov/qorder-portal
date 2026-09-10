import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfilePage } from './ProfilePage';
import { renderScreen } from '../../test/render';
import { file, get, stubFetch, type StubbedResponse } from '../../test/http';

const suppliers = [{ supplierId: 'supplier-1', name: 'СтройБаза Алматы' }];

const OLDER = {
  id: 'consent-old',
  version: '2025-04-01',
  language: 'kk',
  acceptedAt: '2025-04-02T08:00:00Z',
};

const NEWER = {
  id: 'consent-new',
  version: '2026-09-08',
  language: 'ru',
  acceptedAt: '2026-09-08T10:30:00Z',
};

/**
 * Правило файла стоит раньше правила списка: совпадение в обвязке идёт
 * по вхождению подстроки, и `/api/portal/consents` перехватило бы адрес
 * документа `/api/portal/consents/{id}/pdf` вместе со своим.
 */
function profileRules(...consents: StubbedResponse[]): StubbedResponse[] {
  return [
    ...consents,
    get('/api/portal/notifications/summary', []),
    get('/api/portal/suppliers', suppliers),
  ];
}

/**
 * Скачивание в jsdom: браузерной ссылки на содержимое здесь нет, а нажатие
 * на ссылку никуда не ведёт. Подменяются ровно эти две вещи — что кабинет
 * положил в файл и под каким именем отдал, проверяется по-настоящему.
 */
function captureDownloads() {
  const saved: { name: string; blob: Blob }[] = [];
  let last: Blob | undefined;

  // Присваиванием, а не подменой глобального `URL`: в jsdom этих методов нет
  // вовсе, и подменять там нечего. Снимаются они в `afterEach`.
  URL.createObjectURL = vi.fn((blob: Blob) => {
    last = blob;
    return 'blob:consent';
  });
  URL.revokeObjectURL = vi.fn();

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    saved.push({ name: this.download, blob: last as Blob });
  });

  return saved;
}

describe('согласия в профиле', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('показывает дату, редакцию и язык каждого согласия', async () => {
    stubFetch(profileRules(get('/api/portal/consents', [NEWER])));

    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    const row = await screen.findByTestId('consent-row');
    expect(row).toHaveTextContent('2026-09-08');
    // Язык — словом: «ru» в списке своих документов человеку не говорит ничего.
    expect(row).toHaveTextContent('Русский');
    expect(row).toHaveTextContent(/сентябр/i);
  });

  it('свежие сверху, в каком бы порядке ни пришли', async () => {
    stubFetch(profileRules(get('/api/portal/consents', [OLDER, NEWER])));

    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    const rows = await screen.findAllByTestId('consent-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('2026-09-08');
    expect(rows[1]).toHaveTextContent('2025-04-01');
    // Прошлое согласие остаётся своей редакции и своего языка: новая редакция
    // заводит новое согласие, а не переписывает старое.
    expect(rows[1]).toHaveTextContent('Қазақша');
  });

  it('пустой список объясняется словами, а не пустотой', async () => {
    stubFetch(profileRules(get('/api/portal/consents', [])));

    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    expect(await screen.findByTestId('consents-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('consent-row')).not.toBeInTheDocument();
  });

  it('скачивает документ и называет файл так, как назвал сервер', async () => {
    const { calls } = stubFetch(profileRules(
      file('/api/portal/consents/consent-new/pdf', '%PDF-1.4 согласие', 'soglasie-2026-09-08.pdf'),
      get('/api/portal/consents', [NEWER]),
    ));
    const saved = captureDownloads();

    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    await screen.findByTestId('consent-row');
    await userEvent.click(screen.getByRole('button', { name: /2026-09-08/ }));

    await waitFor(() => expect(saved).toHaveLength(1));
    // Имя приходит заголовком ответа: своё, придуманное кабинетом, разошлось бы
    // с тем, что называет редакцию, и в загрузках остались бы «consent (2).pdf».
    expect(saved[0].name).toBe('soglasie-2026-09-08.pdf');
    // Документ, разобранный как JSON, не документ: сюда обязан доехать файл.
    expect(saved[0].blob.type).toBe('application/pdf');
    expect(await saved[0].blob.text()).toContain('%PDF');

    expect(calls.some((call) => call.url.includes('/api/portal/consents/consent-new/pdf'))).toBe(true);
  });

  it('отказ сервера виден человеку, а не проглатывается', async () => {
    stubFetch(profileRules(
      get('/api/portal/consents/consent-new/pdf', { code: 'CONSENT_NOT_FOUND' }, 404),
      get('/api/portal/consents', [NEWER]),
    ));
    captureDownloads();

    renderScreen(<ProfilePage />, { supplierId: 'supplier-1' });

    await screen.findByTestId('consent-row');
    await userEvent.click(screen.getByRole('button', { name: /2026-09-08/ }));

    expect(await screen.findByTestId('consents-failed')).toBeInTheDocument();
  });

  // Согласий без поставщика не бывает: список отдаёт тот, у кого клиент заведён,
  // и запрос без выбора получил бы отказ вместо ответа.
  it('без выбранного поставщика за согласиями не ходит', async () => {
    const { calls } = stubFetch(profileRules());

    renderScreen(<ProfilePage />, { supplierId: null });

    await screen.findByText('СтройБаза Алматы');
    expect(calls.some((call) => call.url.includes('/api/portal/consents'))).toBe(false);
  });
});

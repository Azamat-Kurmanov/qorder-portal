import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewsBlock } from './ReviewsBlock';
import { renderScreen } from '../../test/render';
import { FakeXhr } from '../../test/fakeXhr';
import { get, method, stubFetch, type StubbedResponse } from '../../test/http';

const PHOTO_URL = '/api/files/f1';

const PUBLISHED = {
  id: 'r1',
  itemId: 'item-1',
  authorName: 'Асхат К.',
  rating: 5,
  text: 'Сел как надо',
  status: 'PUBLISHED',
  createdAt: '2026-09-12T10:00:00Z',
  tags: [],
  helpful: 0,
  helpfulByMe: false,
  mine: false,
  size: 'M',
  photos: [{ id: 'p1', url: PHOTO_URL }],
};

/** Снимок отзыва — файлом с типом картинки, как отдаёт сервер. */
function photo(path: string): StubbedResponse {
  return {
    match: (url, init) => url.includes(path) && (init?.method ?? 'GET') === 'GET',
    body: 'jpeg-bytes',
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  };
}

describe('фото и размер в отзыве', () => {
  const created: Blob[] = [];

  beforeEach(() => {
    created.length = 0;
    // jsdom не умеет ссылок на содержимое: подменяем, запоминая, что показали.
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return `blob:photo-${created.length}`;
    });
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('показывает фото миниатюрами и размер после даты', async () => {
    const { calls } = stubFetch([
      photo(PHOTO_URL),
      get('/api/portal/items/item-1/reviews', [PUBLISHED]),
    ]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview={false} />);

    const review = await screen.findByTestId('review');
    // «12 сентября · размер M» — как в макете: размер различает варианты модели.
    expect(within(review).getByText(/12 сентября · размер M/)).toBeInTheDocument();

    const strip = within(review).getByTestId('review-photos');
    // Фото лежит в хранилище поставщика и открывается постоянным адресом без входа:
    // картинка рисуется прямо по нему, без запроса с токеном и без ссылки на содержимое.
    expect(strip.querySelector('img')).toHaveAttribute('src', `${PHOTO_URL}?w=160`);
    expect(calls.some((call) => call.url.includes(PHOTO_URL))).toBe(false);

    // По нажатию — увеличение тем же окном, что снимки товара; курсор — лупа.
    expect(within(strip).getByRole('button', { name: /Фото 1 из 1/ })).toHaveClass('cursor-zoom-in');
    await userEvent.click(within(strip).getByRole('button', { name: /Фото 1 из 1/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('отзыв без размера и без фото показывает одну дату', async () => {
    stubFetch([get('/api/portal/items/item-1/reviews', [{ ...PUBLISHED, size: undefined, photos: [] }])]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview={false} />);

    const review = await screen.findByTestId('review');
    expect(within(review).queryByText(/размер/)).not.toBeInTheDocument();
    expect(within(review).queryByTestId('review-photos')).not.toBeInTheDocument();
  });

  it('без заявки заглушки «после покупки» нет — форма «Оцените товар»', async () => {
    // Оценить может любой клиент магазина: товар мог быть куплен и вне системы.
    stubFetch([get('/api/portal/items/item-1/reviews', [])]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview />);

    expect(await screen.findByText('Оцените товар')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отправить отзыв' })).toBeInTheDocument();
    expect(screen.queryByText(/Вы заказывали этот товар/)).not.toBeInTheDocument();
    expect(screen.queryByText(/после покупки/i)).not.toBeInTheDocument();
  });

  it('фото из формы уходят после отзыва, к его идентификатору', async () => {
    const saved = { ...PUBLISHED, status: 'PENDING', mine: true, size: undefined, photos: [] };
    const withPhoto = { ...saved, photos: [{ id: 'p1', url: PHOTO_URL }] };
    const { calls } = stubFetch([
      photo(PHOTO_URL),
      get('/api/portal/items/item-1/reviews', []),
      method('POST', '/api/portal/items/item-1/reviews', saved, 201),
      method('POST', '/api/portal/reviews/r1/photos', withPhoto, 201),
    ]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview sizeTags />);

    await userEvent.click(await screen.findByRole('radio', { name: /^Оценка 5 из 5/ }));
    expect(screen.getByPlaceholderText('Что понравилось, что нет? Как сел размер?')).toBeInTheDocument();

    const input = screen.getByTestId('review-photo-input') as HTMLInputElement;
    const shot = new File(['jpeg'], 'shot.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, shot);
    // Выбранное видно превью до отправки и убирается крестиком.
    expect(within(screen.getByTestId('review-form-photos')).getByRole('button', { name: 'Убрать фото 1' }))
      .toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    await waitFor(() => {
      const upload = calls.find((call) => call.url.includes('/api/portal/reviews/r1/photos')
        && call.init?.method === 'POST');
      expect(upload).toBeDefined();
      const body = upload?.init?.body as FormData;
      expect((body.get('file') as File).name).toBe('shot.jpg');
    });
    const order = calls.filter((call) => call.init?.method === 'POST').map((call) => call.url);
    expect(order[0]).toContain('/api/portal/items/item-1/reviews');
    expect(order[1]).toContain('/api/portal/reviews/r1/photos');

    // Отзыв встал в список уже со снимком.
    const review = await screen.findByTestId('review');
    expect(await within(review).findByTestId('review-photos')).toBeInTheDocument();
  });

  it('пока снимок уходит на сервер, видна полоса с процентом', async () => {
    const saved = { ...PUBLISHED, status: 'PENDING', mine: true, size: undefined, photos: [] };
    stubFetch([
      photo(PHOTO_URL),
      get('/api/portal/items/item-1/reviews', []),
      method('POST', '/api/portal/items/item-1/reviews', saved, 201),
    ]);
    FakeXhr.all = [];
    vi.stubGlobal('XMLHttpRequest', FakeXhr);

    renderScreen(<ReviewsBlock itemId="item-1" canReview sizeTags />);
    await userEvent.click(await screen.findByRole('radio', { name: /^Оценка 5 из 5/ }));
    await userEvent.upload(screen.getByTestId('review-photo-input') as HTMLInputElement,
      new File(['jpeg'], 'shot.jpg', { type: 'image/jpeg' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    await waitFor(() => expect(FakeXhr.all).toHaveLength(1));
    act(() => FakeXhr.all[0].progress(3, 4));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');

    act(() => FakeXhr.all[0].respond(201, { ...saved, photos: [{ id: 'p1', url: PHOTO_URL }] }));
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
  });

  it('без хранилища у поставщика кнопки фото нет, а отзыв отправляется', async () => {
    const saved = { ...PUBLISHED, status: 'PENDING', mine: true, size: undefined, photos: [] };
    const { calls } = stubFetch([
      get('/api/portal/reviews/photo-upload', { canUploadPhotos: false }),
      get('/api/portal/items/item-1/reviews', []),
      method('POST', '/api/portal/items/item-1/reviews', saved, 201),
    ]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview />);
    await userEvent.click(await screen.findByRole('radio', { name: /^Оценка 5 из 5/ }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Добавить фото' })).not.toBeInTheDocument());
    expect(screen.queryByTestId('review-photo-input')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));
    await waitFor(() => expect(calls.some((call) =>
      call.url.endsWith('/api/portal/items/item-1/reviews') && call.init?.method === 'POST')).toBe(true));
  });

  it('фото ссылкой на облако — и без хранилища: уходит после отзыва, другой сайт отклоняется', async () => {
    const saved = { ...PUBLISHED, status: 'PENDING', mine: true, size: undefined, photos: [] };
    const thumb = 'https://drive.google.com/thumbnail?id=1AbC_dEfG-42xyz&sz=w1600';
    const { calls } = stubFetch([
      get('/api/portal/reviews/photo-upload', { canUploadPhotos: false }),
      get('/api/portal/items/item-1/reviews', []),
      method('POST', '/api/portal/items/item-1/reviews', saved, 201),
      method('POST', '/api/portal/reviews/r1/photos/link', { ...saved, photos: [{ id: 'p1', url: thumb }] }, 201),
    ]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview />);
    await userEvent.click(await screen.findByRole('radio', { name: /^Оценка 5 из 5/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Добавить фото' })).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Вставить ссылку' }));
    await userEvent.type(screen.getByLabelText('Ссылка на фото'), 'https://example.com/me.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Google Диске, Dropbox или OneDrive');

    await userEvent.clear(screen.getByLabelText('Ссылка на фото'));
    await userEvent.type(screen.getByLabelText('Ссылка на фото'), 'https://drive.google.com/file/d/1AbC_dEfG-42xyz/view');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect([...screen.getByTestId('review-form-photos').querySelectorAll('img')].map((img) => img.getAttribute('src')))
      .toContain(thumb);

    await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));
    await waitFor(() => {
      const sent = calls.find((call) => call.url.endsWith('/api/portal/reviews/r1/photos/link'));
      expect(sent && JSON.parse(String(sent.init?.body))).toEqual({ url: 'https://drive.google.com/file/d/1AbC_dEfG-42xyz/view' });
    });
  });

  it('не тот файл и лишние снимки отклоняются понятными словами', async () => {
    stubFetch([get('/api/portal/items/item-1/reviews', [])]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview />);
    await userEvent.click(await screen.findByRole('radio', { name: /^Оценка 4 из 5/ }));

    const input = screen.getByTestId('review-photo-input') as HTMLInputElement;
    await userEvent.upload(input, [
      new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['x'], 'b.png', { type: 'image/png' }),
      new File(['x'], 'c.webp', { type: 'image/webp' }),
      new File(['x'], 'd.jpg', { type: 'image/jpeg' }),
    ]);
    expect(screen.getByText(/не больше 3 фото/)).toBeInTheDocument();
    expect(within(screen.getByTestId('review-form-photos')).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Добавить фото' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Убрать фото 3' }));
    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    await userEvent.upload(input, big);
    expect(screen.getByText(/«big\.jpg» больше 5 МБ/)).toBeInTheDocument();
  });

  it('при отказе загрузки фото форма остаётся открытой с выбранным снимком', async () => {
    const saved = { ...PUBLISHED, status: 'PENDING', mine: true, photos: [] };
    const { calls } = stubFetch([
      get('/api/portal/items/item-1/reviews', []),
      method('POST', '/api/portal/items/item-1/reviews', saved, 201),
      method('POST', '/api/portal/reviews/r1/photos', { code: 'REVIEW_PHOTO_UNSUPPORTED' }, 415),
    ]);

    renderScreen(<ReviewsBlock itemId="item-1" canReview />);
    await userEvent.click(await screen.findByRole('radio', { name: /^Оценка 5 из 5/ }));
    await userEvent.upload(screen.getByTestId('review-photo-input') as HTMLInputElement,
      new File(['x'], 'shot.jpg', { type: 'image/jpeg' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    expect(await screen.findByText(/не все фото загрузились/)).toBeInTheDocument();
    expect(within(screen.getByTestId('review-form-photos')).getAllByRole('listitem')).toHaveLength(1);
    expect(calls.some((call) => call.url.includes('/photos'))).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ItemMediaDto } from '../../api/generated';
import { MediaGallery } from './MediaGallery';

const photo = (n: number): ItemMediaDto => ({
  id: `p${n}`,
  kind: 'PHOTO',
  source: 'LINK',
  url: `https://cdn.example/${n}.jpg`,
  sortOrder: n * 10,
});

const VIDEO: ItemMediaDto = {
  id: 'v1',
  kind: 'VIDEO',
  source: 'UPLOAD',
  url: 'https://cdn.example/clip.mp4',
  sortOrder: 1000,
};

const EIGHT_PHOTOS = [1, 2, 3, 4, 5, 6, 7, 8].map(photo);

function renderGallery(media: ItemMediaDto[]) {
  return render(<MediaGallery media={media} itemName="Цемент М400" />);
}

/** Размер полосы: jsdom раскладки не считает, и ширина кадра у него ноль. */
function sizeTrack(track: HTMLElement, width: number) {
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: width });
}

function scrollTrackTo(track: HTMLElement, left: number) {
  Object.defineProperty(track, 'scrollLeft', { configurable: true, writable: true, value: left });
  fireEvent.scroll(track);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('галерея карточки: курсор', () => {
  it('снимок увеличивается — курсор лупа; ролик — нет', () => {
    renderGallery([photo(1), VIDEO]);

    expect(screen.getAllByRole('button', { name: 'Открыть снимок' })[0]).toHaveClass('cursor-zoom-in');
    expect(screen.getAllByRole('button', { name: 'Смотреть ролик', hidden: true })[0]).not.toHaveClass('cursor-zoom-in');
  });
});

describe('галерея карточки: все снимки и ролики', () => {
  /**
   * До сих пор на телефоне было видно только первый снимок, а ролики в ряд
   * миниатюр не входили вовсе: о седьмом фото и о видео человек узнавал,
   * только открыв полноэкранный просмотр.
   */
  it('в ленте миниатюр есть каждый снимок и каждый ролик, в порядке продавца', () => {
    renderGallery([...EIGHT_PHOTOS, VIDEO]);

    const strip = screen.getByRole('group', { name: 'Все фото и видео' });
    const thumbs = within(strip).getAllByRole('button');

    expect(thumbs).toHaveLength(9);
    expect(thumbs.map((thumb) => thumb.getAttribute('aria-label'))).toEqual([
      'Снимок 1', 'Снимок 2', 'Снимок 3', 'Снимок 4',
      'Снимок 5', 'Снимок 6', 'Снимок 7', 'Снимок 8', 'Видео 1',
    ]);
    expect(thumbs[0]).toHaveAttribute('aria-pressed', 'true');
    // Кадр ролика вместо пустой плитки: без кадра миниатюра не говорит,
    // что там снято.
    expect(thumbs[8].querySelector('video')).toHaveAttribute('src', `${VIDEO.url}#t=0.1`);
  });

  it('нажатие на седьмую миниатюру показывает седьмой снимок в большом окне', async () => {
    renderGallery([...EIGHT_PHOTOS, VIDEO]);

    await userEvent.click(screen.getByRole('button', { name: 'Снимок 7' }));

    expect(screen.getByTestId('gallery-photo')).toHaveAttribute('src', 'https://cdn.example/7.jpg');
    expect(screen.getByRole('button', { name: 'Снимок 7' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Снимок 1' })).toHaveAttribute('aria-pressed', 'false');
  });

  /**
   * На телефоне кадр листают пальцем: полоса кадров прокручивается
   * с привязкой, и выбранная миниатюра идёт за ней.
   */
  it('прокрутка полосы кадров пальцем меняет выбранный кадр', () => {
    renderGallery([...EIGHT_PHOTOS, VIDEO]);
    const track = screen.getByTestId('gallery-track');
    sizeTrack(track, 300);

    scrollTrackTo(track, 900);

    expect(screen.getByRole('button', { name: 'Снимок 4' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('gallery-photo')).toHaveAttribute('src', 'https://cdn.example/4.jpg');
  });

  it('касание по кадру после листания открывает во весь экран именно его', async () => {
    renderGallery([...EIGHT_PHOTOS, VIDEO]);
    const track = screen.getByTestId('gallery-track');
    sizeTrack(track, 300);
    scrollTrackTo(track, 600);

    await userEvent.click(screen.getByRole('button', { name: 'Открыть снимок' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('3 / 9')).toBeInTheDocument();
  });

  it('выбор ролика в ленте показывает его кадр, а нажатие по кадру запускает ролик', async () => {
    renderGallery([...EIGHT_PHOTOS, VIDEO]);

    await userEvent.click(screen.getByRole('button', { name: 'Видео 1' }));

    expect(screen.getByTestId('gallery-video-frame')).toHaveAttribute('src', `${VIDEO.url}#t=0.1`);
    expect(screen.queryByTestId('gallery-photo')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Смотреть ролик' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByTestId('lightbox-video')).toBeInTheDocument();
    expect(within(dialog).getByText('9 / 9')).toBeInTheDocument();
  });

  it('«следующее» на последнем кадре возвращает к первому, «предыдущее» на первом — к последнему', async () => {
    renderGallery([photo(1), photo(2), photo(3)]);

    await userEvent.click(screen.getByRole('button', { name: 'Снимок 3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Следующее фото' }));
    expect(screen.getByTestId('gallery-photo')).toHaveAttribute('src', 'https://cdn.example/1.jpg');

    await userEvent.click(screen.getByRole('button', { name: 'Предыдущее фото' }));
    expect(screen.getByTestId('gallery-photo')).toHaveAttribute('src', 'https://cdn.example/3.jpg');
  });

  it('выбранный кадр прокручивает полосу кадров к себе', async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, writable: true, value: scrollTo });
    try {
      renderGallery([...EIGHT_PHOTOS, VIDEO]);
      const track = screen.getByTestId('gallery-track');
      sizeTrack(track, 300);

      await userEvent.click(screen.getByRole('button', { name: 'Снимок 7' }));

      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 1800, behavior: 'smooth' }));
    } finally {
      delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
    }
  });

  it('при просьбе системы убрать движение полоса перескакивает без плавности', async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, writable: true, value: scrollTo });
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    try {
      renderGallery([...EIGHT_PHOTOS, VIDEO]);
      sizeTrack(screen.getByTestId('gallery-track'), 300);

      await userEvent.click(screen.getByRole('button', { name: 'Снимок 2' }));

      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 300, behavior: 'auto' }));
      expect(scrollTo).not.toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    } finally {
      delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
    }
  });

  it('на мониторе под снимком написано, который это снимок из скольких', async () => {
    renderGallery([...EIGHT_PHOTOS, VIDEO]);

    await userEvent.click(screen.getByRole('button', { name: 'Снимок 3' }));

    expect(screen.getByText('Фото 3 из 8')).toBeInTheDocument();
  });

  it('у позиции с одним снимком ленты миниатюр нет', () => {
    renderGallery([photo(1)]);

    expect(screen.queryByRole('group', { name: 'Все фото и видео' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Следующее фото' })).not.toBeInTheDocument();
  });

  it('на телефоне под лентой миниатюр запас под наезд листа карточки', () => {
    renderGallery([...EIGHT_PHOTOS, VIDEO]);
    // Лист карточки на телефоне поднят на 20 точек (-mt-5 в ItemCardPage):
    // без запаса он закрывал бы нижнюю часть миниатюр.
    const strip = screen.getByRole('group', { name: 'Все фото и видео' });
    expect(strip.className).toMatch(/(^|\s)pb-6(\s|$)/);
    expect(strip.className).toMatch(/(^|\s)md:pb-1(\s|$)/);
  });

  it('первое фото — место, куда перелетает фото плитки витрины (тот же снимок, что в плитке)', () => {
    const { container } = renderGallery([VIDEO, photo(1), photo(2)]);
    const named = [...container.querySelectorAll('img')].filter((img) => img.style.viewTransitionName === 'qo-item-photo');
    expect(named).toHaveLength(1);
    expect(named[0]).toHaveAttribute('src', 'https://cdn.example/1.jpg');
  });
});

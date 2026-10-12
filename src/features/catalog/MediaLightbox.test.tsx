import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ItemMediaDto } from '../../api/generated';
import { MediaGallery } from './MediaGallery';

const PHOTO_ONE: ItemMediaDto = {
  id: 'm1',
  kind: 'PHOTO',
  source: 'LINK',
  url: 'https://cdn.example/cement-1.jpg',
  title: 'Мешок 50 кг',
  sortOrder: 10,
  processing: false,
  failed: false,
};

const PHOTO_TWO: ItemMediaDto = {
  id: 'm2',
  kind: 'PHOTO',
  source: 'LINK',
  url: 'https://cdn.example/cement-2.jpg',
  sortOrder: 20,
  processing: false,
  failed: false,
};

const UPLOADED_VIDEO: ItemMediaDto = {
  id: 'm3',
  kind: 'VIDEO',
  source: 'UPLOAD',
  url: 'https://cdn.example/cement.mp4',
  sortOrder: 30,
  processing: false,
  failed: false,
};

function renderGallery(media: ItemMediaDto[]) {
  return render(<MediaGallery media={media} itemName="Цемент М400" />);
}

/** Диалог, открытый нажатием по кадру. */
async function openFromPhoto(media: ItemMediaDto[]) {
  renderGallery(media);
  await userEvent.click(screen.getByRole('button', { name: 'Открыть снимок' }));
  return screen.getByRole('dialog');
}

/** Диалог, открытый меткой ролика: у позиции, к которой приложили одно видео. */
async function openFromVideo(media: ItemMediaDto[]) {
  renderGallery(media);
  await userEvent.click(screen.getByRole('button', { name: 'Видео' }));
  return screen.getByRole('dialog');
}

describe('снимки и ролики во весь экран', () => {
  /**
   * Кадр в карточке маленький, и рассмотреть по нему товар нельзя.
   *
   * До сих пор нажатие по кадру перелистывало на соседний — то есть отвечало
   * на вопрос, которого никто не задавал: рассмотреть хотят тот, на который
   * смотрят.
   */
  it('нажатие по кадру открывает его во весь экран', async () => {
    const dialog = await openFromPhoto([PHOTO_ONE, PHOTO_TWO]);

    expect(within(dialog).getByRole('img', { name: 'Мешок 50 кг' }))
      .toHaveAttribute('src', PHOTO_ONE.url);
  });

  /**
   * Снимки и ролики — одна лента, а не два места.
   *
   * Ролик, лежавший отдельной ссылкой, уводил из карточки на голый файл,
   * откуда возвращаются только кнопкой браузера.
   */
  it('снимки и ролики листаются одной лентой', async () => {
    const dialog = await openFromPhoto([PHOTO_ONE, PHOTO_TWO, UPLOADED_VIDEO]);
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();

    const next = within(dialog).getByRole('button', { name: 'Следующий кадр' });
    await userEvent.click(next);
    expect(within(dialog).getByRole('img', { name: 'Цемент М400' }))
      .toHaveAttribute('src', PHOTO_TWO.url);

    await userEvent.click(next);
    // Метка времени в адресе — способ показать первый кадр вместо чёрного
    // прямоугольника; за неё отвечает сам проигрыватель.
    expect(within(dialog).getByTestId('lightbox-video'))
      .toHaveAttribute('src', `${UPLOADED_VIDEO.url}#t=0.1`);
    expect(within(dialog).getByText('3 / 3')).toBeInTheDocument();

    // По кругу: на последнем кадре «следующий» возвращает к первому, иначе
    // кнопка гаснет ровно там, где до неё дошли.
    await userEvent.click(next);
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();
  });

  it('загруженный к нам ролик проигрывается прямо в диалоге', async () => {
    const dialog = await openFromPhoto([PHOTO_ONE, UPLOADED_VIDEO]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Следующий кадр' }));

    // Кнопки свои, а не браузерные: серая полоса Chrome посреди тёмной сцены
    // читалась бы чужой деталью, наклеенной поверх.
    expect(within(dialog).getByTestId('lightbox-video')).not.toHaveAttribute('controls');
    expect(within(dialog).getByRole('button', { name: 'Смотреть ролик' })).toBeInTheDocument();
    expect(within(dialog).getByRole('slider', { name: 'Перемотка' })).toBeInTheDocument();
  });

  it('ссылка на YouTube показывается плеером площадки', async () => {
    const dialog = await openFromVideo([
      { ...UPLOADED_VIDEO, source: 'LINK', url: 'https://www.youtube.com/watch?v=abc123XYZ_1' },
    ]);

    expect(within(dialog).getByTestId('lightbox-embed'))
      .toHaveAttribute('src', expect.stringContaining('youtube.com/embed/abc123XYZ_1'));
  });

  it('ролик, загруженный на Google Диск продавца, показывается плеером Диска', async () => {
    const dialog = await openFromVideo([
      { ...UPLOADED_VIDEO, url: 'https://drive.google.com/file/d/drive-id_1/preview' },
    ]);

    expect(within(dialog).getByTestId('lightbox-embed'))
      .toHaveAttribute('src', 'https://drive.google.com/file/d/drive-id_1/preview');
  });

  /**
   * Чужая ссылка, которую браузер не потянул, остаётся ссылкой.
   *
   * Пустой чёрный прямоугольник вместо ролика читается поломкой карточки,
   * а не отказом чужого хранилища.
   */
  it('неузнанную ссылку, которую браузер не открыл, диалог оставляет ссылкой', async () => {
    const dialog = await openFromVideo([
      { ...UPLOADED_VIDEO, source: 'LINK', url: 'https://drive.example/clip' },
    ]);

    fireEvent.error(within(dialog).getByTestId('lightbox-video'));

    expect(within(dialog).getByRole('link', { name: 'Открыть ролик' }))
      .toHaveAttribute('href', 'https://drive.example/clip');
  });

  it('метка ролика на кадре открывает диалог сразу на нём', async () => {
    renderGallery([PHOTO_ONE, PHOTO_TWO, UPLOADED_VIDEO]);

    await userEvent.click(screen.getByRole('button', { name: 'Видео' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByTestId('lightbox-video')).toBeInTheDocument();
    expect(within(dialog).getByText('3 / 3')).toBeInTheDocument();
  });

  /**
   * Лента миниатюр под кадром — на широком экране.
   *
   * Стрелки показывают только соседний кадр, и до седьмого снимка человек
   * добирается шестью нажатиями, не зная, что там впереди.
   */
  it('по ленте миниатюр под кадром переходят к любому кадру сразу', async () => {
    const dialog = await openFromPhoto([PHOTO_ONE, PHOTO_TWO, UPLOADED_VIDEO]);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Кадр 3' }));

    expect(within(dialog).getByTestId('lightbox-video')).toBeInTheDocument();
    expect(within(dialog).getByText('3 / 3')).toBeInTheDocument();
  });

  /**
   * На кадре с роликом стрелки перематывают, а не листают ленту.
   *
   * Так они работают у любого проигрывателя, и человек, севший смотреть
   * ролик, нажимает их именно за этим. Лента остаётся на кнопках и свайпе.
   */
  it('стрелки на ролике перематывают его, а не уводят на соседний кадр', async () => {
    const dialog = await openFromPhoto([PHOTO_ONE, UPLOADED_VIDEO]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Следующий кадр' }));
    expect(within(dialog).getByText('2 / 2')).toBeInTheDocument();

    await userEvent.keyboard('{ArrowRight}');

    expect(within(dialog).getByText('2 / 2')).toBeInTheDocument();
  });

  /**
   * Позиция, к которой приложили только ролик.
   *
   * Полоса галереи рисуется и без снимков — на ней стоят «назад» и
   * «избранное», — но до сих пор это была пустая заливка: продавец приложил
   * видео, а карточка выглядела так, будто не приложили ничего. Кадр из
   * ролика система не достаёт, поэтому первый кадр показывает сам ролик.
   */
  it('у позиции без снимков полосу занимает первый кадр ролика', () => {
    renderGallery([UPLOADED_VIDEO]);

    expect(screen.getByTestId('gallery-video-frame'))
      .toHaveAttribute('src', `${UPLOADED_VIDEO.url}#t=0.1`);
  });

  it('диалог закрывается и возвращает карточку', async () => {
    const dialog = await openFromPhoto([PHOTO_ONE, PHOTO_TWO]);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoPlayer } from './VideoPlayer';

/**
 * jsdom не проигрывает ничего: `play`, `pause` и длительность у него
 * не реализованы вовсе. Подменяются они не ради обхода проверки, а потому
 * что проверяется проигрыватель, а не декодер браузера: он обязан вести себя
 * по СОБЫТИЯМ ролика — `play`, `pause`, `timeupdate`, — а не по тому, что сам
 * же и попросил. Ролик, не начавший играть по нажатию, оставит кнопку
 * «пуск», и это правильно.
 */
function stubMediaElement() {
  const play = vi.fn(function play(this: HTMLMediaElement) {
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  const pause = vi.fn(function pause(this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'));
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });

  return { play, pause };
}

/** Ролик, у которого известна длительность: до `loadedmetadata` её нет. */
function loadMetadata(video: HTMLVideoElement, seconds: number) {
  Object.defineProperty(video, 'duration', { configurable: true, value: seconds });
  fireEvent.loadedMetadata(video);
}

/** Где ролик сейчас. Свойство приходится объявлять: jsdom его не двигает. */
function moveTo(video: HTMLVideoElement, seconds: number) {
  Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: seconds });
  fireEvent.timeUpdate(video);
}

function renderPlayer() {
  render(<VideoPlayer src="https://cdn.example/cement.mp4" label="Цемент М400" />);
  return screen.getByTestId('lightbox-video') as HTMLVideoElement;
}

describe('проигрыватель ролика', () => {
  beforeEach(() => stubMediaElement());
  afterEach(() => vi.restoreAllMocks());

  /**
   * Пустой тёмный прямоугольник не приглашает ни к чему.
   *
   * Ролик не запускается сам — карточку открывают с телефона, — и до первого
   * нажатия человек обязан видеть, что здесь вообще есть что смотреть.
   */
  it('до пуска поверх кадра стоит крупная кнопка', () => {
    renderPlayer();

    expect(screen.getByRole('button', { name: 'Смотреть ролик' })).toBeInTheDocument();
  });

  /**
   * До пуска на кадре стоит первый кадр ролика, а не чёрный прямоугольник.
   *
   * Так это устроено у всех, кто показывает видео, и не из моды: по кадру
   * видно, что снято, и нажимают на пуск, зная зачем. Отдельной картинки
   * продавец не прикладывает — сервер её и не просит, — поэтому кадр берётся
   * у самого ролика: браузеру говорят загрузить заголовок и встать на десятую
   * долю секунды, и он рисует то, что там оказалось.
   */
  it('до пуска на кадре стоит первый кадр самого ролика', () => {
    const video = renderPlayer();

    expect(video).toHaveAttribute('preload', 'metadata');
    expect(video).toHaveAttribute('src', 'https://cdn.example/cement.mp4#t=0.1');
  });

  it('нажатие пускает ролик, и кнопка становится паузой', async () => {
    const { play } = stubMediaElement();
    renderPlayer();

    await userEvent.click(screen.getByRole('button', { name: 'Смотреть ролик' }));

    expect(play).toHaveBeenCalled();
    // Состояние берётся из события ролика, а не из собственной догадки:
    // ролик, которому браузер отказал в проигрывании, оставит кнопку «пуск».
    expect(screen.getByRole('button', { name: 'Пауза' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Смотреть ролик' })).not.toBeInTheDocument();
  });

  /**
   * Время — цифрами, а не только положением ручки.
   *
   * «Сколько осталось» — первое, что спрашивают у ролика с характеристиками
   * товара, и полоса без чисел на это не отвечает.
   */
  it('время идёт от нуля к длительности', () => {
    const video = renderPlayer();

    loadMetadata(video, 100);
    expect(screen.getByText('0:00 / 1:40')).toBeInTheDocument();

    moveTo(video, 12);
    expect(screen.getByText('0:12 / 1:40')).toBeInTheDocument();
  });

  it('перемотка ведёт ролик туда, куда её поставили', () => {
    const video = renderPlayer();
    loadMetadata(video, 100);
    Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 0 });

    fireEvent.change(screen.getByRole('slider', { name: 'Перемотка' }), { target: { value: '30' } });

    expect(video.currentTime).toBe(30);
  });

  it('звук выключается и включается одной кнопкой', async () => {
    const video = renderPlayer();

    await userEvent.click(screen.getByRole('button', { name: 'Выключить звук' }));
    expect(video.muted).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Включить звук' }));
    expect(video.muted).toBe(false);
  });

  /**
   * Пробел — то, чем ставят ролик на паузу везде.
   *
   * Кнопка при этом остаётся: клавиатура тут не замена нажатию, а короткий
   * путь для того, кто уже смотрит и не хочет искать курсором панель,
   * которая к тому времени уже уехала.
   */
  it('пробел ставит ролик на паузу и снимает с неё', async () => {
    const { play, pause } = stubMediaElement();
    renderPlayer();

    await userEvent.keyboard(' ');
    expect(play).toHaveBeenCalled();

    await userEvent.keyboard(' ');
    expect(pause).toHaveBeenCalled();
  });

  /**
   * Пока ролик буферится, на кадре обязано что-то происходить.
   *
   * Замерший кадр без признака загрузки читается поломкой, и человек уходит
   * из карточки раньше, чем ролик успевает начаться.
   */
  it('на время загрузки на кадре стоит признак ожидания', () => {
    const video = renderPlayer();

    fireEvent.waiting(video);
    expect(screen.getByTestId('video-waiting')).toBeInTheDocument();

    fireEvent.playing(video);
    expect(screen.queryByTestId('video-waiting')).not.toBeInTheDocument();
  });
});

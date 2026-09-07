import { beforeEach } from 'vitest';
import { configure } from '@testing-library/dom';
import i18n from '../i18n';
import '@testing-library/jest-dom/vitest';

/**
 * Ожидание появления элемента — пять секунд вместо секунды по умолчанию.
 *
 * Набор идёт двумя десятками файлов параллельно, и под такой нагрузкой экран,
 * ждущий ответа заглушенной сети, изредка не успевал отрисоваться за секунду.
 * Падение при этом выглядело как поломка экрана, хотя ломались только часы:
 * тот же тест в одиночку проходил всегда. Проверяется поведение, а не
 * скорость машины, на которой запущен набор.
 */
configure({ asyncUtilTimeout: 5000 });

/**
 * Тесты идут на русском.
 *
 * Русский словарь — эталон: строки переехали в него из разметки дословно,
 * и проверки ищут те же подписи, что и раньше. Сам по себе кабинет язык
 * не выбирает — его определяет браузер, а в jsdom `navigator.language`
 * равен `en-US`, и без этой строки весь набор искал бы русские подписи
 * на английском экране.
 *
 * Язык возвращается перед каждой проверкой: тест, менявший его по делу
 * (заголовок запроса, переключатель), не должен оставлять соседям чужой.
 */
void i18n.changeLanguage('ru');

beforeEach(async () => {
  if (i18n.resolvedLanguage !== 'ru') await i18n.changeLanguage('ru');
});

/**
 * jsdom не реализует ни medium-запросы, ни наблюдение за размером элемента,
 * а библиотека интерфейса опирается на оба: без них падает не проверка,
 * а сам рендер, и разобраться в этом по стектрейсу тяжело.
 *
 * Заглушки нарочно тупые: «ничего не совпало» и «ничего не наблюдаем».
 * Экраны кабинета не строят логику на медиа-запросах — mobile-first значит,
 * что узкий экран это норма, а не ветка.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', { writable: true, value: NoopResizeObserver });

/**
 * Шрифтов в jsdom нет, а поле комментария подстраивает высоту после их
 * загрузки и подписывается на событие. Без заглушки падает рендер экрана
 * оформления целиком — и выглядит это как поломка экрана, а не среды.
 */
if (!('fonts' in document)) {
  Object.defineProperty(document, 'fonts', {
    writable: true,
    value: {
      addEventListener: () => {},
      removeEventListener: () => {},
      ready: Promise.resolve(),
    },
  });
}

/**
 * Появление при скролле смотрит, попал ли элемент в окно, — а этого jsdom
 * не умеет тоже. Заглушка сообщает «виден» сразу: в тесте нет ни прокрутки,
 * ни высоты окна, и элемент, ожидающий появления, не появился бы никогда.
 */
class ImmediateIntersectionObserver {
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: ImmediateIntersectionObserver,
});
Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: ImmediateIntersectionObserver,
});

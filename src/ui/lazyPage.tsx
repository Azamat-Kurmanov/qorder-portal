import { lazy, type ComponentType } from 'react';

/**
 * Раздел отдельным куском, который можно догрузить заранее.
 *
 * Обычный `lazy` приостанавливает первый показ даже уже скачанного модуля,
 * и React придерживает такой показ ещё на 300 мс: первый вход в каждый раздел
 * стоил трети секунды пустого экрана, а запрос данных раздела ждал вместе с ним.
 * Здесь `preload()` скачивает кусок заранее, и раздел, чей модуль уже на месте,
 * рисуется сразу, без приостановки. Не скачан — прежний `lazy`.
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<ComponentType<P>> | undefined;
  const preload = () => (pending ??= load().then(
    (component) => (loaded = component),
    (error: unknown) => {
      // Сбой сети при заблаговременной загрузке не должен навсегда закрыть раздел.
      pending = undefined;
      throw error;
    },
  ));
  const Lazy = lazy(() => preload().then((component) => ({ default: component })));
  function Page(props: P) {
    const Loaded = loaded;
    return Loaded ? <Loaded {...props} /> : <Lazy {...props} />;
  }
  return Object.assign(Page, { preload });
}

/**
 * Догрузить разделы, когда браузер свободен: стартовый экран уже нарисован,
 * а переход в любой раздел потом не ждёт сети. Экономия трафика — не догружаем.
 */
export function preloadWhenIdle(pages: { preload: () => Promise<unknown> }[]): () => void {
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return () => {};
  const run = () => pages.forEach((page) => void page.preload().catch(() => undefined));
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 1500);
  return () => window.clearTimeout(id);
}

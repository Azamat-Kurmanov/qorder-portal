import type { createBrowserRouter } from 'react-router-dom';

type DataRouter = ReturnType<typeof createBrowserRouter>;

/** Переход разрешён: не «спокойно» в оболочке и не системное «уменьшить движение». */
function allowed(): boolean {
  if (document.querySelector('[data-motion="calm"]')) return false;
  return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Плавные переходы между экранами — одной точкой: каждая навигация роутера
 * (`Link`, `NavLink`, `navigate()`) по умолчанию идёт с `viewTransition`, и роутер
 * сам оборачивает смену экрана в `document.startViewTransition`. Вид — `liveTheme.css`
 * (`::view-transition-*`). Браузер без View Transitions — просто навигация.
 * ponytail: подмена метода роутера; если React Router даст глобальный флаг — заменить им.
 */
export function withViewTransitions(router: DataRouter): DataRouter {
  const navigate = router.navigate.bind(router);
  router.navigate = ((to: Parameters<DataRouter['navigate']>[0], options?: { viewTransition?: boolean }) => {
    if (typeof to === 'number') return navigate(to);
    // Ссылки передают `viewTransition: undefined` явно — это не отказ; отказ — только `false`.
    return navigate(to, { ...options, viewTransition: options?.viewTransition ?? allowed() });
  }) as DataRouter['navigate'];
  return router;
}

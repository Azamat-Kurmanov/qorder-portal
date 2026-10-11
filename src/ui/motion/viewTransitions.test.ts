import { afterEach, describe, expect, it, vi } from 'vitest';
import { withViewTransitions } from './viewTransitions';

afterEach(() => { document.body.innerHTML = ''; });

function fakeRouter() {
  const navigate = vi.fn();
  return { router: { navigate } as unknown as Parameters<typeof withViewTransitions>[0], navigate };
}

describe('переходы между экранами', () => {
  it('навигация по умолчанию — с плавным переходом', () => {
    const { router, navigate } = fakeRouter();
    withViewTransitions(router);
    void router.navigate('/catalog/i1');
    expect(navigate).toHaveBeenCalledWith('/catalog/i1', { viewTransition: true });
  });

  it('ссылки передают `viewTransition: undefined` — это не отказ, переход включается', () => {
    const { router, navigate } = fakeRouter();
    withViewTransitions(router);
    void router.navigate('/catalog', { viewTransition: undefined, replace: false });
    expect(navigate).toHaveBeenLastCalledWith('/catalog', { viewTransition: true, replace: false });
  });

  it('при «Спокойно» — без перехода; явный отказ вызывающего уважается', () => {
    const { router, navigate } = fakeRouter();
    withViewTransitions(router);
    document.body.innerHTML = '<div data-motion="calm"></div>';
    void router.navigate('/orders');
    expect(navigate).toHaveBeenLastCalledWith('/orders', { viewTransition: false });
    document.body.innerHTML = '';
    void router.navigate('/orders', { viewTransition: false, replace: true });
    expect(navigate).toHaveBeenLastCalledWith('/orders', { viewTransition: false, replace: true });
  });

  it('шаг по истории (число) — как есть', () => {
    const { router, navigate } = fakeRouter();
    withViewTransitions(router);
    void router.navigate(-1);
    expect(navigate).toHaveBeenLastCalledWith(-1);
  });
});

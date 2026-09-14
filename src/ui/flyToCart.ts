/**
 * Признак места, куда улетает позиция.
 *
 * Ставится на значок заявки в шапке (телефон) и на заголовок колонки заявки
 * (монитор). Их два в разметке, но видно всегда ровно одно — раскладки
 * взаимоисключающие, — и полёт целится в то, которое на экране.
 */
export const CART_TARGET = 'data-cart-target';

/**
 * Позиция улетает в заявку.
 *
 * Зачем вообще: «В корзину» нажимают внизу длинной витрины, а заявка живёт
 * наверху или справа. Между нажатием и ответом сервера не происходит ничего,
 * и добросовестный закупщик, не поверив, кладёт ту же позицию второй раз.
 * Летящий снимок отвечает на вопрос «куда оно делось» в тот же кадр, когда
 * палец отпустил кнопку, — до всякого ответа сервера.
 *
 * Летит КОПИЯ снимка, а не цветная точка: точка сообщает «что-то
 * произошло», копия — «туда уехал вот этот мешок цемента». На витрине,
 * где строки похожи друг на друга, это разные сообщения.
 *
 * Копия лежит поверх страницы и не ловит нажатий: пока она летит, витрина
 * остаётся рабочей — следующую позицию кладут, не дожидаясь конца полёта.
 *
 * Ничего не делает и молчит, если: настроено «меньше движения»; места
 * назначения на экране нет; источник или цель не занимают места (экран
 * перестроился между нажатием и полётом); браузер не умеет Web Animations
 * (и jsdom в проверках — там полёта нет, а нажатие обязано работать).
 */
export function flyToCart(source: Element | null | undefined): void {
  if (!source || typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const target = visibleCartTarget();
  if (!target) return;

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (from.width === 0 || from.height === 0 || to.width === 0) return;

  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.setAttribute('aria-hidden', 'true');
  // Копия не должна попасться проверкам и поиску по странице как второй
  // такой же элемент: признаки, по которым узнают настоящий, с неё снимаются.
  ghost.removeAttribute('data-testid');
  ghost.removeAttribute('id');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
    borderRadius: '14px',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '60',
    boxShadow: '0 14px 30px -16px rgb(74 58 36 / 0.5)',
  } satisfies Partial<CSSStyleDeclaration>);

  document.body.append(ghost);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  /*
   * Дуга, а не прямая: по прямой предмет не летит — он падает или его
   * бросают. Средняя точка приподнята на шестьдесят точек над хордой,
   * и путь читается броском.
   */
  const flight = ghost.animate?.(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      {
        transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 60}px) scale(0.7)`,
        opacity: 0.9,
        offset: 0.45,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(0.18)`, opacity: 0.15 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.35, 0.15, 0.3, 1)', fill: 'forwards' },
  );

  if (!flight) {
    ghost.remove();
    return;
  }

  // Убирается и по концу, и по отмене: анимация прерывается, когда вкладку
  // увели в фон, — и незакрытая копия осталась бы висеть поверх витрины.
  flight.onfinish = () => ghost.remove();
  flight.oncancel = () => ghost.remove();
}

/**
 * Видимое место назначения.
 *
 * Именно видимое: в разметке заявка отмечена дважды — значком в шапке
 * телефона и заголовком колонки на мониторе, — и спрятанный классом
 * элемент вернул бы прямоугольник в нулевых координатах, то есть полёт
 * в левый верхний угол страницы.
 */
function visibleCartTarget(): Element | null {
  const marked = document.querySelectorAll(`[${CART_TARGET}]`);
  for (const element of marked) {
    if (element.getClientRects().length > 0) return element;
  }
  return null;
}

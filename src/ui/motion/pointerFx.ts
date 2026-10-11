/** Наибольший наклон карточки за курсором, градусы. */
const TILT = 6;

/**
 * Эффекты под курсором: один слушатель `pointermove` на весь кабинет.
 * Карточке под курсором (`[data-fx]`) пишутся место курсора (`--px`, `--py`,
 * для свечения) и наклон (`--rx`, `--ry`, от −6 до 6), и ставится
 * `data-fx-on`; вид — правила `qo-tile-*` в `index.css`. Курсор ушёл —
 * всё снимается. `enabled` спрашивается на каждом движении: уровень и
 * указатель могут смениться, пока страница открыта.
 */
export function attachPointerFx(root: HTMLElement, enabled: () => boolean): () => void {
  let current: HTMLElement | null = null;
  let frame = 0;

  const release = () => {
    current?.removeAttribute('data-fx-on');
    current = null;
  };

  const onMove = (event: PointerEvent) => {
    const card = enabled() ? (event.target as Element | null)?.closest<HTMLElement>('[data-fx]') ?? null : null;
    if (card !== current) release();
    if (!card) return;
    current = card;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const box = card.getBoundingClientRect();
      const x = clientX - box.left;
      const y = clientY - box.top;
      const round = (value: number) => String(Math.round(value * 100) / 100);
      card.style.setProperty('--px', `${Math.round(x)}px`);
      card.style.setProperty('--py', `${Math.round(y)}px`);
      card.style.setProperty('--rx', round((x / box.width - 0.5) * 2 * TILT));
      card.style.setProperty('--ry', round((0.5 - y / box.height) * 2 * TILT));
      card.setAttribute('data-fx-on', '');
    });
  };

  root.addEventListener('pointermove', onMove, { passive: true });
  root.addEventListener('pointerleave', release);
  return () => {
    cancelAnimationFrame(frame);
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', release);
    release();
  };
}

/** Эффекты под курсором включены: «ярко» на оболочке и точный указатель с наведением. */
export function pointerFxEnabled(root: HTMLElement): boolean {
  return root.dataset.motion === 'vivid' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
}

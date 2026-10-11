const COUNT = 120;
const DURATION = 1600;

/**
 * Холст во весь экран поверх страницы: частицы цветом магазина и вторым
 * цветом летят из верхней середины и падают, через 1,6 с холст убирается.
 * Нажатиям не мешает. Без 2D-контекста (старый браузер, jsdom) — ничего.
 */
export function burst(): void {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const [width, height] = [window.innerWidth, window.innerHeight];
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '70' });
  document.body.append(canvas);
  ctx.scale(ratio, ratio);
  const css = getComputedStyle(document.documentElement);
  const colors = ['--color-shop', '--color-accent2'].map((name) => css.getPropertyValue(name).trim()).filter(Boolean);
  const pieces = Array.from({ length: COUNT }, (_, i) => ({
    x: width / 2, y: height * 0.25,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 4,
    size: 5 + Math.random() * 5, turn: Math.random() * Math.PI,
    color: colors[i % Math.max(colors.length, 1)] ?? 'currentColor',
  }));
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Math.max(0, 1 - t / DURATION);
    for (const p of pieces) {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.turn += 0.2;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.turn);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

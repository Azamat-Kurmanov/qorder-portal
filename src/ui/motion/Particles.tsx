import { useEffect, useRef } from 'react';

const COUNT = 70;
const REACH = 110;

/**
 * Частицы, расступающиеся от курсора. Цвет — фирменный цвет поставщика
 * (`--color-shop`); холст во весь экран, с поправкой на плотность пикселей.
 * Без 2D-контекста (старый браузер, проверки в jsdom) — просто пустой холст.
 * Цикл кадров в фоновой вкладке браузер останавливает сам.
 */
export default function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const color = getComputedStyle(canvas).getPropertyValue('--color-shop').trim() || 'currentColor';
    let width = 0;
    let height = 0;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const dots = Array.from({ length: COUNT }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    }));
    const pointer = { x: -1e4, y: -1e4 };
    const move = (event: PointerEvent) => { pointer.x = event.clientX; pointer.y = event.clientY; };
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      for (const dot of dots) {
        const dx = dot.x - pointer.x;
        const dy = dot.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < REACH && distance > 0) {
          dot.x += (dx / distance) * (REACH - distance) * 0.05;
          dot.y += (dy / distance) * (REACH - distance) * 0.05;
        }
        dot.x = (dot.x + dot.vx + width) % width;
        dot.y = (dot.y + dot.vy + height) % height;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 size-full opacity-40" />;
}

/** Просит ли система убрать движение: тогда прокрутка перескакивает, а не едет. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

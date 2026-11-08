import { useEffect, type RefObject } from 'react';

/** Закрыть выплывающее меню щелчком мимо него и клавишей Esc. */
export function useDismiss(open: boolean, close: () => void, box: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) close(); };
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open, close, box]);
}

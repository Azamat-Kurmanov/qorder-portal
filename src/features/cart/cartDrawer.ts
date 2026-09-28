import { useSyncExternalStore } from 'react';

/**
 * Выдвижная корзина и уведомление «Добавлено» — одно состояние на кабинет.
 *
 * Корзину открывают из шапки, из колонки разделов и из уведомления после
 * добавления, а рисует её оболочка. Состояние поэтому живёт модулем, а не
 * в оболочке: иначе витрине, где кладут товар, пришлось бы получать
 * «открой корзину» через три слоя свойств.
 */
interface DrawerState {
  open: boolean;
  /** Что только что положили — для уведомления; пусто — уведомления нет. */
  added: string;
  /** Почему корзина не изменилась; пусто — всё прошло. */
  failed: string;
}

let state: DrawerState = { open: false, added: '', failed: '' };
const listeners = new Set<() => void>();
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function set(next: DrawerState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCartDrawer(): DrawerState {
  return useSyncExternalStore(subscribe, () => state);
}

export function openCart() {
  clearTimeout(hideTimer);
  set({ ...state, open: true, added: '' });
}

export function closeCart() {
  set({ ...state, open: false });
}

export function toggleCart() {
  if (state.open) closeCart();
  else openCart();
}

/**
 * «Добавлено: …» внизу экрана на три секунды — с кнопкой «Открыть корзину».
 * При открытой корзине уведомления нет: добавленное и так видно в ней.
 */
export function announceAdded(name: string) {
  if (state.open) return;
  clearTimeout(hideTimer);
  set({ ...state, added: name, failed: '' });
  hideTimer = setTimeout(() => set({ ...state, added: '' }), 3000);
}

/**
 * «Не получилось изменить корзину» — на всех экранах и при открытой корзине:
 * нажатие, которое молча ничего не сделало, закупщик повторит или решит,
 * что товар уже лежит.
 */
export function announceFailed(message: string) {
  clearTimeout(hideTimer);
  set({ ...state, added: '', failed: message });
  hideTimer = setTimeout(() => set({ ...state, failed: '' }), 5000);
}

/** Сброс между тестами: состояние модуля переживает размонтирование экрана. */
export function resetCartDrawer() {
  clearTimeout(hideTimer);
  set({ open: false, added: '', failed: '' });
}

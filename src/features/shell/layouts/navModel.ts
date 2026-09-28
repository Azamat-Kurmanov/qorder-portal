import { useLocation } from 'react-router-dom';
import { cartOf, useCart } from '../../cart/useCart';
import { MORE_SECTIONS, isActive, useMainSections, type Section } from '../sections';

/**
 * Что нужно любой строке разделов шаблона: главные разделы, число товаров
 * со скидкой, позиций в корзине, открыт ли раздел из «Ещё».
 *
 * Корзина среди разделов — не ссылка, а кнопка выдвижной корзины: уводить
 * с витрины ради взгляда на состав незачем (`isCart`).
 */
export function useNavModel(ready: boolean) {
  const { pathname } = useLocation();
  const { sections, deals } = useMainSections(ready);
  const lines = cartOf(useCart(ready).data)?.lines.length ?? 0;
  return {
    current: pathname,
    sections,
    deals,
    lines,
    inMore: MORE_SECTIONS.some((section) => isActive(section, pathname)),
    active: (section: Section) => isActive(section, pathname),
    isCart: (section: Section) => section.path === '/checkout',
  };
}

/** Счётчик у пункта: скидки у «Акций», позиции у «Корзины». */
export const COUNT_PILL = 'inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-pill)] bg-sale px-1.5 text-2xs font-extrabold text-white';

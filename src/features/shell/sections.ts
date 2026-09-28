import {
  Building2,
  ClipboardList,
  Heart,
  LayoutGrid,
  LayoutTemplate,
  MessageCircleQuestion,
  ShoppingCart,
  Star,
  Tag,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useGetPortalPromotions } from '../../api/generated';
import { promotionsOff } from '../promotions/promotionsOff';

/*
 * Разделы кабинета — одни на все раскладки: колонку, рейку, строку под
 * шапкой, плавающую панель, док и колонку «разворота».
 */

export interface Section {
  key: string;
  path: string;
  icon: LucideIcon;
}

/**
 * Разделы, за которыми приходят каждый раз: витрина, корзина, свои заявки
 * и избранное. Они стоят на виду — в колонке на мониторе и в нижнем меню
 * телефона.
 *
 * Хранится ключ, а не подпись: подпись зависит от языка, а список считается
 * один раз на модуле. Значок от языка не зависит и лежит рядом с путём:
 * раздел узнают по нему с одного взгляда, не перечитывая список.
 */
const MAIN_SECTIONS: Section[] = [
  { key: 'catalog', path: '/catalog', icon: LayoutGrid },
  { key: 'promotions', path: '/promotions', icon: Tag },
  { key: 'checkout', path: '/checkout', icon: ShoppingCart },
  { key: 'orders', path: '/orders', icon: ClipboardList },
  { key: 'favorites', path: '/favorites', icon: Heart },
];

/**
 * Главные разделы, которые стоит показать, и число товаров со скидкой.
 *
 * «Акции и скидки» пропадают из меню, когда у магазина не включено ни одной
 * акции, — так обещает продавцу предпросмотр в его настройках. Пока ответ
 * не пришёл, раздел на месте: мигающее меню хуже лишнего пункта.
 */
export function useMainSections(enabled: boolean): { sections: Section[]; deals: number } {
  const promotions = useGetPortalPromotions({ query: { enabled } });
  const data = promotions.data?.status === 200 ? promotions.data.data : undefined;
  const hidden = data !== undefined && promotionsOff(data);
  return {
    sections: hidden ? MAIN_SECTIONS.filter((section) => section.path !== '/promotions') : MAIN_SECTIONS,
    deals: data?.dealCount ?? 0,
  };
}

/**
 * Разделы, которые открывают реже: они спрятаны под «Ещё», чтобы не
 * отнимать у главных место и взгляд.
 */
export const MORE_SECTIONS: Section[] = [
  { key: 'templates', path: '/templates', icon: LayoutTemplate },
  { key: 'questions', path: '/questions', icon: MessageCircleQuestion },
  { key: 'reviews', path: '/reviews', icon: Star },
  { key: 'delivery', path: '/delivery', icon: Truck },
  { key: 'profile', path: '/profile', icon: Building2 },
];

/** Открыт ли раздел: у заявок и карточек есть вложенные адреса. */
export function isActive(section: Section, current: string): boolean {
  return current === section.path
    || (section.path !== '/catalog' && current.startsWith(`${section.path}/`))
    || (section.path === '/catalog' && current.startsWith('/catalog/'));
}

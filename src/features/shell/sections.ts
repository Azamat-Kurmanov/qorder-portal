import {
  Building2,
  ClipboardList,
  Heart,
  House,
  LayoutGrid,
  LayoutTemplate,
  MessageCircleQuestion,
  ShoppingCart,
  Star,
  Tag,
  Truck,
  type IconComponent,
} from '../../ui/icons';
import { useGetPortalCatalogCounts, useGetPortalPromotions } from '../../api/generated';
import { NewArrivalsIcon } from '../arrivals/NewArrivalsIcon';
import { promotionsOff } from '../promotions/promotionsOff';

/*
 * Разделы кабинета — одни на все раскладки: колонку, рейку, строку под
 * шапкой, плавающую панель, док и колонку «разворота».
 */

export interface Section {
  key: string;
  path: string;
  icon: IconComponent;
}

/** «Главная» — плитки всех разделов и то, что ждёт клиента. */
export const HOME_SECTION: Section = { key: 'home', path: '/home', icon: House };

/** «Новые поступления»: виден, пока у магазина есть действующие новинки. */
export const ARRIVALS: Section = { key: 'newArrivals', path: '/new-arrivals', icon: NewArrivalsIcon as IconComponent };

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
 * Главные разделы, которые стоит показать, число товаров со скидкой и новинок.
 *
 * «Акции и скидки» пропадают из меню, когда у магазина не включено ни одной
 * акции, — так обещает продавцу предпросмотр в его настройках. Пока ответ
 * не пришёл, раздел на месте: мигающее меню хуже лишнего пункта.
 *
 * «Новые поступления» встают сразу за каталогом, пока новинки есть, — туда
 * смотрят первым делом; кончились — пункт уходит, пустой раздел не зовёт.
 */
export function useMainSections(enabled: boolean): { sections: Section[]; deals: number; arrivals: number } {
  const promotions = useGetPortalPromotions({ query: { enabled } });
  const data = promotions.data?.status === 200 ? promotions.data.data : undefined;
  const hidden = data !== undefined && promotionsOff(data);
  const counts = useGetPortalCatalogCounts(undefined, { query: { enabled } });
  const arrivals = counts.data?.status === 200 ? counts.data.data.novelty ?? 0 : 0;
  const shown = hidden ? MAIN_SECTIONS.filter((section) => section.path !== '/promotions') : MAIN_SECTIONS;
  return {
    sections: arrivals > 0 ? [shown[0], ARRIVALS, ...shown.slice(1)] : shown,
    deals: data?.dealCount ?? 0,
    arrivals,
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

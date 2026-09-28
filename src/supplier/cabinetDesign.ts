import { useGetPortalSuppliers, type PortalSupplierDto } from '../api/generated';
import registry from './cabinetTemplates.json';
import festive from './cabinetOccasions.json';
import { useSupplier } from './useSupplier';

/**
 * Дизайн кабинета клиента, который публикует продавец: шаблон, фирменный
 * цвет, фон и тема при первом входе.
 *
 * Реестр шаблонов (`cabinetTemplates.json`) — общий файл с кабинетом
 * сотрудников: продавец выбирает шаблон по предпросмотру там, а применяется
 * он здесь. Держать два описания одного шаблона значило бы однажды показать
 * покупателю не то, что продавец видел в предпросмотре.
 */

/**
 * Раскладка меню на мониторе: колонка, строка сверху, узкая рейка, нижнее
 * меню, плавающая стеклянная панель, док снизу, колонка справа, разворот
 * с колонкой-историей магазина, узкая лента по центру, вкладки категорий.
 */
export type CabinetLayout = 'side' | 'top' | 'rail' | 'bottom' | 'floating' | 'dock' | 'right' | 'split' | 'center' | 'tabs';
/**
 * Вид витрины: карточки, крупные карточки, мелкие карточки, таблица строк,
 * бенто (первая карточка вдвое крупнее), лента крупных снимков, карточки-строки,
 * мозаика разной высоты, полки по рубрикам.
 */
export type CatalogView = 'grid' | 'big' | 'grid4' | 'list' | 'bento' | 'feed' | 'rows' | 'masonry' | 'shelves';
/** Как карточка отделяется от фона: линией, тенью или ничем. */
export type CardStyle = 'border' | 'shadow' | 'none';

/**
 * Характер шаблона — то, чем он отличается от соседа кроме цвета и раскладки:
 * главный баннер (`hero`), карточка товара (`tile`), пункт меню (`nav`),
 * чип рубрики (`chip`), ценник (`price`), фактура фона (`pattern`), второй
 * цвет (`accent2`) и манера заголовков. Те же поля и значения, что
 * у предпросмотра продавца (`front/src/features/cabinetDesign/designModel.ts`).
 */
export interface TemplateStyle {
  hero: 'gradient' | 'split' | 'band' | 'glass' | 'editorial' | 'poster' | 'stripes' | 'minimal' | 'magazine'
    | 'fullbleed' | 'collage' | 'neon' | 'story' | 'ticker' | 'duotone';
  tile: 'soft' | 'overlay' | 'plain' | 'frame' | 'sticker' | 'brutal' | 'glass';
  nav: 'pill' | 'underline' | 'bar';
  chip: 'pill' | 'outline' | 'underline';
  price: 'plain' | 'tag' | 'mono';
  pattern: 'none' | 'dots' | 'grid' | 'grain' | 'glow';
  accent2: string;
  headingCase: 'normal' | 'upper';
  headingWeight: number;
  /** Разрядка заголовков, em. */
  headingTracking: number;
}

export interface CabinetTemplate {
  id: string;
  layout: CabinetLayout;
  view: CatalogView;
  radius: number;
  font: string;
  heading: string;
  dark: boolean;
  brand: string;
  background: string;
  card: CardStyle;
  scale: number;
  group: string;
  style: TemplateStyle;
}

export const TEMPLATE_FONTS: Record<string, string> = registry.fonts;

export const CABINET_TEMPLATES: Record<string, CabinetTemplate> = Object.fromEntries(
  (registry.templates as CabinetTemplate[]).map((template) => [template.id, template]),
);

/**
 * Что из дизайна применяется на экране.
 *
 * `template` пуст у продавца, который дизайн не публиковал: тогда кабинет
 * выглядит как до шаблонов — по фирменному цвету и фону из реквизитов,
 * с боковым меню и карточками. Именно «как до», а не «как Классика»:
 * у Классики свой шрифт и свои скругления, и молча сменить их тем, кто
 * ничего не выбирал, значило бы переделать чужую витрину без спроса.
 */
export interface ResolvedDesign {
  template: CabinetTemplate | null;
  layout: CabinetLayout;
  view: CatalogView;
  /** Фирменный цвет #RRGGBB или `null` — цвет платформы. */
  brand: string | null;
  /** Код фона за блоками или `null` — бумага кабинета. */
  background: string | null;
  /** Тема, в которой покупатель впервые видит кабинет. */
  dark: boolean;
  /** Характер шаблона; `null` — дизайна нет, вёрстка прежняя. */
  style: TemplateStyle | null;
  /** Повод праздничного оформления, если сегодня его дни; `null` — без праздника. */
  occasion: string | null;
}

/** Праздничное оформление поверх шаблона: второй цвет и фактура на даты повода. */
export const CABINET_OCCASIONS: Record<string, Pick<TemplateStyle, 'accent2' | 'pattern'>> =
  festive.occasions as Record<string, Pick<TemplateStyle, 'accent2' | 'pattern'>>;

/** Сегодняшняя дата по часам покупателя, ГГГГ-ММ-ДД. */
function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

export const LEGACY_DESIGN: ResolvedDesign = {
  template: null,
  layout: 'side',
  view: 'grid',
  brand: null,
  background: null,
  dark: false,
  style: null,
  occasion: null,
};

/** Дизайн поставщика — опубликованный шаблон или реквизиты, если шаблона нет. */
export function resolveDesign(
  supplier: Pick<PortalSupplierDto, 'brandColor' | 'background' | 'design'> | null | undefined,
  today: string = localToday(),
): ResolvedDesign {
  if (!supplier) return LEGACY_DESIGN;
  const design = supplier.design;
  const template = design?.published ? CABINET_TEMPLATES[design.template] : undefined;
  if (!design || !template) {
    return {
      ...LEGACY_DESIGN,
      brand: supplier.brandColor && HEX.test(supplier.brandColor) ? supplier.brandColor.toUpperCase() : null,
      background: supplier.background ?? null,
    };
  }
  // Праздник — только в свои дни: после них кабинет возвращается к шаблону сам,
  // без новой публикации. Фирменный цвет праздник не трогает.
  const overlay = design.occasion && design.occasionFrom && design.occasionUntil
    && design.occasionFrom <= today && today <= design.occasionUntil
    ? CABINET_OCCASIONS[design.occasion] : undefined;
  // Пустой цвет и фон — «как в шаблоне»: продавец выбрал шаблон целиком.
  const brand = design.brandColor && HEX.test(design.brandColor) ? design.brandColor : template.brand;
  return {
    template,
    layout: template.layout,
    view: template.view,
    brand: brand.toUpperCase(),
    background: design.background ?? template.background,
    dark: design.theme === 'DARK' || (design.theme === 'TEMPLATE' && template.dark),
    style: overlay ? { ...template.style, ...overlay } : template.style,
    occasion: overlay ? design.occasion! : null,
  };
}

/**
 * Дизайн открытого поставщика.
 *
 * Список поставщиков берётся из общего кеша, без перезапроса при появлении:
 * его уже спрашивает оболочка, и витрина, спросившая ради раскладки ещё раз,
 * лишь удвоила бы нагрузку. Пока список не пришёл — вид как до шаблонов.
 */
export function useCabinetDesign(): ResolvedDesign {
  const { supplierId } = useSupplier();
  const suppliers = useGetPortalSuppliers({ query: { refetchOnMount: false, retryOnMount: false } });
  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];
  return resolveDesign(list.find((supplier) => supplier.supplierId === supplierId));
}

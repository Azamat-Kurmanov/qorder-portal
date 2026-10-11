import { useGetPortalSuppliers, type CabinetPhoto, type PortalSupplierDto } from '../api/generated';
import registry from './cabinetTemplates.json';
import { todaysLook } from '../ui/motion/seasonalLook';
import festive from './cabinetOccasions.json';
import { useSupplier } from './useSupplier';
import type { MotionChoice } from '../ui/motion/motionLevel';

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
 * меню, узкая лента по центру, вкладки категорий.
 */
export type CabinetLayout = 'side' | 'top' | 'rail' | 'bottom' | 'center' | 'tabs';
/**
 * Вид витрины: карточки, крупные карточки, мелкие карточки, таблица строк,
 * бенто (первая карточка вдвое крупнее), карточки-строки, мозаика разной высоты.
 */
export type CatalogView = 'grid' | 'big' | 'grid4' | 'list' | 'bento' | 'rows' | 'masonry';
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
  hero: 'label' | 'marble' | 'stage' | 'poster' | 'board' | 'receipt' | 'chalk' | 'window' | 'ornament'
    | 'minimal' | 'catalog' | 'blueprint' | 'ribbon' | 'split';
  tile: 'soft' | 'float' | 'plain' | 'tag' | 'window' | 'frame' | 'drawing';
  nav: 'pill' | 'underline' | 'bar';
  chip: 'pill' | 'outline' | 'underline';
  /** Цифра цены: крупно, ценником, моноширинно или от руки — маркером. */
  price: 'plain' | 'tag' | 'mono' | 'hand';
  pattern: 'none' | 'dots' | 'grid' | 'grain' | 'ornament';
  accent2: string;
  headingCase: 'normal' | 'upper';
  headingWeight: number;
  /** Разрядка заголовков, em. */
  headingTracking: number;
}

/** Свои бумага, панель, линии и чернила шаблона — у каждого шаблона свой мир, а не только свой цвет. */
export interface TemplateInks {
  canvas: string;
  surface: string;
  line: string;
  ink: string;
  muted: string;
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
  palette: { light: TemplateInks; dark: TemplateInks };
}

export const TEMPLATE_FONTS: Record<string, string> = registry.fonts;

const OWN_TEMPLATES = (registry.templates as CabinetTemplate[]).map((template) => [template.id, template] as const);

/**
 * Шаблоны по коду. Коды, ушедшие из выбора (`aliases`), ведут на ближайший
 * шаблон: продавец, выбравший их раньше, не теряет оформление.
 */
export const CABINET_TEMPLATES: Record<string, CabinetTemplate> = Object.fromEntries([
  ...OWN_TEMPLATES,
  ...Object.entries(registry.aliases as Record<string, string>)
    .map(([code, target]) => [code, OWN_TEMPLATES.find(([id]) => id === target)![1]] as const),
]);

/** Код живого фона — как в перечислении сервера (`CabinetBackdrop`). */
export type CabinetBackdropCode = 'GLOW' | 'SHIMMER' | 'HORIZON' | 'PARTICLES' | 'BLOBS' | 'SPOTLIGHT' | 'SCROLLTINT'
  | 'AURORA' | 'WAVES' | 'RAYS' | 'BUBBLES' | 'STARS' | 'MESH' | 'STRIPES' | 'RIPPLE'
  | 'SNOW' | 'PETALS' | 'SUNSHINE' | 'LEAVES' | 'GARLAND' | 'FIREWORKS' | 'CONFETTI' | 'BALLOONS' | 'HEARTS' | 'SALE_TAGS'
  | 'SEASON' | 'NONE';

/**
 * Характер живой темы (этап 1 — только данные; экраны переходят на них в этапах 3–4).
 * `bannerSkin` — одежда баннеров, `display` — крупный заголовок, `backdrop` и
 * `motion` — значения по умолчанию, если продавец не выбрал своё.
 */
export interface MotionStyle extends Omit<TemplateStyle, 'hero' | 'tile'> {
  hero: string;
  tile: 'glass' | 'tilt' | 'float' | 'glow' | 'jelly' | 'outline' | 'swap' | 'plain';
  cta: 'pill' | 'solid' | 'glow' | 'jelly' | 'ghost';
  display: { weight: number; tracking: number };
  backdrop: CabinetBackdropCode;
  motion: 'CALM' | 'LIVELY' | 'VIVID';
  announce: boolean;
  bannerSkin: 'glass' | 'depth' | 'neon' | 'soft' | 'studio' | 'lookbook';
}

export interface MotionTemplate extends Omit<CabinetTemplate, 'style'> {
  style: MotionStyle;
}

export const MOTION_TEMPLATES = registry.motionTemplates as MotionTemplate[];

/** Живая тема по коду: своя, иначе куда ведёт старый код, иначе «Сияние». */
export function motionTemplateOf(code: string | null | undefined): MotionTemplate {
  const own = code ? (registry.motionAliases as Record<string, string>)[code] ?? code : code;
  return MOTION_TEMPLATES.find((t) => t.id === own) ?? MOTION_TEMPLATES[0];
}

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
  template: MotionTemplate | null;
  layout: CabinetLayout;
  view: CatalogView;
  /** Фирменный цвет #RRGGBB или `null` — цвет платформы. */
  brand: string | null;
  /** Код фона за блоками или `null` — бумага кабинета. */
  background: string | null;
  /** Тема, в которой покупатель впервые видит кабинет. */
  dark: boolean;
  /** Характер темы; `null` — дизайна нет, вёрстка прежняя. */
  style: MotionStyle | null;
  /** Повод праздничного оформления, если сегодня его дни; `null` — без праздника. */
  occasion: string | null;
  /** Живой фон за содержимым: выбор продавца, иначе тема; `NONE` — без фона. */
  backdrop: CabinetBackdropCode;
  /** Сколько движения выбрал продавец (итог считает `useMotionLevel`). */
  motion: MotionChoice;
  /** Узор фона по отрасли; `null` — без узора. */
  pattern: string | null;
  /** Своё фото фона с Google Диска продавца; `null` — без фото. */
  photo: CabinetPhoto | null;
}

/** Праздничное оформление поверх шаблона: второй цвет и фактура на даты повода. */
export const CABINET_OCCASIONS: Record<string, Pick<MotionStyle, 'accent2' | 'pattern'>> =
  festive.occasions as Record<string, Pick<MotionStyle, 'accent2' | 'pattern'>>;

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
  backdrop: 'NONE',
  motion: 'LIVELY',
  pattern: null,
  photo: null,
};

/** Дизайн поставщика — опубликованный шаблон или реквизиты, если шаблона нет. */
export function resolveDesign(
  supplier: Pick<PortalSupplierDto, 'brandColor' | 'background' | 'design'> | null | undefined,
  today: string = localToday(),
): ResolvedDesign {
  if (!supplier) return LEGACY_DESIGN;
  const design = supplier.design;
  // Старые коды ведут на живую тему (`motionAliases`), неизвестный — на «Сияние».
  const template = design?.published ? motionTemplateOf(design.template) : undefined;
  const motionParts = {
    backdrop: (design?.published && design.backdrop) || template?.style.backdrop || 'NONE',
    motion: (design?.published && design.motion) || template?.style.motion || 'LIVELY',
  } satisfies Pick<ResolvedDesign, 'backdrop' | 'motion'>;
  if (!design || !template) {
    return {
      ...LEGACY_DESIGN,
      ...motionParts,
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
    ...motionParts,
    // «По сезону» и праздник на свои даты — узор и живой фон на сегодня.
    ...todaysLook({
      pattern: design.pattern, backdrop: motionParts.backdrop, photo: !!design.photo?.url,
      occasion: design.occasion, occasionFrom: design.occasionFrom, occasionUntil: design.occasionUntil,
      occasionBackground: design.occasionBackground,
    }, today) as { pattern: string | null; backdrop: CabinetBackdropCode },
    photo: design.photo?.url ? design.photo : null,
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

import type { TFunction } from 'i18next';
import {
  useGetPortalCatalog,
  useGetPortalCategories,
  useGetPortalPromotions,
  type PortalPromoSale,
  type ShowcaseBannerDto,
  type ShowcaseItemDto,
} from '../../../api/generated';
import { shortDate } from '../../../shared/format';
import type { HeroData, HeroImage } from './parts';

/**
 * Откуда баннер шаблона берёт то, чего нет в самом слайде: снимки товаров
 * распродажи, рубрики для «историй» и конец распродажи для отсчёта.
 *
 * Все три запроса уже сделаны витриной и лежат в общем кеше — баннер лишь
 * читает их. Каталог спрашивается тем же запросом, что и витрина без отбора,
 * и только когда у распродажи нет своих товаров.
 */
export interface HeroSource {
  sale?: PortalPromoSale;
  images: HeroImage[];
  chips: string[];
}

export function useHeroSource(enabled: boolean): HeroSource {
  const promotions = useGetPortalPromotions({ query: { enabled } });
  const promo = promotions.data?.status === 200 ? promotions.data.data : undefined;
  const deals = promo?.deals ?? [];
  const categories = useGetPortalCategories({ query: { enabled } });
  const catalog = useGetPortalCatalog(
    { page: 0, size: 50, sort: 'POPULAR' },
    { query: { enabled: enabled && promo !== undefined && deals.length === 0 } },
  );
  const items: ShowcaseItemDto[] = deals.length > 0
    ? deals
    : catalog.data?.status === 200 ? (catalog.data.data.items ?? []) : [];
  return {
    sale: promo?.sale,
    images: items.slice(0, 6).map((item) => ({ id: item.id, src: item.thumbnailUrl })),
    chips: categories.data?.status === 200 ? categories.data.data.map((category) => category.name) : [],
  };
}

/** Скидка слайда крупно: «20» продавца становится «−20%», готовая надпись остаётся как есть. */
function stampOf(discount: string | number | undefined | null): string | undefined {
  if (discount === undefined || discount === null || discount === '') return undefined;
  const text = String(discount).trim();
  return /^\d+([.,]\d+)?$/.test(text) ? `−${text}%` : text;
}

/**
 * Фирменный слайд продавца — данными баннера шаблона. Картинка слайда
 * идёт первым снимком; отсчёт — только у распродажи с отсчётом: слайд
 * без срока конца не получает выдуманных дней.
 */
export function slideHero(slide: ShowcaseBannerDto, source: HeroSource, t: TFunction): HeroData {
  const sale = slide.template === 'SALE' && source.sale?.countdown ? source.sale : undefined;
  const own: HeroImage[] = slide.imageSrc ? [{ id: slide.id, src: slide.imageSrc }] : [];
  return {
    badge: slide.badge ?? (sale?.endsOn ? t('design.saleUntil', { date: shortDate(sale.endsOn) }) : undefined),
    title: slide.title,
    text: slide.text,
    stamp: stampOf(slide.discount),
    endsAt: sale?.endsAt,
    button: slide.buttonText,
    images: [...own, ...source.images],
    chips: source.chips,
  };
}

/**
 * Идущая распродажа — баннером шаблона, когда слайдов у магазина нет:
 * так же, как её показывает продавцу предпросмотр.
 */
export function saleHero(sale: PortalPromoSale, source: HeroSource, t: TFunction): HeroData {
  return {
    badge: sale.endsOn ? t('design.saleUntil', { date: shortDate(sale.endsOn) }) : t('design.saleBadge'),
    title: sale.title,
    text: sale.text ?? t('design.saleText'),
    stamp: sale.maxPercent ? `−${sale.maxPercent}%` : undefined,
    endsAt: sale.countdown ? sale.endsAt : undefined,
    button: t('design.goDeals'),
    images: source.images,
    chips: source.chips,
  };
}

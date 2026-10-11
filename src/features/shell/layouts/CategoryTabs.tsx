import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  useGetPortalCatalog,
  useGetPortalCatalogCounts,
  useGetPortalCategories,
  useGetPortalPromotions,
  type ShowcaseItemDto,
} from '../../../api/generated';
import { ItemThumb } from '../../catalog/ItemThumb';
import { cn } from '../../../ui/cn';

/**
 * Вкладки рубрик под шапкой — раскладка «вкладки» («Пастель», «Свежесть»,
 * «Ретро», «Про»): вместо строки разделов крупные плашки рубрик со снимком
 * их товара. Разделы кабинета при этом никуда не деваются — они в листе
 * «Меню» за кнопкой в шапке.
 *
 * Кроме рубрик — «Со скидкой» и «Новинки», как чипы витрины: вкладки
 * стоят и у продавца без рубрик, если есть распродажа или новинки.
 *
 * Вкладка ведёт адресом (`/catalog?category=…`): рубрику присылают
 * ссылкой, и витрина уже умеет её открыть. Снимок рубрики — первого её
 * товара из того же ответа, что рисует витрина; своего снимка у рубрики нет.
 */
export function CategoryTabs({ ready }: { ready: boolean }) {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const categories = useGetPortalCategories({ query: { enabled: ready } });
  const list = categories.data?.status === 200 ? categories.data.data : [];
  const catalog = useGetPortalCatalog({ page: 0, size: 50, sort: 'POPULAR' }, { query: { enabled: ready } });
  const items: ShowcaseItemDto[] = catalog.data?.status === 200 ? (catalog.data.data.items ?? []) : [];
  const promotions = useGetPortalPromotions({ query: { enabled: ready } });
  const promo = promotions.data?.status === 200 ? promotions.data.data : undefined;
  // Числа — тем же запросом, что у чипов витрины: вкладка обещает, сколько
  // товаров за ней. Ответ старого сервера без чисел — вкладки без чисел.
  const counts = useGetPortalCatalogCounts({}, { query: { enabled: ready } });
  const count = counts.data?.status === 200 && typeof counts.data.data?.all === 'number' ? counts.data.data : undefined;
  const onCatalog = pathname === '/catalog';
  const category = params.get('category');
  const sale = params.get('sale') === '1';
  const novelty = params.get('novelty') === '1';
  const hasSale = !!promo && promo.dealCount > 0;
  const hasNovelty = (count?.novelty ?? 0) > 0;

  const tabs = [
    { key: 'all', to: '/catalog', label: t('design.allCategories'), n: count?.all, active: onCatalog && !category && !sale && !novelty, item: items[0] },
    ...(hasSale
      ? [{ key: 'sale', to: '/catalog?sale=1', label: t('catalog.onSale'), n: count?.sale, active: onCatalog && sale, item: promo?.deals[0] ?? items.find((one) => one.oldPrice !== undefined) }]
      : []),
    ...(hasNovelty || (onCatalog && novelty)
      ? [{ key: 'novelty', to: '/catalog?novelty=1', label: t('catalog.novelty'), n: count?.novelty, active: onCatalog && novelty, item: items.find((one) => one.terms?.novelty) }]
      : []),
    ...list.map((one) => ({
      key: one.id,
      to: `/catalog?category=${encodeURIComponent(one.id)}`,
      label: one.name,
      n: count?.byCategory?.[one.id],
      active: onCatalog && category === one.id,
      item: items.find((entry) => entry.categoryId === one.id),
    })),
  ];
  // Без рубрик вкладки нужны, только если есть что выбрать кроме «Все товары».
  if (list.length === 0 && !hasSale && !hasNovelty) return null;

  return (
    <nav
      aria-label={t('design.categories')}
      data-testid="category-tabs"
      className="hidden border-b border-hairline bg-surface lg:block"
    >
      <div className="mx-auto flex w-full max-w-[1440px] gap-3 overflow-x-auto px-[22px] py-4 [scrollbar-width:none]">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            to={tab.to}
            aria-current={tab.active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-[var(--radius-small)] py-1.5 pl-1.5 pr-4 text-sm font-bold transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              tab.active
                ? 'bg-accent text-on-accent shadow-[0_10px_18px_-12px_var(--color-brand-deep)]'
                : 'bg-accent-soft text-accent-ink hover:bg-[color-mix(in_srgb,var(--color-accent-soft)_85%,var(--color-shop))]',
            )}
          >
            <ItemThumb
              itemId={tab.item?.id ?? tab.key}
              src={tab.item?.thumbnailUrl}
              width={64}
              className="size-10 rounded-[max(4px,calc(var(--radius-small)-2px))]"
            />
            {tab.label}
            {tab.n !== undefined ? <span className="font-semibold opacity-75">· {tab.n}</span> : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

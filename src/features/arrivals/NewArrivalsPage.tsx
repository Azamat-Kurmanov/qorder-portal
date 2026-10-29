import { cn } from '../../ui/cn';
import { SectionHead } from '../shell/SectionHead';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useGetPortalCatalog, type ShowcaseItemDto } from '../../api/generated';
import { cartOf, useCart } from '../cart/useCart';
import { CartBar } from '../cart/CartBar';
import { ItemTile } from '../catalog/CatalogPage';
import { CartAction, packPriceClass, perUnitNote } from '../catalog/itemParts';
import { ItemThumb } from '../catalog/ItemThumb';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { useWideScreen } from '../../ui/useWideScreen';
import { Reveal } from '../../ui/Reveal';
import { useReadOnOpen } from '../notifications/useReadOnOpen';

/** Сколько новинок на странице: поставка редко больше, а листать новинки никто не станет. */
const PAGE_SIZE = 60;

/**
 * «Новые поступления»: товары, которые продавец объявил новинками, свежие сверху.
 *
 * Открытый раздел гасит уведомления о поступлении: клиент увидел то, о чём
 * они сообщали, и подсветка меню больше не зовёт.
 */
export function NewArrivalsPage() {
  const { t } = useTranslation();
  const catalog = useGetPortalCatalog({ novelty: true, sort: 'NEWEST', size: PAGE_SIZE });
  const items = catalog.data?.status === 200 ? catalog.data.data.items ?? [] : [];
  const cart = cartOf(useCart().data);
  const taken = useMemo(() => new Set((cart?.lines ?? []).map((line) => line.itemId)), [cart]);

  useReadOnOpen('NEW_ARRIVALS');
  // Телефон — по макету: новинки строками, по дням поступления; монитор — карточками.
  const wide = useWideScreen();

  return (
    <div className="flex flex-col gap-4 pb-28">
      <SectionHead title={t('arrivals.title')} subtitle={t('arrivals.lead')} />
      {items.length && !wide ? (
        <ArrivalGroups items={items} taken={taken} />
      ) : items.length ? (
        <div className="grid grid-cols-2 content-start gap-3 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item, index) => (
            <Reveal key={item.id} index={index}>
              <ItemTile item={item} taken={taken} roomy={false} />
            </Reveal>
          ))}
        </div>
      ) : catalog.isLoading ? null : (
        <p className="text-body text-ink-subtle">{t('arrivals.empty')}</p>
      )}
      <CartBar />
    </div>
  );
}

/** Дата по часам покупателя, ГГГГ-ММ-ДД — как `noveltySince` у товара. */
function localDay(offsetDays = 0): string {
  const now = new Date(Date.now() - offsetDays * 86_400_000);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Новинки по дням поступления — «Сегодня», «На этой неделе», «Раньше»:
 * клиент приходит сюда узнать, что привезли с прошлого раза.
 */
function ArrivalGroups({ items, taken }: { items: ShowcaseItemDto[]; taken: ReadonlySet<string> }) {
  const { t } = useTranslation();
  const today = localDay();
  const weekAgo = localDay(7);
  const groups = [
    { key: 'today', items: items.filter((item) => (item.terms?.noveltySince ?? '') >= today) },
    { key: 'week', items: items.filter((item) => { const since = item.terms?.noveltySince ?? ''; return since < today && since >= weekAgo; }) },
    { key: 'earlier', items: items.filter((item) => (item.terms?.noveltySince ?? '') < weekAgo) },
  ].filter((group) => group.items.length > 0);
  return (
    <div className="flex flex-col gap-2.5">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`arrivals-${group.key}`} className="flex flex-col gap-2">
          <h2 id={`arrivals-${group.key}`} className="px-1.5 text-[0.8125rem] font-extrabold uppercase tracking-[0.04em] text-ink-muted">
            {t(`arrivals.${group.key}`)}
          </h2>
          <ul className="flex flex-col rounded-[1.375rem] bg-surface px-3.5 shadow-[2px_3px_6px_rgba(58,48,30,.07)]">
            {group.items.map((item) => (
              <li key={item.id} data-testid="item-tile" className="border-b border-hairline py-3 last:border-b-0">
                <ArrivalRow item={item} taken={taken.has(item.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ArrivalRow({ item, taken }: { item: ShowcaseItemDto; taken: boolean }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  return (
    <div className="flex gap-3">
      <Link to={`/catalog/${item.id}`} aria-label={item.name} className="relative shrink-0">
        <ItemThumb itemId={item.id} src={item.thumbnailUrl} width={160} className="size-[3.75rem] rounded-2xl" />
        <span className="absolute -left-1 -top-1.5 rounded-full bg-[#1D4E9E] px-1.5 py-0.5 text-[0.625rem] font-extrabold text-white">
          {t('catalog.badge.new')}
        </span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link to={`/catalog/${item.id}`} className="line-clamp-2 text-[0.9375rem] font-bold text-ink">{item.name}</Link>
        <span className={cn('text-[0.9375rem] font-extrabold tabular-nums', packPriceClass(item))}>
          {money(item.price, currency)}{' '}
          <span className="text-[0.8125rem] font-medium text-ink-muted">{perUnitNote(item, t)}</span>
        </span>
        <CartAction item={item} taken={taken} roomy={false} />
      </div>
    </div>
  );
}

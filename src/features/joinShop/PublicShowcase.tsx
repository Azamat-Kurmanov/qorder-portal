import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetJoinShopCategories, useGetJoinShopItems } from '../../api/generated';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { ItemThumb } from '../catalog/ItemThumb';

const PAGE = 24;

/**
 * Витрина без цен на странице ссылки магазина — если продавец её открыл.
 *
 * Гость видит, что здесь продают, и решает, стоит ли оставлять заявку: названия,
 * снимки, рубрики. Цен, остатков и корзины нет — их он увидит в кабинете, когда
 * продавец одобрит доступ. Кнопка ведёт обратно к форме заявки.
 */
export function PublicShowcase({ code, onRequest }: { code: string; onRequest: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [page, setPage] = useState(0);
  const items = useGetJoinShopItems(code, { query: query.trim() || undefined, categoryId, page, size: PAGE });
  const categories = useGetJoinShopCategories(code);
  const data = items.data?.status === 200 ? items.data.data : undefined;
  const roots = (categories.data?.status === 200 ? categories.data.data : []).filter((category) => !category.parentId);
  const pages = Math.ceil((data?.totalElements ?? 0) / PAGE);

  return (
    <section aria-labelledby="public-showcase" className="flex w-full max-w-[1080px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="public-showcase" className="m-0 text-xl font-semibold tracking-tight text-ink">{t('joinShop.showcase.title')}</h2>
          <p className="m-0 text-sm text-ink-muted">{t('joinShop.showcase.noPrices')}</p>
        </div>
        <Button variant="accent" onClick={onRequest}>{t('joinShop.showcase.request')}</Button>
      </div>

      <input type="search" value={query} aria-label={t('joinShop.showcase.search')} placeholder={t('joinShop.showcase.search')}
        onChange={(event) => { setQuery(event.target.value); setPage(0); }}
        className="h-11 rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none" />

      {roots.length > 0 ? (
        <div role="radiogroup" aria-label={t('joinShop.showcase.categories')} className="flex flex-wrap gap-2">
          {[{ id: undefined, name: t('joinShop.showcase.all') }, ...roots].map((category) => (
            <button key={category.id ?? 'all'} type="button" role="radio" aria-checked={categoryId === category.id}
              onClick={() => { setCategoryId(category.id); setPage(0); }}
              className={cn(
                'h-9 cursor-pointer rounded-[var(--radius-pill)] border-[1.5px] border-solid px-4 text-[0.8125rem] font-semibold',
                categoryId === category.id ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink',
              )}>
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      {data && (data.items ?? []).length === 0 ? <p className="text-sm text-ink-muted">{t('joinShop.showcase.empty')}</p> : null}
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
        {(data?.items ?? []).map((item) => (
          <li key={item.id} data-testid="public-item" className="flex flex-col gap-2">
            <ItemThumb itemId={item.id} src={item.imageUrl} className="h-40 w-full rounded-[var(--radius-card)]" />
            <span className="line-clamp-2 text-sm font-semibold text-ink">{item.name}</span>
            {item.unit ? <span className="text-xs text-ink-muted">{item.unit}</span> : null}
          </li>
        ))}
      </ul>

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm text-ink-muted">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('joinShop.showcase.prev')}</Button>
          <span>{t('joinShop.showcase.page', { page: page + 1, pages })}</span>
          <Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{t('joinShop.showcase.next')}</Button>
        </div>
      ) : null}
    </section>
  );
}

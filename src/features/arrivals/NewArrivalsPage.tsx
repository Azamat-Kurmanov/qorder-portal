import { takenIn } from '../cart/cartPart';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetPortalCatalog, type ShowcaseItemDto } from '../../api/generated';
import { cartOf, useCart } from '../cart/useCart';
import { CartBar } from '../cart/CartBar';
import { ItemTile } from '../catalog/CatalogPage';
import { OrderModeSwitch, useShopChannel } from '../catalog/OrderModeSwitch';
import { BackTitle } from '../../ui/BackTitle';
import { useWideScreen } from '../../ui/useWideScreen';
import { useReadOnOpen } from '../notifications/useReadOnOpen';

/** Сколько новинок на странице: поставка редко больше, а листать новинки никто не станет. */
const PAGE_SIZE = 60;

/**
 * «Новые поступления» — «Вариант Б» (SimplePicArrivals / SimplePicWebArrivals): «Оптом / В розницу»,
 * затем новинки карточками каталога по дням поступления — «Сегодня», «На этой неделе», «Раньше».
 *
 * Открытый раздел гасит уведомления о поступлении: клиент увидел то, о чём
 * они сообщали, и подсветка меню больше не зовёт.
 */
export function NewArrivalsPage() {
  const { t } = useTranslation();
  const { orderMode, setOrderMode, twoWays, channel } = useShopChannel();
  const catalog = useGetPortalCatalog({ novelty: true, sort: 'NEWEST', size: PAGE_SIZE, channel });
  const items = catalog.data?.status === 200 ? catalog.data.data.items ?? [] : [];
  const cart = cartOf(useCart().data);
  const taken = useMemo(() => takenIn(cart, orderMode), [cart, orderMode]);
  const wide = useWideScreen();

  useReadOnOpen('NEW_ARRIVALS');

  return (
    <div className="flex flex-col gap-3 pb-28">
      <BackTitle title={t('arrivals.title')} subtitle={t('arrivals.lead')} />
      {twoWays ? <OrderModeSwitch mode={orderMode} onMode={setOrderMode} /> : null}
      {items.length ? (
        <ArrivalGroups items={items} taken={taken} wide={wide} />
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

/** Новинки по дням поступления: клиент приходит сюда узнать, что привезли с прошлого раза. */
function ArrivalGroups({ items, taken, wide }: { items: ShowcaseItemDto[]; taken: ReadonlySet<string>; wide: boolean }) {
  const { t } = useTranslation();
  const today = localDay();
  const weekAgo = localDay(7);
  const groups = [
    { key: 'today', items: items.filter((item) => (item.terms?.noveltySince ?? '') >= today) },
    { key: 'week', items: items.filter((item) => { const since = item.terms?.noveltySince ?? ''; return since < today && since >= weekAgo; }) },
    { key: 'earlier', items: items.filter((item) => (item.terms?.noveltySince ?? '') < weekAgo) },
  ].filter((group) => group.items.length > 0);
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`arrivals-${group.key}`} className="flex flex-col gap-2.5">
          <h2 id={`arrivals-${group.key}`} className="m-0 mt-1 text-lead font-extrabold text-ink">
            {t(`arrivals.${group.key}`)}
          </h2>
          <div className="grid grid-cols-2 content-start gap-2.5 md:grid-cols-3 xl:grid-cols-4 lg:gap-4">
            {group.items.map((item) => (
              <ItemTile key={item.id} item={item} taken={taken} roomy={wide} phone />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

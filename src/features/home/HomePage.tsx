import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  useGetMyPortalOrders,
  useGetPortalCatalog,
  useGetPortalCatalogCounts,
  useGetPortalPromotions,
  type PortalOrderDto,
} from '../../api/generated';
import { isCounts, ItemTile } from '../catalog/CatalogPage';
import { VolumeHint } from '../catalog/views/VolumeHint';
import { cartOf, useCart } from '../cart/useCart';
import { kindOf } from '../orders/myOrdersModel';
import { promotionsOff } from '../promotions/promotionsOff';
import { useCurrentShop } from '../shell/Shops';
import { hoursNow, telLink, whatsappLink } from '../shell/shopHours';
import { cn } from '../../ui/cn';
import {
  ChevronRight,
  Heart,
  LayoutGrid,
  LayoutTemplate,
  MapPin,
  MessageCircle,
  MessageCircleQuestion,
  Package,
  PenLine,
  Phone,
  RotateCcw,
  Sparkles,
  Tag,
  Truck,
  type IconComponent,
} from '../../ui/icons';
import { useWideScreen } from '../../ui/useWideScreen';

/** Плитка раздела на «Главной». */
interface Tile {
  key: string;
  label: string;
  to: string;
  icon: IconComponent;
  tone: 'green' | 'warm' | 'blue' | 'rose';
  badge?: number;
}

const TONES: Record<Tile['tone'], string> = {
  green: 'bg-accent-soft text-accent-ink',
  warm: 'bg-sale-soft text-sale-ink',
  blue: 'bg-sage-soft text-accent-ink',
  rose: 'bg-sale-soft text-sale-text',
};

/** Хитов на мониторе — один ряд сетки. */
const HITS = 4;
/** Карточек «Ждут вас» — больше не читают, остальное в «Заявках». */
const WAITING = 3;

/**
 * «Главная» — первый экран кабинета (макеты «Кабинет клиента 2.0»): сначала
 * то, что ждёт клиента (ответ продавцу, готовая к выдаче заявка), затем
 * все разделы плитками — как «Разделы» у менеджера, — выгода по корзине
 * одной строкой и карточка магазина: часы, адрес, звонок и WhatsApp.
 * На мониторе ниже — «Часто заказывают».
 */
export function HomePage() {
  const { t } = useTranslation();
  const wide = useWideScreen();

  const orders = useGetMyPortalOrders();
  const waiting = (orders.data?.status === 200 ? orders.data.data : [])
    .filter((order) => {
      const kind = kindOf(order);
      return kind === 'answer' || kind === 'ready';
    })
    // Ответ продавцу — первым: без него заявка стоит.
    .sort((a, b) => Number(kindOf(b) === 'answer') - Number(kindOf(a) === 'answer'))
    .slice(0, WAITING);

  const promotions = useGetPortalPromotions();
  const promo = promotions.data?.status === 200 ? promotions.data.data : undefined;
  const counts = useGetPortalCatalogCounts({});
  const count = counts.data?.status === 200 && isCounts(counts.data.data) ? counts.data.data : undefined;
  const arrivals = count?.novelty ?? 0;

  const tiles: Tile[] = [
    { key: 'catalog', label: t('shell.tabs.catalog'), to: '/catalog', icon: LayoutGrid, tone: 'green' },
    ...(promo && promotionsOff(promo) ? [] : [{
      key: 'promotions', label: t('shell.tabs.promotions'), to: '/promotions', icon: Tag, tone: 'warm' as const,
      badge: promo?.dealCount || undefined,
    }]),
    { key: 'favorites', label: t('shell.tabs.favorites'), to: '/favorites', icon: Heart, tone: 'rose' },
    { key: 'repeat', label: t('home.repeat'), to: '/orders', icon: RotateCcw, tone: 'green' },
    { key: 'templates', label: t('home.templates'), to: '/templates', icon: LayoutTemplate, tone: 'green' },
    ...(arrivals > 0 ? [{
      key: 'arrivals', label: t('shell.tabs.newArrivals'), to: '/new-arrivals', icon: Sparkles, tone: 'blue' as const, badge: arrivals,
    }] : []),
    { key: 'questions', label: t('home.questions'), to: '/questions', icon: MessageCircleQuestion, tone: 'blue' },
    { key: 'delivery', label: t('home.delivery'), to: '/delivery', icon: Truck, tone: 'green' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">{t('home.title')}</h1>

      {wide ? (
        // Монитор (ПК-К2.1): ждущие заявки и подсказка о скидке — одним рядом
        // равных колонок; min-w-0 — строка «№… · нужен ваш ответ» не переносится
        // и иначе растянула бы колонку шире экрана.
        <div className="flex gap-5 empty:hidden *:min-w-0 *:flex-1 *:basis-0">
          {waiting.length > 0 && (
            // Ширина — по числу карточек: колонки ряда выходят равными.
            <section aria-label={t('home.waiting')} style={{ flexGrow: waiting.length }} className="flex gap-5 *:min-w-0 *:flex-1 *:basis-0">
              {waiting.map((order) => <WaitingCard key={order.id} order={order} />)}
            </section>
          )}
          <VolumeHint data={promo} compact />
        </div>
      ) : waiting.length > 0 && (
        <section aria-label={t('home.waiting')} className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
          {waiting.map((order) => <WaitingCard key={order.id} order={order} />)}
        </section>
      )}

      <section
        aria-labelledby="home-sections"
        className="flex flex-col gap-4 rounded-[1.25rem] bg-surface px-3 py-[1.125rem] lg:p-6"
      >
        <h2 id="home-sections" className="px-1.5 text-lg font-extrabold text-ink lg:px-0">{t('home.sections')}</h2>
        <ul className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-x-1 gap-y-[1.125rem] lg:grid-cols-[repeat(8,minmax(0,1fr))] lg:gap-3">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <li key={tile.key}>
                <Link
                  to={tile.to}
                  className="relative flex flex-col items-center gap-2 text-center text-xs font-semibold leading-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:text-sm"
                >
                  <span aria-hidden="true" className={cn('flex size-[3.75rem] items-center justify-center rounded-[1.125rem] lg:size-16 lg:rounded-[1.25rem]', TONES[tile.tone])}>
                    <Icon className="size-[1.625rem] lg:size-7" />
                  </span>
                  {tile.badge ? (
                    <span
                      role="img"
                      aria-label={t('home.badge', { count: tile.badge })}
                      className="absolute -top-1.5 left-[calc(50%+0.875rem)] flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-pill)] bg-sale px-1.5 text-xs font-extrabold text-white"
                    >
                      {tile.badge}
                    </span>
                  ) : null}
                  <span className="line-clamp-2 break-words">{tile.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className={cn('flex flex-col gap-5', wide && 'grid grid-cols-[minmax(0,1fr)_22.5rem] items-start')}>
        <div className="flex flex-col gap-5">
          {!wide && <VolumeHint data={promo} compact />}
          {wide && <Hits />}
        </div>
        <ShopCard />
      </div>
    </div>
  );
}

/** Заявка, где ход за клиентом: ответить продавцу или прийти за готовой. */
function WaitingCard({ order }: { order: PortalOrderDto }) {
  const { t } = useTranslation();
  const answer = kindOf(order) === 'answer';
  const Icon = answer ? PenLine : Package;
  return (
    <Link
      to={`/orders/${order.id}`}
      data-testid="home-waiting"
      className={cn(
        'flex items-center gap-3 rounded-[1.25rem] bg-surface px-4 py-3.5 lg:px-5 lg:py-[1.125rem]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        answer && 'shadow-[inset_0_0_0_2px_var(--color-sale-line)]',
      )}
    >
      <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl lg:size-12', answer ? 'bg-sale-soft text-sale-ink' : 'bg-ok-soft text-ok-ink')}>
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-[0.9375rem] font-bold text-ink">{answer ? t('home.answer') : t('home.ready')}</b>
        <span className="text-[0.8125rem] text-ink-muted">
          {answer
            ? t('home.answerHint', { number: order.orderNumber })
            : order.pickupCode
              ? t('home.readyCode', { number: order.orderNumber, code: order.pickupCode })
              : t('home.readyHint', { number: order.orderNumber })}
        </span>
      </span>
      {answer
        ? <span className="flex h-10 shrink-0 items-center rounded-xl bg-sale px-3.5 text-sm font-extrabold text-white">{t('home.answerGo')}</span>
        : <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />}
    </Link>
  );
}

/** Магазин: открыт ли, где, как связаться — без поиска по экранам. */
function ShopCard() {
  const { t } = useTranslation();
  const shop = useCurrentShop();
  if (!shop) return null;
  const live = hoursNow(shop.hours, t);
  const tel = telLink(shop.phone);
  const whatsapp = whatsappLink(shop.whatsapp ?? shop.phone);
  const action = 'flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line)] transition-colors hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  return (
    <section aria-labelledby="home-shop" className="flex flex-col gap-3.5 rounded-[1.25rem] bg-surface p-4 lg:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-shop" className="text-lg font-extrabold text-ink">{t('home.shop')}</h2>
        {live && (
          <span className={cn('min-w-0 truncate rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-bold', live.open ? 'bg-ok-soft text-ok-ink' : 'bg-sunk text-ink-muted')}>
            {live.short}
          </span>
        )}
      </div>
      {shop.address && (
        <p className="m-0 flex gap-2.5 text-sm text-ink-muted">
          <MapPin aria-hidden="true" className="size-5 shrink-0" />
          {shop.address}
        </p>
      )}
      {(tel || whatsapp) && (
        <div className="grid grid-cols-2 gap-2">
          {tel && <a href={tel} className={action}><Phone aria-hidden="true" className="size-[18px]" />{t('home.call')}</a>}
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noreferrer" className={action}>
              <MessageCircle aria-hidden="true" className="size-[18px]" />WhatsApp
            </a>
          )}
        </div>
      )}
    </section>
  );
}

/** «Часто заказывают» на мониторе: первые позиции порядка «сначала популярные». */
function Hits() {
  const { t } = useTranslation();
  const hits = useGetPortalCatalog({ page: 0, size: HITS, sort: 'POPULAR' });
  const items = hits.data?.status === 200 ? (hits.data.data.items ?? []) : [];
  const cart = cartOf(useCart().data);
  const taken = useMemo(() => new Set((cart?.lines ?? []).map((line) => line.itemId)), [cart]);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="home-hits" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-hits" className="text-lg font-extrabold text-ink">{t('home.hits')}</h2>
        <Link to="/catalog" className="text-sm font-bold text-accent-ink">{t('home.allItems')}</Link>
      </div>
      <div data-testid="item-grid" className="grid grid-cols-4 gap-5">
        {items.map((item) => <ItemTile key={item.id} item={item} taken={taken} roomy={false} phone />)}
      </div>
    </section>
  );
}

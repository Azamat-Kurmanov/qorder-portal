import { LoadFailed } from '../../ui/LoadFailed';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bell, Box, Check, Clock, Info, Layers, Plus, Sparkles, Ticket } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalPromotionsQueryKey,
  setPortalPromoSubscription,
  useGetPortalBanners,
  useGetPortalCatalog,
  useGetPortalProfile,
  useGetPortalPromotions,
  useGetPortalSuppliers,
  type CartDto,
  type PortalPromoSaleCategory,
  type PortalPromotionsDto,
  type ShowcaseBannerDto,
  type ShowcaseItemDto,
} from '../../api/generated';
import { cartOf, useCart, useSetCartLine } from '../cart/useCart';
import { useAddToCart } from '../cart/ageGate';
import { openCart } from '../cart/cartDrawer';
import { ItemThumb } from '../catalog/ItemThumb';
import { useCurrentShop } from '../shell/Shops';
import { phone as formatPhone, money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { cn } from '../../ui/cn';
import { Skeleton } from '../../ui/Skeleton';
import { useColumnWidth } from '../../ui/useColumnWidth';
import { BannerSlide } from '../banners/BannerSlide';
import { liveBanners } from '../banners/BannerCarousel';
import { useSupplier } from '../../supplier/useSupplier';
import { resolveDesign } from '../../supplier/cabinetDesign';
import { promotionsOff } from './promotionsOff';

/** С какой ширины колонки товары распродажи встают в четыре карточки — как на витрине. */
const FOUR_FROM = 1040;

/** Сколько товаров рубрики распродажи грузит чип — как страница витрины. */
const RUBRIC_SIZE = 50;

/** Уже этой ширины колонка — телефон: блоки собираются компактно, как в макете телефона. */
const COMPACT_BELOW = 640;

/** Фирменный цвет платформы — для слайдов баннеров, если у магазина своего нет. */
const PLATFORM_BRAND = '#A8450A';

/** Силуэты одежды на слайде распродажи — те же, что у шаблона «Распродажа» баннеров. */
const COAT = 'M46 16l14 7 14-7 22 9 10 70-16 4-6-40v76H46V59l-6 40-16-4 10-70z';

/** Отсчёт обновляется раз в минуту: секунды на экране акций только суетят. */
const TICK_MS = 60_000;

/**
 * «Акции и скидки» — по макету «Акции и скидки v2».
 *
 * Экран начинается не со списка акций магазина, а с того, что они значат
 * для этой корзины: сколько добрать до скидки за объём и сработает ли скидка
 * на первую заявку. Ниже — что идёт в магазине сейчас (распродажа с отсчётом),
 * товары со скидкой, как скидки работают и подписка.
 *
 * Только то, что действует сегодня: выключенная скидка и распродажа
 * с вышедшим сроком сюда не приходят. Экран не обещает того, чего корзина
 * не посчитает, — все числа берутся из ответа корзины.
 */
export function PromotionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const promotions = useGetPortalPromotions();
  const data = promotions.data?.status === 200 ? promotions.data.data : undefined;
  const cart = cartOf(useCart().data);
  const [columnRef, columnWidth] = useColumnWidth<HTMLDivElement>();
  const compact = columnWidth > 0 && columnWidth < COMPACT_BELOW;
  const banners = useGetPortalBanners();
  // Баннер «распродажа» без идущей распродажи вёл бы в пустой отбор — его нет.
  const bannerSlides = liveBanners(banners.data?.status === 200 ? banners.data.data : [], data?.dealCount);

  const nothing = data && promotionsOff(data);
  const active = data
    ? [data.sale, data.volumeTiers.length > 0, data.firstOrder?.status === 'ELIGIBLE'].filter(Boolean).length
    : 0;

  // Назад — туда, откуда пришли; открытому по ссылке возвращаться некуда
  // (первая запись истории роутера — `default`), и тогда — в каталог.
  const back = () => {
    if (location.key === 'default') navigate('/catalog');
    else navigate(-1);
  };

  return (
    <div ref={columnRef} className="flex flex-col gap-8 lg:gap-9">
      {/*
        Своего заголовка у оболочки на телефоне нет — в верхней панели магазин
        и поиск, — поэтому заголовок остаётся здесь, а рядом встаёт «назад».
        Пилюля на телефоне короткая: длинная фраза переносилась под заголовок.
      */}
      <div className={cn('flex flex-wrap justify-between gap-3', compact ? 'items-center' : 'items-end')}>
        <div className={cn('flex gap-1.5', compact ? 'min-w-0 items-center gap-2.5' : 'flex-col')}>
          {compact ? (
            <button
              type="button"
              onClick={back}
              aria-label={t('promotions.v2.back')}
              className={cn(
                'inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-[0_0_0_1px_var(--color-hairline)]',
                'transition-all duration-300 active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              <ArrowLeft aria-hidden="true" className="size-[18px]" />
            </button>
          ) : null}
          <h1 className={cn('font-extrabold tracking-[-0.02em] text-ink', compact ? 'truncate text-[1.375rem]' : 'text-[1.625rem] lg:text-[2.25rem]')}>
            {t('promotions.title')}
          </h1>
          {compact ? null : <p className="text-body text-ink-muted">{t('promotions.v2.lead')}</p>}
        </div>
        {active > 0 && (
          <span
            className={cn(
              'flex items-center gap-2 rounded-[var(--radius-pill)] bg-surface font-semibold text-ink-muted shadow-[0_0_0_1px_var(--color-hairline)]',
              compact ? 'h-8 px-3 text-caption' : 'h-10 px-3.5 text-sm',
            )}
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-in-stock" />
            {t(compact ? 'promotions.v2.activeShort' : 'promotions.v2.active', { count: active })}
          </span>
        )}
      </div>

      {promotions.isPending ? (
        <Skeleton className="h-[300px] w-full rounded-[calc(var(--radius-gallery)*7/6)]" />
      ) : promotions.isError ? (
        <LoadFailed onRetry={() => void promotions.refetch()} />
      ) : nothing || !data ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-surface px-6 py-14 text-center shadow-[0_0_0_1px_var(--color-hairline)]">
          <p className="text-title font-bold text-ink">{t('promotions.emptyTitle')}</p>
          <p className="max-w-[26rem] text-base leading-normal text-ink-muted">{t('promotions.emptyText')}</p>
        </div>
      ) : (
        <>
          <MySavings data={data} cart={cart} compact={compact} />

          {data.sale || bannerSlides.length ? (
            <section aria-labelledby="h-now" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="h-now" className="text-2xl font-extrabold tracking-[-0.01em] text-ink">{t('promotions.v2.now')}</h2>
                {bannerSlides.length && !compact ? (
                  <span className="text-sm text-ink-subtle">{t('promotions.v2.fromEditor')}</span>
                ) : null}
              </div>
              <NowCarousel sale={data.sale} dealCount={data.dealCount} banners={bannerSlides} compact={compact} />
            </section>
          ) : null}

          {data.deals.length ? (
            <Deals deals={data.deals} dealCount={data.dealCount} rubrics={data.saleCategories ?? []} four={columnWidth >= FOUR_FROM} compact={compact} />
          ) : null}

          <HowAndSubscribe data={data} compact={compact} />
        </>
      )}
    </div>
  );
}

/**
 * «Моя выгода»: скидка за объём по этой корзине и билет скидки на первую
 * заявку рядом. Числа — из корзины (`goodsTotal`, `discount`, `nextTier`):
 * экран не пересчитывает скидку сам, чтобы не разойтись с итогом.
 */
function MySavings({ data, cart, compact }: { data: PortalPromotionsDto; cart: CartDto | undefined; compact: boolean }) {
  const { t } = useTranslation();
  const hasVolume = data.volumeTiers.length > 0;
  const first = data.firstOrder;
  if (!hasVolume && !first) return null;

  return (
    <section
      aria-label={t('promotions.v2.mine')}
      className={cn('grid gap-5', hasVolume && first && 'lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]')}
    >
      {hasVolume ? <VolumeHero data={data} cart={cart} compact={compact} /> : null}
      {first ? (
        <div className="flex flex-col gap-3.5">
          {compact ? (
            <CompactFirstOrderTicket percent={first.percent} status={first.status} minTotal={first.minTotal} cart={cart} hasVolume={hasVolume} />
          ) : (
            <FirstOrderTicket percent={first.percent} status={first.status} minTotal={first.minTotal} cart={cart} />
          )}
          {hasVolume && !compact && (
            <p className="flex items-center gap-3 rounded-[var(--radius-tile)] bg-surface px-4 py-3.5 text-sm leading-[1.4] text-ink-muted shadow-[0_0_0_1px_var(--color-hairline)]">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*5/7)] bg-accent-soft text-accent-ink">
                <Info aria-hidden="true" className="size-4" />
              </span>
              {t('promotions.v2.noStack')}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Сколько добрать до скидки за объём — полосой прогресса и словами. */
function VolumeHero({ data, cart, compact }: { data: PortalPromotionsDto; cart: CartDto | undefined; compact: boolean }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const tiers = data.volumeTiers;
  const goods = cart?.goodsTotal ?? 0;
  // Ближайший порог — по самим порогам, а не по `cart.nextTier`: корзина
  // называет его, только когда магазин подсказывает «ещё N тенге до скидки»,
  // и её молчание не значит, что порогов больше нет.
  const next = tiers.find((tier) => goods < tier.from);
  const reached = [...tiers].reverse().find((tier) => goods >= tier.from);
  const target = next ?? tiers[tiers.length - 1];
  const progress = Math.min(100, Math.round((goods / target.from) * 100));
  const missing = next ? Math.max(0, next.from - goods) : 0;
  const firstApplies = cart?.discount?.kind === 'FIRST_ORDER';
  // Подсказка с полоской — как решил магазин: когда до порога осталось не больше
  // выбранной доли или скидка уже есть. Издалека — просто условие скидки.
  const hint = next !== undefined && data.volumeHintPercent !== undefined && data.volumeHintPercent !== null
    && (reached !== undefined || missing * 100 <= next.from * data.volumeHintPercent);
  const showBar = !next || hint;

  let title: string;
  let text: string;
  if (next && !hint) {
    title = t('promotions.v2.volume.from', { from: money(next.from, currency), percent: next.percent });
    text = t('promotions.v2.volume.fromText');
  } else if (!next && reached) {
    const amount = cart?.discount?.kind === 'VOLUME'
      ? cart.discount.amount
      : Math.round((goods * reached.percent) / 100);
    title = t('promotions.v2.volume.done', { percent: reached.percent });
    text = t('promotions.v2.volume.doneText', { from: money(reached.from, currency), percent: reached.percent, amount: money(amount, currency) });
  } else if (reached && next) {
    title = t('promotions.v2.volume.partial', { percent: reached.percent });
    text = t('promotions.v2.volume.partialText', { missing: money(missing, currency), percent: next.percent });
  } else if (firstApplies && next) {
    title = t('promotions.v2.volume.beforeWholesale', { missing: money(missing, currency) });
    text = t('promotions.v2.volume.beforeWholesaleText', { percent: next.percent, from: money(next.from, currency) });
  } else {
    title = t('promotions.v2.volume.more', { missing: money(missing, currency), percent: target.percent });
    text = t('promotions.v2.volume.moreText');
  }

  return (
    <div className="relative flex flex-col gap-5 overflow-hidden rounded-[var(--radius-gallery)] bg-accent-soft px-6 py-6 lg:gap-[22px] lg:px-[30px] lg:py-7">
      {/* Контур коробки — тот же знак «оптом», что в макете; только украшение. */}
      {compact ? null : (
        <Box aria-hidden="true" strokeWidth={1.2} className="pointer-events-none absolute -right-8 -top-6 size-[260px] text-accent/10" />
      )}
      <div className="relative flex flex-wrap items-center gap-2.5">
        <span className="flex h-[30px] items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface px-3 text-caption font-bold text-accent-ink">
          <Layers aria-hidden="true" className="size-4" />
          {t('promotions.volume.title')}
        </span>
        <span className="text-sm text-accent-ink/80">{t('promotions.v2.byCart')}</span>
      </div>
      <div className="relative flex flex-col gap-2">
        <h2 className="text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-ink lg:text-[2.125rem]">{title}</h2>
        {compact ? null : <p className="max-w-[35rem] text-base leading-normal text-ink-muted">{text}</p>}
      </div>
      {showBar ? (
      <div className="relative flex flex-col gap-2.5">
        <div
          role="progressbar"
          aria-label={t('promotions.v2.progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-3 overflow-hidden rounded-full bg-surface lg:h-4"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold text-ink-muted">
          <span>{t('promotions.v2.inCart')} <b className="text-ink">{money(goods, currency)}</b></span>
          {/* На телефоне справа только порог, как в макете: «→ −5%» на узкой строке уезжал под сумму. */}
          {compact ? <span>{money(target.from, currency)}</span> : (
            <span>{money(target.from, currency)} → <b className="text-sale-ink">−{target.percent}%</b></span>
          )}
        </div>
      </div>
      ) : null}
      <div className="relative flex flex-wrap items-center gap-3">
        <Link
          to="/catalog"
          className={cn(
            'flex h-12 items-center gap-2 rounded-[var(--radius-control)] bg-accent px-5 text-body font-bold text-on-accent',
            compact && 'w-full justify-center',
            'transition-colors duration-200 hover:bg-accent-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          )}
        >
          {next ? t('promotions.v2.addMore') : t('promotions.v2.keepShopping')}
          <ArrowRight aria-hidden="true" className="size-[18px]" />
        </Link>
        {compact ? null : (
        <button
          type="button"
          onClick={openCart}
          className={cn(
            'h-12 rounded-[var(--radius-control)] border-[1.5px] border-accent/40 bg-surface px-5 text-body font-semibold text-accent-ink',
            'transition-colors duration-200 hover:border-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          {t('cart.open')}
        </button>
        )}
      </div>
    </div>
  );
}

interface FirstOrderProps {
  percent: number;
  status: string;
  /** Скидка действует от этой суммы товаров; пусто — на любую. */
  minTotal?: number;
  cart: CartDto | undefined;
}

/**
 * Состояние скидки на первую заявку по текущей корзине — одно на оба билета,
 * чтобы телефон и монитор не разошлись в том, сработает ли скидка.
 */
function useFirstOrderState({ percent, status, minTotal, cart }: FirstOrderProps) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const goods = cart?.goodsTotal ?? 0;
  const eligible = status === 'ELIGIBLE';
  const belowMin = eligible && minTotal !== undefined && minTotal !== null && goods < minTotal;
  const yieldsToVolume = eligible && !belowMin && cart?.discount?.kind === 'VOLUME';
  const applies = eligible && goods > 0 && !yieldsToVolume && !belowMin;
  const save = cart?.discount?.kind === 'FIRST_ORDER'
    ? cart.discount.amount
    : Math.round((goods * percent) / 100);

  const pill = !eligible
    ? t(status === 'USED' ? 'promotions.v2.first.used' : 'promotions.v2.first.notNew')
    : belowMin
      ? t('promotions.v2.first.fromPill', { sum: money(minTotal as number, currency) })
      : yieldsToVolume
      ? t('promotions.v2.first.yields')
      : applies ? t('promotions.v2.first.applies') : t('promotions.first.status.ELIGIBLE');
  return { goods, eligible, belowMin, yieldsToVolume, applies, save, pill };
}

/**
 * Скидка на первую заявку — «билетом» с вырезами у пунктирной линии.
 *
 * Состояние говорит правду о текущей корзине: сработает ли она на этой
 * заявке, уступила ли оптовой (они не складываются) или уже использована.
 */
function FirstOrderTicket(props: FirstOrderProps) {
  const { percent, status, minTotal } = props;
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const { goods, eligible, belowMin, yieldsToVolume, applies, save, pill } = useFirstOrderState(props);
  const note = !eligible
    ? t(status === 'USED' ? 'promotions.v2.first.usedNote' : 'promotions.v2.first.notNewNote')
    : belowMin
      ? t('promotions.v2.first.fromNote', { sum: money(minTotal as number, currency), missing: money((minTotal as number) - goods, currency) })
      : yieldsToVolume
      ? t('promotions.v2.first.yieldsNote')
      : applies ? t('promotions.v2.first.appliesNote', { amount: money(save, currency) }) : t('promotions.v2.first.waitNote');

  return (
    <div
      className={cn(
        'relative flex flex-1 flex-col rounded-[var(--radius-gallery)]',
        eligible ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--color-hairline)]' : 'bg-sunk text-ink-muted',
      )}
    >
      <div className="flex flex-col gap-2.5 px-6 pb-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.04em] opacity-75">
            <Ticket aria-hidden="true" className="size-4" />
            {t('promotions.v2.first.title')}
          </span>
          <span
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 text-caption font-bold',
              applies ? 'bg-ok-soft text-ok-ink' : 'bg-canvas text-ink-muted',
            )}
          >
            {applies && <span aria-hidden="true" className="size-1.5 rounded-full bg-in-stock" />}
            {status === 'USED' && <Check aria-hidden="true" className="size-3.5" />}
            {pill}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-[3.5rem] font-black leading-[0.9] tracking-[-0.04em] lg:text-[4.75rem]">−{percent}%</span>
          <span className="text-base font-semibold leading-[1.3] opacity-85">{t('promotions.v2.first.wholeOrder')}</span>
        </div>
      </div>
      {/* Линия отрыва с полукруглыми вырезами цвета фона по краям. */}
      <div aria-hidden="true" className="relative mx-6 border-t-2 border-dashed border-line">
        <span className="absolute -left-9 -top-3 size-6 rounded-full bg-canvas" />
        <span className="absolute -right-9 -top-3 size-6 rounded-full bg-canvas" />
      </div>
      <p className="px-6 pb-6 pt-4 text-sm leading-normal opacity-85">{note}</p>
    </div>
  );
}

/**
 * Билет первой заявки на телефоне — коротким, как в макете телефона:
 * процент, кому он и одна строка о том, что будет с ним в этой корзине.
 *
 * Под линией отрыва — что скидка не складывается с оптовой: на мониторе это
 * говорит отдельная строка рядом с билетом, на телефоне её нет, и без этой
 * фразы покупатель ждал бы обе скидки сразу. Без оптовой складываться не с чем —
 * тогда строки нет.
 */
function CompactFirstOrderTicket({ hasVolume, ...props }: FirstOrderProps & { hasVolume: boolean }) {
  const { t } = useTranslation();
  const { eligible, belowMin, yieldsToVolume, applies, pill } = useFirstOrderState(props);
  // Действующая скидка — просто «применится сама»; порог, уступка оптовой
  // и прочие состояния называются теми же словами, что пилюля на мониторе.
  const line = eligible && !belowMin && !yieldsToVolume ? t('promotions.v2.first.appliesShort') : pill;

  return (
    <div
      data-testid="first-ticket"
      className={cn(
        'relative flex flex-col rounded-[calc(var(--radius-tile)*1.25)]',
        eligible ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--color-hairline)]' : 'bg-sunk text-ink-muted',
      )}
    >
      <div className="flex items-center gap-3.5 px-4 py-4">
        <span className="text-[2.5rem] font-black leading-none tracking-[-0.04em]">−{props.percent}%</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <b className="text-body">{t('promotions.v2.first.onFirst')}</b>
          <span className={cn('flex items-center gap-1.5 text-caption', applies ? 'font-semibold text-ok-ink' : 'opacity-85')}>
            {applies && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-in-stock" />}
            {props.status === 'USED' && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
            {line}
          </span>
        </span>
      </div>
      {hasVolume ? (
        <>
          <div aria-hidden="true" className="relative mx-4 border-t-2 border-dashed border-line">
            <span className="absolute -left-7 -top-3 size-6 rounded-full bg-canvas" />
            <span className="absolute -right-7 -top-3 size-6 rounded-full bg-canvas" />
          </div>
          <p className="px-4 pb-3.5 pt-3 text-caption leading-[1.4] opacity-85">{t('promotions.v2.first.noStackShort')}</p>
        </>
      ) : null}
    </div>
  );
}

/** Сколько осталось до конца: дни, часы, минуты. */
function useCountdown(endsAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = Math.max(0, new Date(endsAt).getTime() - now);
  const minutes = Math.floor(left / 60_000);
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

/** Идущая распродажа: название, пара слов, «Смотреть N товаров» и отсчёт до конца. */
function SaleHero({ sale, dealCount, compact }: {
  sale: NonNullable<PortalPromotionsDto['sale']>;
  dealCount: number;
  compact: boolean;
}) {
  const { t, i18n } = useTranslation();
  const left = useCountdown(sale.endsAt);
  const lastDay = sale.endsOn
    ? new Intl.DateTimeFormat(i18n.language === 'kk' ? 'kk-KZ' : i18n.language, { day: 'numeric', month: 'long' })
      .format(new Date(`${sale.endsOn}T12:00:00`))
    : null;

  return (
    <div
      aria-labelledby="h-sale"
      className={cn(
        // Глубокий тон распродажи из макета — `sale-text`, самый тёмный в её гамме.
        // Ночью `sale-text` светлый (им пишут по тёмному), и белые буквы на нём
        // пропали бы — там плита берёт фирменную заливку баннера, как в макете.
        'relative flex min-h-[280px] flex-col overflow-hidden rounded-[calc(var(--radius-gallery)*7/6)] bg-sale-text text-white dark:bg-banner',
        compact ? 'min-h-[240px] gap-4 px-5 py-6' : 'gap-8 px-6 py-8 lg:flex-row lg:items-center lg:px-10 lg:py-9',
      )}
    >
      {/* Силуэты одежды — как у шаблона «Распродажа» баннеров; только украшение. */}
      <svg aria-hidden="true" viewBox="0 0 120 150" className={cn('absolute fill-white/10', compact ? '-bottom-12 -right-8 h-[210px]' : 'bottom-[-40px] right-[28%] hidden h-[300px] lg:block')}>
        <path d={COAT} />
      </svg>
      {compact ? null : (
        <svg aria-hidden="true" viewBox="0 0 120 150" className="absolute bottom-[-30px] right-[38%] hidden h-[210px] fill-white/[0.07] lg:block">
          <path d={COAT} />
        </svg>
      )}
      <div className="relative flex max-w-[480px] flex-col gap-4">
        <span className="flex h-8 items-center self-start rounded-[var(--radius-pill)] bg-surface px-3.5 text-sm font-extrabold text-sale-text">
          {t('promotions.sale.badge', { percent: sale.maxPercent })}
        </span>
        <h3 id="h-sale" className="text-[1.75rem] font-black leading-none tracking-[-0.03em] lg:text-[2.75rem]">
          {sale.title}
        </h3>
        {/* На телефоне описания нет, как в макете: плита и без него в экран высотой, а главное — срок и кнопка. */}
        {compact ? null : sale.text ? <p className="text-base leading-normal text-white/80">{sale.text}</p> : (
          <p className="text-body text-white/80">{t('promotions.sale.noCode')}</p>
        )}
        {compact && left && sale.countdown !== false ? (
          <p className="flex items-center gap-2 text-caption font-bold text-white/85">
            <Clock aria-hidden="true" className="size-4" />
            {t('promotions.v2.leftShort', { days: left.days, hours: left.hours })}{lastDay ? ` · ${t('promotions.v2.untilShort', { date: lastDay })}` : ''}
          </p>
        ) : null}
        <Link
          to="/catalog?sale=1"
          className={cn(
            'flex h-12 items-center gap-2.5 rounded-[var(--radius-control)] bg-white px-5 text-body font-bold text-[#1A1917] transition-colors hover:bg-[#FCEBDD]',
            compact ? 'w-full justify-center' : 'self-start',
          )}
        >
          {dealCount > 0 ? t('promotions.v2.seeDeals', { count: dealCount }) : t('promotions.sale.cta')}
          <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
      </div>
      {compact ? null : left && sale.countdown !== false ? (
        <div className="relative flex flex-col gap-2.5 self-start lg:ml-auto">
          <div className="text-sm font-semibold text-white/80">{t('promotions.sale.until')}</div>
          <div className="flex gap-2" role="timer" aria-label={t('promotions.sale.leftLabel', left)}>
            <TimeBox value={String(left.days)} label={t('promotions.sale.days', { count: left.days })} />
            <TimeBox value={String(left.hours).padStart(2, '0')} label={t('promotions.sale.hours', { count: left.hours })} />
            <TimeBox value={String(left.minutes).padStart(2, '0')} label={t('promotions.sale.minutes', { count: left.minutes })} />
          </div>
          {lastDay ? <div className="text-sm text-white/80">{t('promotions.sale.lastDay', { date: lastDay })}</div> : null}
        </div>
      ) : lastDay ? (
        // Магазин выключил отсчёт — долгой акции тикающие минуты ни к чему; остаётся последний день.
        <div className="relative self-start text-body font-semibold text-white/80 lg:ml-auto">
          {t('promotions.sale.lastDay', { date: lastDay })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * «Сейчас в магазине»: распродажа первым слайдом, за ней баннеры из
 * редактора магазина — точками, как в макете. Один слайд — без точек.
 */
function NowCarousel({ sale, dealCount, banners, compact }: {
  sale: PortalPromotionsDto['sale'];
  dealCount: number;
  banners: ShowcaseBannerDto[];
  compact: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const { supplierId } = useSupplier();
  const suppliers = useGetPortalSuppliers();
  const shop = suppliers.data?.status === 200 ? suppliers.data.data.find((one) => one.supplierId === supplierId) : undefined;
  // Цвет — из опубликованного дизайна, как у баннеров витрины.
  const brand = resolveDesign(shop).brand ?? PLATFORM_BRAND;
  const count = (sale ? 1 : 0) + banners.length;
  const at = Math.min(current, count - 1);
  const banner = sale ? (at === 0 ? null : banners[at - 1]) : banners[at];

  const open = (slide: ShowcaseBannerDto) => {
    if (slide.target === 'ITEM' && slide.targetItemId) navigate(`/catalog/${slide.targetItemId}`);
    else if (slide.target === 'CATEGORY' && slide.targetCategoryId) navigate(`/catalog?category=${slide.targetCategoryId}`);
    else if (slide.target === 'SALE') navigate('/catalog?sale=1');
    else if (slide.target === 'NOVELTY') navigate('/catalog?novelty=1');
    // «Акции» — этот же экран: уводить с него некуда.
    else if (slide.target !== 'PROMOTIONS') navigate('/catalog');
  };

  return (
    <div className="relative">
      {banner ? (
        <div className={cn('overflow-hidden rounded-[calc(var(--radius-gallery)*7/6)]', compact ? 'h-[220px]' : 'h-[280px]')}>
          <BannerSlide slide={banner} brand={brand} compact={compact} hidden={false} onAction={() => open(banner)} />
        </div>
      ) : sale ? (
        <SaleHero sale={sale} dealCount={dealCount} compact={compact} />
      ) : null}
      {count > 1 ? (
        // На телефоне точки — под слайдом: поверх они наезжали бы на кнопку во всю ширину.
        <div role="group" aria-label={t('promotions.v2.slides')}
          className={cn('flex gap-1.5', compact ? 'mt-3 justify-center' : 'absolute bottom-4 right-5')}>
          {Array.from({ length: count }, (_, index) => (
            <button key={index} type="button" aria-current={index === at ? 'true' : undefined}
              aria-label={t('promotions.v2.slide', { n: index + 1 })} onClick={() => setCurrent(index)}
              className={cn(
                'h-2 cursor-pointer rounded-full border-0 p-0 transition-all',
                index === at ? cn('w-6', compact ? 'bg-ink' : 'bg-white') : cn('w-2', compact ? 'bg-ink-faint' : 'bg-white/50'),
              )} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TimeBox({ value, label }: { value: string; label: string }) {
  return (
    <div aria-hidden="true" className="flex h-[76px] min-w-[76px] flex-col items-center justify-center rounded-[var(--radius-tile)] bg-white/10 leading-none">
      <span className="text-[1.875rem] font-extrabold tabular-nums">{value}</span>
      <span className="mt-1.5 text-xs text-night-sub">{label}</span>
    </div>
  );
}

/**
 * Товары со скидкой: на мониторе — один ряд сеткой (четыре или три карточки)
 * и «Все N товаров →», на телефоне — лентой всех,
 * которую листают пальцем, с отбором по рубрике (когда рубрик больше одной).
 *
 * Рубрики — те, что прислал сервер (`saleCategories`: все рубрики идущей
 * распродажи, а не только попавшие в первые карточки). «Все · N» показывает
 * первые карточки из ответа акций; выбранная рубрика грузит свои товары
 * распродажи отдельно — `catalog?onSale=true&categoryId=…`.
 *
 * Узкая колонка (`compact`) — всегда лента маленьких карточек, даже на
 * широком окне: сетка по `lg` смотрит на окно, а места мало у колонки.
 */
function Deals({ deals, dealCount, rubrics, four, compact }: {
  deals: ShowcaseItemDto[];
  dealCount: number;
  rubrics: PortalPromoSaleCategory[];
  four: boolean;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const [rubric, setRubric] = useState<string | null>(null);
  const inRubric = useGetPortalCatalog(
    { onSale: true, categoryId: rubric ?? undefined, size: RUBRIC_SIZE },
    { query: { enabled: rubric !== null } },
  );
  const loaded = inRubric.data?.status === 200 ? inRubric.data.data.items ?? [] : undefined;
  // Пока рубрика грузится — её товары из уже показанных, чтобы лента не пустела.
  const shown = rubric === null
    ? deals
    : loaded ?? deals.filter((deal) => deal.categoryId === rubric);
  const cart = cartOf(useCart().data);
  const inCart = new Set((cart?.lines ?? []).map((line) => line.itemId));

  const chip = (on: boolean) => cn(
    'flex h-10 shrink-0 items-center rounded-[var(--radius-pill)] border-[1.5px] px-3.5 text-sm font-semibold',
    on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink-muted',
  );

  return (
    <section id="deals" aria-labelledby="h-deals" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="h-deals" className="text-2xl font-extrabold tracking-[-0.01em] text-ink">{t('promotions.deals.title')}</h2>
        {/* На телефоне — просто «Все»: число товаров уже на кнопке распродажи и в отборе «Все · N». */}
        <Link to="/catalog?sale=1" className="text-body font-bold text-accent-ink hover:underline">
          {compact ? t('promotions.v2.allShort') : `${t('promotions.v2.allDeals', { count: dealCount })} →`}
        </Link>
      </div>
      {rubrics.length >= 2 && (
        <div role="group" aria-label={t('catalog.rubrics')} className={cn('-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]', !compact && 'lg:hidden')}>
          <button type="button" aria-pressed={rubric === null} onClick={() => setRubric(null)} className={chip(rubric === null)}>
            {t('promotions.v2.allChip', { count: dealCount })}
          </button>
          {rubrics.map(({ categoryId, name }) => (
            <button key={categoryId} type="button" aria-pressed={rubric === categoryId} onClick={() => setRubric(categoryId)} className={chip(rubric === categoryId)}>
              {name}
            </button>
          ))}
        </div>
      )}
      <div
        className={cn(
          // Телефон: лента карточек по 200 точек, до края экрана.
          '-mr-4 flex gap-3 overflow-x-auto pr-4 [scrollbar-width:none]',
          !compact && 'lg:mr-0 lg:grid lg:gap-5 lg:overflow-visible lg:pr-0',
          !compact && (four ? 'lg:grid-cols-4' : 'lg:grid-cols-3'),
        )}
      >
        {shown.map((deal, index) => (
          <DealCard
            key={deal.id}
            deal={deal}
            inCart={inCart.has(deal.id)}
            compact={compact}
            // На мониторе — ровно один ряд, остальное за «Все N товаров →»;
            // на телефоне лента листается пальцем и показывает всё.
            beyondRow={!compact && index >= (four ? 4 : 3)}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Карточка товара распродажи: скидка, цена со старой, выгода и «В корзину» / «В корзине».
 * Маленькая (`compact`) — без строки выгоды: её и так видно по зачёркнутой цене.
 */
function DealCard({ deal, inCart, compact, beyondRow = false }: {
  deal: ShowcaseItemDto;
  inCart: boolean;
  compact: boolean;
  /** Карточка за первым рядом монитора: на мониторе прячется, в ленте телефона видна. */
  beyondRow?: boolean;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const { add, isPending } = useAddToCart();
  const setLine = useSetCartLine();
  const save = deal.oldPrice != null ? deal.oldPrice - deal.price : 0;

  return (
    <article
      data-testid="deal-card"
      className={cn(
        'flex w-[200px] shrink-0 flex-col overflow-hidden rounded-[calc(var(--radius-tile)*1.25)] bg-surface shadow-[0_0_0_1px_var(--color-hairline)]',
        !compact && 'lg:w-auto',
        beyondRow && 'lg:hidden',
      )}
    >
      <Link to={`/catalog/${deal.id}`} className="relative block" aria-label={deal.name}>
        <ItemThumb itemId={deal.id} src={deal.thumbnailUrl} className={cn('h-[150px] w-full', !compact && 'lg:h-[190px]')} />
        {deal.discountPercent ? (
          <span className="absolute left-2.5 top-2.5 flex h-[30px] items-center rounded-[var(--radius-pill)] bg-sale px-3 text-sm font-extrabold text-white">
            −{deal.discountPercent}%
          </span>
        ) : null}
      </Link>
      <div className={cn('flex flex-1 flex-col gap-2 p-3', !compact && 'lg:px-4 lg:pb-4 lg:pt-3.5')}>
        <h3 className="line-clamp-2 min-h-10 text-body font-semibold leading-[1.35] text-ink">{deal.name}</h3>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className={cn('text-lg font-extrabold tracking-[-0.01em] text-sale', !compact && 'lg:text-title')}>{money(deal.price, currency)}</span>
          {deal.oldPrice != null && <s className="text-sm text-ink-faint">{money(deal.oldPrice, currency)}</s>}
        </div>
        {save > 0 && !compact && (
          <span className="text-caption font-semibold text-ink-muted">{t('promotions.v2.saving', { amount: money(save, currency) })}</span>
        )}
        <div className="flex-1" />
        {inCart ? (
          <button
            type="button"
            disabled={setLine.isPending}
            onClick={() => setLine.mutate({ itemId: deal.id, data: { quantity: 0 } })}
            aria-label={t('promotions.v2.removeAria', { name: deal.name })}
            className={cn(
              'flex h-11 items-center justify-center gap-2 rounded-[calc(var(--radius-control)*6/7)] bg-accent-soft text-sm font-bold text-accent-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            <Check aria-hidden="true" className="size-4" />
            {t('promotions.v2.inCartShort')}
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => void add(deal)}
            className={cn(
              'flex h-11 items-center justify-center gap-2 rounded-[calc(var(--radius-control)*6/7)] bg-accent text-sm font-bold text-on-accent',
              'transition-colors duration-200 hover:bg-accent-hover',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            )}
          >
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.4} />
            {t('catalog.toCart')}
          </button>
        )}
      </div>
    </article>
  );
}

/** «Как работают скидки» и подписка — двумя панелями рядом. */
function HowAndSubscribe({ data, compact }: { data: PortalPromotionsDto; compact: boolean }) {
  // На телефоне «как работают скидки» не помещается рядом с делом — макет телефона его не показывает.
  const hasHow = !compact && (data.volumeTiers.length > 0 || !!data.firstOrder);
  if (!hasHow && !data.subscription) return null;
  return (
    <section className={cn('grid gap-5', hasHow && data.subscription && 'lg:grid-cols-2')}>
      {hasHow ? <HowItWorks /> : null}
      {data.subscription ? <Subscription data={data} compact={compact} /> : null}
    </section>
  );
}

function HowItWorks() {
  const { t } = useTranslation();
  const facts = ['auto', 'together', 'one'] as const;
  return (
    <div className="flex flex-col gap-3.5 rounded-[var(--radius-gallery)] bg-surface p-6 shadow-[0_0_0_1px_var(--color-hairline)]">
      <h2 className="mb-1 text-title font-extrabold text-ink">{t('promotions.v2.how.title')}</h2>
      {facts.map((fact) => (
        <div key={fact} className="flex gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*6/7)] bg-accent-soft text-accent-ink">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <b className="text-base text-ink">{t(`promotions.v2.how.${fact}.title`)}</b>
            <span className="text-sm leading-[1.45] text-ink-muted">{t(`promotions.v2.how.${fact}.text`)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Подписка на акции — с примером сообщения, собранным из настоящих данных
 * магазина: его имени и идущей распродажи. Выдуманная акция в примере
 * обещала бы то, чего в магазине нет.
 */
function Subscription({ data, compact }: { data: PortalPromotionsDto; compact: boolean }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const shop = useCurrentShop();
  const profile = useGetPortalProfile();
  const viewerPhone = profile.data?.status === 200 ? profile.data.data.phone : undefined;
  const subscribed = data.subscription?.subscribed ?? false;
  const endsOn = data.sale?.endsOn
    ? new Intl.DateTimeFormat(i18n.language === 'kk' ? 'kk-KZ' : i18n.language, { day: 'numeric', month: 'long' })
      .format(new Date(`${data.sale.endsOn}T12:00:00`))
    : null;
  const example = data.sale
    ? [t('promotions.v2.sub.exampleSale', { title: data.sale.title, percent: data.sale.maxPercent }),
      endsOn ? t('promotions.v2.sub.exampleUntil', { date: endsOn }) : null].filter(Boolean).join(' ')
    : t('promotions.v2.sub.exampleGeneric');
  const locale = i18n.language === 'kk' ? 'kk-KZ' : i18n.language;
  // Время в пузыре — нынешнее: пример читается как сообщение, пришедшее только что.
  // Считается при каждой отрисовке — экран живёт недолго, тикать ему незачем.
  const sentAt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  // Обещание магазина — со строчной, чтобы вставать в строку после номера
  // («На номер … · не чаще раза в неделю») и после «В WhatsApp,» на телефоне.
  const promise = data.subscription?.promise ? t(`promotions.v2.sub.promise.${data.subscription.promise}`) : null;
  const phone = viewerPhone ? formatPhone(viewerPhone) : null;
  const sendsTo = phone && promise
    ? t('promotions.v2.sub.toPhoneLine', { phone, promise })
    : phone
      ? t('promotions.v2.sub.toPhone', { phone })
      // Без номера обещание стоит одно — и тогда с заглавной, как начало фразы.
      : promise ? promise.charAt(0).toLocaleUpperCase(locale) + promise.slice(1) : null;

  async function toggle() {
    setBusy(true);
    try {
      const response = await setPortalPromoSubscription({ subscribed: !subscribed });
      if (response.status === 200) queryClient.setQueryData(getGetPortalPromotionsQueryKey(), response);
    } finally {
      setBusy(false);
    }
  }

  const switchButton = (
    <button
      type="button"
      role="switch"
      aria-checked={subscribed}
      aria-label={t('promotions.subscription.off')}
      disabled={busy}
      onClick={() => void toggle()}
      className={cn(
        'relative h-[30px] w-[52px] shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        subscribed ? 'bg-in-stock' : 'bg-ink-faint',
      )}
    >
      <span className={cn('absolute top-[3px] size-6 rounded-full bg-white shadow-soft transition-[left]',
        subscribed ? 'left-[25px]' : 'left-[3px]')} />
    </button>
  );

  // Телефон: одна строка, как в макете, — значок, что обещает магазин, переключатель.
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-[calc(var(--radius-tile)*1.25)] bg-surface p-4 shadow-[0_0_0_1px_var(--color-hairline)]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*6/7)] bg-ok-soft text-ok-ink">
          <Bell aria-hidden="true" className="size-5" />
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <b className="text-body text-ink">{subscribed ? t('promotions.subscription.on') : t('promotions.subscription.off')}</b>
          {promise ? (
            <span className="text-xs text-ink-subtle">{t('promotions.v2.sub.viaWhatsapp', { promise })}</span>
          ) : null}
        </span>
        {switchButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-gallery)] bg-surface p-6 shadow-[0_0_0_1px_var(--color-hairline)]">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*6/7)] bg-ok-soft text-ok-ink">
          <Bell aria-hidden="true" className="size-5" />
        </span>
        <h2 className="text-title font-extrabold text-ink">{t('promotions.subscription.title')}</h2>
      </div>
      <figure className="flex flex-1 flex-col justify-end gap-2 rounded-[calc(var(--radius-tile)*1.125)] bg-sunk p-4">
        <figcaption className="self-center text-xs text-ink-subtle">{t('promotions.v2.sub.exampleLabel')}</figcaption>
        <p className="max-w-[88%] self-start rounded-[4px_16px_16px_16px] bg-ok-soft px-3.5 py-3 text-sm leading-[1.45] text-ink">
          {shop?.name && <b className="block text-ok-ink">{shop.name}</b>}
          {example}
          <span className="mt-1 block text-right text-2xs tabular-nums text-ink-subtle">{sentAt}</span>
        </p>
      </figure>
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          role="switch"
          aria-checked={subscribed}
          aria-labelledby="sub-label"
          disabled={busy}
          onClick={() => void toggle()}
          className={cn(
            'relative h-8 w-14 shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors disabled:opacity-60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            subscribed ? 'bg-in-stock' : 'bg-ink-faint',
          )}
        >
          <span className={cn('absolute top-[3px] size-[26px] rounded-full bg-white shadow-soft transition-[left]',
            subscribed ? 'left-[27px]' : 'left-[3px]')} />
        </button>
        <span id="sub-label" className="flex flex-col gap-0.5">
          <b className="text-base text-ink">
            {subscribed ? t('promotions.subscription.on') : t('promotions.subscription.off')}
          </b>
          {sendsTo ? <span className="text-caption text-ink-subtle">{sendsTo}</span> : null}
        </span>
      </div>
    </div>
  );
}

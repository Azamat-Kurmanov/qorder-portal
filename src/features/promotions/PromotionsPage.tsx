import { takenIn } from '../cart/cartPart';
import { useOrderMode } from '../cart/orderMode';
import { LoadFailed } from '../../ui/LoadFailed';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Clock, Layers, ShoppingCart, Ticket } from '../../ui/icons';
import {
  useGetPortalBanners,
  useGetPortalCatalog,
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
import { ItemThumb } from '../catalog/ItemThumb';
import { dayMonth, money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { cn } from '../../ui/cn';
import { Skeleton } from '../../ui/Skeleton';
import { useColumnWidth } from '../../ui/useColumnWidth';
import { BannerSlide } from '../banners/BannerSlide';
import { liveBanners } from '../banners/BannerCarousel';
import { COUNTDOWN_DAYS } from '../banners/Countdown';
import { useSupplier } from '../../supplier/useSupplier';
import { resolveDesign } from '../../supplier/cabinetDesign';
import { promotionsOff } from './promotionsOff';
import { useReadOnOpen } from '../notifications/useReadOnOpen';
import { PromoSubscription } from '../profile/PromoSubscription';
import { HOME } from '../../ui/sectionBack';
import { BACK } from '../shell/SectionHead';

/** С какой ширины колонки товары распродажи встают в четыре карточки — как на витрине. */
const FOUR_FROM = 1040;

/** Сколько товаров рубрики распродажи грузит чип — как страница витрины. */
const RUBRIC_SIZE = 50;

/** Уже этой ширины колонка — телефон: блоки собираются компактно, как в макете телефона. */
const COMPACT_BELOW = 640;

/** Фирменный цвет платформы — для слайдов баннеров, если у магазина своего нет. */
const PLATFORM_BRAND = '#015640';

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
  const promotions = useGetPortalPromotions();
  const data = promotions.data?.status === 200 ? promotions.data.data : undefined;
  useReadOnOpen('PROMO_STARTED');
  const cart = cartOf(useCart().data);
  const [columnRef, columnWidth] = useColumnWidth<HTMLDivElement>();
  const compact = columnWidth > 0 && columnWidth < COMPACT_BELOW;
  const banners = useGetPortalBanners();
  // Баннер «распродажа» без идущей распродажи вёл бы в пустой отбор — его нет.
  const bannerSlides = liveBanners(banners.data?.status === 200 ? banners.data.data : [], data?.dealCount);

  const nothing = data && promotionsOff(data);

  // Стрелка у имени раздела — всегда на «Главную» (решение владельца 2026-11-05).
  const back = () => navigate(HOME);

  return (
    <div ref={columnRef} className="flex flex-col gap-4 lg:gap-6">
      {/* «Вариант Б» (SimplePicPromotions): «Назад», заголовок и строка «Скидки считаются в корзине сами». */}
      <div className="flex items-center gap-3.5 pt-1">
        <button type="button" onClick={back} aria-label={t('promotions.v2.back')} className={BACK}>
          <ChevronLeft aria-hidden="true" className="size-7" />
          <span aria-hidden="true" className="hidden lg:inline">{t('promotions.v2.back')}</span>
        </button>
        <span className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 text-title font-extrabold leading-tight text-ink lg:text-display">{t('promotions.title')}</h1>
          <span className="text-body text-ink-muted">{t('promotions.v2.lead')}</span>
        </span>
      </div>

      {promotions.isPending ? (
        <Skeleton className="h-[300px] w-full rounded-[calc(var(--radius-gallery)*7/6)]" />
      ) : promotions.isError ? (
        <LoadFailed onRetry={() => void promotions.refetch()} />
      ) : nothing || !data ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-surface px-6 py-14 text-center border-2 border-solid border-hairline">
          <p className="text-title font-bold text-ink">{t('promotions.emptyTitle')}</p>
          <p className="max-w-[26rem] text-base leading-normal text-ink-muted">{t('promotions.emptyText')}</p>
        </div>
      ) : (
        // «Вариант Б» (SimplePicPromotions / SimplePicWebPromotions): распродажа и товары со скидкой —
        // слева, «Моя выгода», первая заявка и подписка — справа; на телефоне — одной колонкой.
        <div className={cn('flex flex-col gap-3.5', !compact && 'lg:grid lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start lg:gap-7')}>
          <div className="flex min-w-0 flex-col gap-3.5">
            {data.sale || bannerSlides.length ? (
              <section aria-label={t('promotions.v2.now')}>
                <NowCarousel sale={data.sale} banners={bannerSlides} compact={compact} />
              </section>
            ) : null}

            {data.deals.length ? (
              <Deals deals={data.deals} dealCount={data.dealCount} rubrics={data.saleCategories ?? []} four={columnWidth >= FOUR_FROM} compact={compact} />
            ) : data.sale ? (
              <Link to="/catalog?sale=1" className={SEE_ALL}>{t('promotions.sale.cta')}</Link>
            ) : null}
          </div>

          <div className="flex flex-col gap-3.5">
            <MySavings data={data} cart={cart} compact={compact} />
            <PromoSubscription />
          </div>
        </div>
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
      className="flex flex-col gap-3.5"
    >
      {hasVolume ? <VolumeHero data={data} cart={cart} compact={compact} /> : null}
      {first ? (
        <div className="flex flex-col gap-2">
          {compact ? (
            <CompactFirstOrderTicket percent={first.percent} status={first.status} minTotal={first.minTotal} cart={cart} hasVolume={hasVolume} />
          ) : (
            <FirstOrderTicket percent={first.percent} status={first.status} minTotal={first.minTotal} cart={cart} />
          )}
          {hasVolume && !compact && (
            <p className="m-0 px-1 text-body leading-[1.4] text-ink-muted">{t('promotions.v2.noStack')}</p>
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
    <div className={cn(CARD, 'gap-2.5')}>
      {compact ? null : (
        <b className="text-lead font-extrabold text-ink">{t('promotions.v2.mine')} · {t('promotions.v2.byCart')}</b>
      )}
      <span className="flex items-center gap-2 text-lead font-extrabold text-ink">
        <Layers aria-hidden="true" className="size-5 text-shop-ink" />
        {t('promotions.volume.title')}
      </span>
      <h2 className="m-0 text-lead font-extrabold leading-snug text-ok-ink">{title}</h2>
      {compact ? null : <p className="m-0 text-body leading-normal text-ink-muted">{text}</p>}
      {showBar ? (
        <div className="relative flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-label={t('promotions.v2.progress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-3.5 overflow-hidden rounded-full bg-sunk"
          >
            <div className="h-full bg-shop transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-caption font-semibold text-ink-muted">
            <span>{t('promotions.v2.inCart')} <b className="text-ink">{money(goods, currency)}</b></span>
            {/* На телефоне справа только порог: «→ −5%» на узкой строке уезжал под сумму. */}
            {compact ? <span>{money(target.from, currency)}</span> : (
              <span>{money(target.from, currency)} → <b className="text-sale-ink">−{target.percent}%</b></span>
            )}
          </div>
        </div>
      ) : null}
      <Link to="/catalog" className={cn(SEE_ALL, 'h-14 border-line text-ink')}>
        {next ? t('promotions.v2.addMore') : t('promotions.v2.keepShopping')}
      </Link>
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
    <div className={cn(CARD, 'flex-row items-start gap-3', !eligible && 'bg-sunk text-ink-muted')}>
      <span aria-hidden="true" className={GIFT}><Ticket className="size-6" /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="text-lead font-extrabold">−{percent}% {t('promotions.v2.first.wholeOrder')}</b>
        <span className={cn('inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-caption font-bold',
          applies ? 'bg-ok-soft text-ok-ink' : 'bg-canvas text-ink-muted')}>
          {status === 'USED' && <Check aria-hidden="true" className="size-3.5" />}
          {pill}
        </span>
        <span className="text-body leading-normal text-ink-muted">{note}</span>
      </span>
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
    <div data-testid="first-ticket" className={cn(CARD, 'flex-row items-center gap-3', !eligible && 'bg-sunk text-ink-muted')}>
      <span aria-hidden="true" className={GIFT}><Ticket className="size-6" /></span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="text-lead font-extrabold"><span>−{props.percent}%</span> <span>{t('promotions.v2.first.onFirst')}</span></b>
        <span className={cn('flex items-center gap-1.5 text-caption', applies ? 'font-semibold text-ok-ink' : 'text-ink-muted')}>
          {props.status === 'USED' && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
          {line}
        </span>
        {hasVolume ? <span className="text-caption text-ink-muted">{t('promotions.v2.first.noStackShort')}</span> : null}
      </span>
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
function SaleHero({ sale, compact }: {
  sale: NonNullable<PortalPromotionsDto['sale']>;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const left = useCountdown(sale.endsAt);
  const lastDay = sale.endsOn ? dayMonth(sale.endsOn) : null;

  const timeLeft = left && sale.countdown !== false
    ? (left.days > COUNTDOWN_DAYS && lastDay ? t('promotions.v2.untilShort', { date: lastDay }) : t('promotions.v2.dh', { days: left.days, hours: left.hours }))
    : null;
  return (
    <div
      aria-labelledby="h-sale"
      className={cn(
        // Ночью `sale` светлеет — плита берёт фирменную заливку баннера, чтобы белые буквы не пропали.
        'flex flex-col gap-2 rounded-[1.5rem] bg-sale p-4 text-white dark:bg-banner',
        !compact && 'lg:flex-row lg:items-center lg:gap-5 lg:p-6',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="inline-flex h-8 items-center self-start rounded-full bg-white px-3.5 text-caption font-extrabold text-sale-ink">
          {t('promotions.sale.badge', { percent: sale.maxPercent })}
        </span>
        <h3 id="h-sale" className={cn('m-0 text-title font-extrabold leading-tight', !compact && 'lg:text-display')}>{sale.title}</h3>
        {compact && timeLeft ? (
          <p role="timer" aria-label={t('promotions.sale.leftLabel', left ?? undefined)} className="m-0 flex items-center gap-1.5 text-body font-bold">
            <Clock aria-hidden="true" className="size-4" />
            {t('promotions.sale.until')}: {timeLeft}
          </p>
        ) : null}
        {/* На телефоне описания нет: главное — срок; что скидка уже в цене — одной строкой. */}
        <p className="m-0 text-body opacity-90">{!compact && sale.text ? sale.text : t('promotions.sale.noCode')}</p>
      </div>
      {compact ? null : timeLeft ? (
        <div role="timer" aria-label={t('promotions.sale.leftLabel', left ?? undefined)} className="shrink-0 text-center">
          <span className="text-caption opacity-90">{t('promotions.sale.until')}</span>
          <b className="block text-display font-extrabold tabular-nums">{timeLeft}</b>
          {lastDay ? <span className="text-caption opacity-80">{t('promotions.sale.lastDay', { date: lastDay })}</span> : null}
        </div>
      ) : lastDay ? (
        // Магазин выключил отсчёт — остаётся последний день.
        <div className="shrink-0 text-body font-semibold opacity-90">{t('promotions.sale.lastDay', { date: lastDay })}</div>
      ) : null}
    </div>
  );
}

/**
 * «Сейчас в магазине»: распродажа первым слайдом, за ней баннеры из
 * редактора магазина — точками, как в макете. Один слайд — без точек.
 */
function NowCarousel({ sale, banners, compact }: {
  sale: PortalPromotionsDto['sale'];
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
        <SaleHero sale={sale} compact={compact} />
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
  const [orderMode] = useOrderMode();
  const inCart = takenIn(cart, orderMode);

  const chip = (on: boolean) => cn(
    'flex min-h-12 shrink-0 items-center rounded-2xl border-[3px] border-solid px-3.5 text-body font-extrabold',
    on ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink',
  );

  return (
    <section id="deals" aria-label={t('promotions.deals.title')} className="flex flex-col gap-3">
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
      <div className={cn('grid grid-cols-2 gap-2.5', !compact && (four ? 'lg:grid-cols-4 lg:gap-3.5' : 'lg:grid-cols-3 lg:gap-3.5'))}>
        {shown.map((deal, index) => (
          <DealCard
            key={deal.id}
            deal={deal}
            inCart={inCart.has(deal.id)}
            compact={compact}
            // На мониторе — ровно один ряд, остальное за кнопкой; на телефоне — все.
            beyondRow={!compact && index >= (four ? 4 : 3)}
          />
        ))}
      </div>
      <Link to="/catalog?sale=1" className={cn(SEE_ALL, !compact && 'lg:self-start lg:px-8')}>
        {t('promotions.v2.seeSale', { count: dealCount })}
      </Link>
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
  // «Убрать» — только из заявки, в которой клиент сейчас: розничная не трогает оптовую.
  const [orderMode] = useOrderMode();
  const mode = deal.wholesale?.retail ? orderMode : undefined;
  const save = deal.oldPrice != null ? deal.oldPrice - deal.price : 0;

  return (
    <article
      data-testid="deal-card"
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface',
        beyondRow && 'lg:hidden',
      )}
    >
      <Link to={`/catalog/${deal.id}`} className="relative block" aria-label={deal.name}>
        <ItemThumb itemId={deal.id} src={deal.thumbnailUrl} className="h-[8rem] w-full" />
        {deal.discountPercent ? (
          <span className="absolute left-2 top-2 flex h-7 items-center rounded-full bg-sale px-2.5 text-caption font-extrabold text-on-sale">
            −{deal.discountPercent}%
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <h3 className="m-0 line-clamp-2 text-body font-semibold leading-tight text-ink">{deal.name}</h3>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lead font-extrabold text-sale">{money(deal.price, currency)}</span>
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
            onClick={() => setLine.mutate({ itemId: deal.id, data: { quantity: 0, mode } })}
            aria-label={t('promotions.v2.removeAria', { name: deal.name })}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent-soft text-body font-extrabold text-accent-ink',
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
              'flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent text-body font-extrabold text-on-accent',
              'transition-colors duration-200 hover:bg-accent-hover',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            )}
          >
            <ShoppingCart aria-hidden="true" className="size-4" />
            {t('catalog.toCart')}
          </button>
        )}
      </div>
    </article>
  );
}



const CARD = 'flex flex-col rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface p-4';
const GIFT = 'flex size-12 shrink-0 items-center justify-center rounded-[0.875rem] bg-hit-soft text-hit-ink';
const SEE_ALL = cn(
  'flex h-14 items-center justify-center gap-2 rounded-[var(--radius-control)] border-2 border-solid border-shop bg-surface px-4',
  'text-lead font-extrabold text-shop-ink no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

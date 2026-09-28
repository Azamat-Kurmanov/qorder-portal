import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useGetPortalPromotions } from '../../../api/generated';
import { openCart } from '../../cart/cartDrawer';
import { cn } from '../../../ui/cn';
import { ShopTile, useShops } from '../Shops';
import { CartButton, HeaderTools, SearchField, StatusDetails, StatusText } from './headerParts';
import { COUNT_PILL, useNavModel } from './navModel';

/**
 * Колонка магазина в раскладке «разворот» («Крафт», «Закат»): слева во всю
 * высоту окна — история магазина в градиенте фирменного цвета. Знак, имя
 * (переключение магазинов), адрес и телефон, состояние графика, разделы,
 * карточка идущей распродажи и внизу — как связаться, язык и шрифт.
 *
 * Колонка липнет к окну и листается своей прокруткой: витрина рядом
 * длинная, а разделы и график должны оставаться на виду.
 */
export function StoryColumn({
  ready,
  othersUnread,
  onOpenShops,
  onMore,
}: {
  ready: boolean;
  othersUnread: number;
  onOpenShops: () => void;
  onMore: () => void;
}) {
  const { t } = useTranslation();
  const { current: shop } = useShops();
  const nav = useNavModel(ready);
  const promotions = useGetPortalPromotions({ query: { enabled: ready } });
  const sale = promotions.data?.status === 200 ? promotions.data.data.sale : undefined;
  const subtitle = [shop?.address, shop?.phone].filter(Boolean).join(' · ');
  const item = (active: boolean) => cn(
    'flex h-11 shrink-0 items-center gap-3 rounded-[var(--radius-small)] px-3.5 text-body transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
    active ? 'bg-white font-extrabold text-shop' : 'font-medium text-white/85 hover:bg-white/10 hover:text-white',
  );

  return (
    <aside
      data-testid="story-column"
      className="relative hidden flex-col gap-[22px] overflow-y-auto p-7 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh"
      style={{
        background: 'radial-gradient(80% 60% at 100% 0%, color-mix(in srgb, var(--color-accent2) 65%, var(--color-shop)), transparent 70%), '
          + 'linear-gradient(160deg, var(--color-shop), var(--color-brand-deep))',
      }}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={onOpenShops}
        className="flex flex-col items-start gap-[22px] rounded-[var(--radius-small)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {shop && (
          <ShopTile
            supplier={{ name: shop.name, logoUrl: shop.logoUrl }}
            alt={shop.name}
            initials
            className="size-[58px] rounded-[calc(var(--radius-small)+4px)] bg-white text-xl font-black text-shop"
          />
        )}
        {/* Без стрелки, как в макете: кнопка названа окном, которое открывает (`aria-haspopup`). */}
        <span className="qo-heading text-[1.875rem] leading-[1.05] text-white">
          {shop?.name ?? t('shell.supplier')}
          {othersUnread > 0 && <span role="img" aria-label={t('shell.othersHaveNews')} className="ml-2 inline-block size-2.5 rounded-full bg-accent2 align-middle" />}
        </span>
      </button>
      <div className="-mt-3.5 flex flex-col gap-2">
        {subtitle ? <span className="text-caption opacity-80">{subtitle}</span> : null}
        <span className="mt-1 flex max-w-full items-center gap-2 self-start rounded-full bg-white/18 px-3 py-1.5 text-xs font-semibold">
          <StatusText ready={ready} short onColor />
        </span>
      </div>

      <nav aria-label={t('shell.sectionsRail')} className="flex flex-col gap-0.5">
        {nav.sections.map((section) => {
          const Icon = section.icon;
          if (nav.isCart(section)) {
            return (
              <button key={section.path} type="button" aria-haspopup="dialog" onClick={openCart} className={item(false)}>
                <Icon aria-hidden="true" className="size-[18px]" />
                {t(`shell.sections.${section.key}`)}
                {nav.lines > 0 && (
                  <span role="img" aria-label={t('shell.inCart', { count: nav.lines })} className={cn(COUNT_PILL, 'ml-auto')}>{nav.lines}</span>
                )}
              </button>
            );
          }
          const active = nav.active(section);
          return (
            <NavLink
              key={section.path}
              to={section.path}
              aria-current={active ? 'page' : undefined}
              className={item(active)}
            >
              <Icon aria-hidden="true" className="size-[18px]" />
              {t(`shell.sections.${section.key}`)}
              {section.path === '/promotions' && nav.deals > 0 && (
                <span role="img" aria-label={t('shell.deals', { count: nav.deals })} className={cn(COUNT_PILL, 'ml-auto')}>{nav.deals}</span>
              )}
            </NavLink>
          );
        })}
        <button type="button" onClick={onMore} className={item(nav.inMore)}>
          <MoreHorizontal aria-hidden="true" className="size-[18px]" />
          {t('shell.more')}
        </button>
      </nav>

      {sale ? (
        // Идущая распродажа — карточкой внизу колонки, как в макете: она зовёт
        // на экран акций, где её условия и отсчёт.
        <Link
          to="/promotions"
          className="mt-auto flex flex-col gap-2 rounded-[var(--radius-template)] border border-white/14 bg-white/7 p-[18px] hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span className="text-2xs font-extrabold uppercase tracking-[0.12em] text-accent2">{t('design.saleBadge')}</span>
          <span className="qo-heading text-xl leading-[1.15] text-white">{sale.title}</span>
          {sale.maxPercent ? <span className="text-[2.75rem] font-black leading-none text-accent2">−{sale.maxPercent}%</span> : null}
        </Link>
      ) : null}

      <StatusDetails ready={ready} onBrand className={cn('flex-wrap gap-x-4 gap-y-2 text-caption font-semibold text-white/90', !sale && 'mt-auto')} />
    </aside>
  );
}

/** Верх правой части «разворота»: поиск во всю ширину, корзина и значки. */
export function SplitTopBar({ activated, ready }: { activated: boolean; ready: boolean }) {
  return (
    <header data-testid="split-top" className="sticky top-0 z-20 hidden bg-canvas/80 backdrop-blur-md lg:block">
      <div className="flex h-[4.5rem] items-center gap-3.5 px-7">
        <SearchField />
        <CartButton ready={ready} />
        <HeaderTools activated={activated} ready={ready} />
      </div>
    </header>
  );
}

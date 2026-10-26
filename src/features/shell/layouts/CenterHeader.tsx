import { useTranslation } from 'react-i18next';
import { ChevronDown, MoreHorizontal } from '../../../ui/icons';
import { NavLink } from 'react-router-dom';
import { openCart } from '../../cart/cartDrawer';
import { cn } from '../../../ui/cn';
import { useShops } from '../Shops';
import { CartButton, HeaderTools, SearchField, ShopStatusPill } from './headerParts';
import { COUNT_PILL, useNavModel } from './navModel';
import { phone as formatPhone } from '../../../shared/format';

/**
 * Шапка «ленты по центру» («Ателье», «Нуар», «Уют»): имя магазина крупно
 * посередине, адрес разрядкой под ним, поиск словом слева, корзина и значки
 * справа. Разделы — строкой ниже, прописными с подчёркиванием выбранного,
 * как в журнале. Витрина под ней — узкой лентой по центру.
 */
export function CenterHeader({
  activated,
  ready,
  othersUnread,
  onOpenShops,
  onMore,
}: {
  activated: boolean;
  ready: boolean;
  othersUnread: number;
  onOpenShops: () => void;
  onMore: () => void;
}) {
  const { t } = useTranslation();
  const { current: shop } = useShops();
  const nav = useNavModel(ready);
  const subtitle = [shop?.address, shop?.phone && formatPhone(shop.phone)].filter(Boolean).join(' · ');
  const item = (active: boolean) => cn(
    'flex items-center gap-1.5 text-caption uppercase tracking-[0.12em] transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    active ? 'font-bold text-ink shadow-[inset_0_-2px_0_var(--color-ink)]' : 'font-medium text-ink-muted hover:text-ink',
  );

  return (
    <>
      <header data-testid="center-header" className="sticky top-0 z-20 border-b border-hairline bg-surface">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-3.5 px-7 pt-[18px]">
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
            <SearchField bare grow={false} className="w-[15rem]" />
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={onOpenShops}
              className="flex flex-col items-center gap-0.5 rounded-[var(--radius-small)] px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="flex items-center gap-1.5">
                <span className="qo-heading text-[1.875rem] leading-none text-ink [text-transform:none]">{shop?.name ?? t('shell.supplier')}</span>
                <ChevronDown aria-hidden="true" className="size-4 text-ink-muted" />
                {othersUnread > 0 && <span role="img" aria-label={t('shell.othersHaveNews')} className="size-2.5 rounded-full bg-accent" />}
              </span>
              {subtitle ? <span className="text-2xs uppercase tracking-[0.2em] text-ink-muted">{subtitle}</span> : null}
            </button>
            <div className="flex items-center justify-end gap-2">
              <CartButton ready={ready} />
              <HeaderTools activated={activated} ready={ready} />
            </div>
          </div>
          <nav aria-label={t('shell.sectionsRail')} className="flex h-11 items-stretch gap-7">
            {nav.sections.map((section) => {
              if (nav.isCart(section)) {
                return (
                  <button key={section.path} type="button" aria-haspopup="dialog" onClick={openCart} className={item(false)}>
                    {t(`shell.sections.${section.key}`)}
                    {nav.lines > 0 && (
                      <span role="img" aria-label={t('shell.inCart', { count: nav.lines })} className={COUNT_PILL}>{nav.lines}</span>
                    )}
                  </button>
                );
              }
              const active = nav.active(section);
              return (
                <NavLink key={section.path} to={section.path} aria-current={active ? 'page' : undefined} className={item(active)}>
                  {t(`shell.sections.${section.key}`)}
                  {section.path === '/promotions' && nav.deals > 0 && (
                    <span role="img" aria-label={t('shell.deals', { count: nav.deals })} className={COUNT_PILL}>{nav.deals}</span>
                  )}
                </NavLink>
              );
            })}
            <button type="button" onClick={onMore} className={item(nav.inMore)}>
              <MoreHorizontal aria-hidden="true" className="size-4" />
              {t('shell.more')}
            </button>
          </nav>
        </div>
      </header>
      <ShopStatusPill ready={ready} />
    </>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { openCart } from '../../cart/cartDrawer';
import { cn } from '../../../ui/cn';
import { CartButton, DesignShopButton, HeaderTools, ICON_BUTTON, SearchField, ShopStatusPill, useShopInfo } from './headerParts';
import { COUNT_PILL, useNavModel } from './navModel';

/**
 * Плавающая стеклянная панель — раскладка «Аврора», «Орбита», «Стекло».
 *
 * Панель не прибита к краю окна, а висит над витриной с отступом и
 * размывает то, что под ней проезжает. В ней знак и имя магазина, главные
 * разделы пилюлями, поиск значком (поле раскрывается в самой панели),
 * корзина, тема, уведомления и чип вошедшего. Под панелью — полоса графика
 * пилюлей по центру.
 */
export function FloatingHeader({
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
  const [searching, setSearching] = useState(false);
  const { hours, closedToday, live } = useShopInfo(ready);
  const nav = useNavModel(ready);
  // Четыре главных раздела, как в макете; избранное и редкие — за «Ещё».
  const sections = nav.sections.filter((section) => section.path !== '/favorites');
  const item = (active: boolean) => cn(
    'flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    active ? 'bg-accent-soft font-bold text-accent-ink' : 'font-medium text-ink-muted hover:bg-ink/5 hover:text-ink',
  );

  return (
    <>
      <header data-testid="floating-header" className="sticky top-4 z-20 mx-5">
        <div
          className={cn(
            'qo-glass mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3.5 pl-3 pr-2.5',
            'rounded-[max(12px,var(--radius-template))] shadow-[0_20px_50px_-30px_rgb(0_0_0/0.5)]',
          )}
        >
          <DesignShopButton
            onOpen={onOpenShops}
            othersUnread={othersUnread}
            closedToday={closedToday}
            hours={hours}
            status={live}
            plain
            className="mr-2.5 max-w-[15rem]"
          />
          {searching ? (
            <SearchField className="bg-surface" autoFocus />
          ) : (
            <nav aria-label={t('shell.sectionsRail')} className="flex min-w-0 items-center gap-1 overflow-hidden">
              {sections.map((section) => (
                nav.isCart(section) ? (
                  <button key={section.path} type="button" aria-haspopup="dialog" onClick={openCart} className={item(false)}>
                    {t(`shell.sections.${section.key}`)}
                    {nav.lines > 0 && (
                      <span role="img" aria-label={t('shell.inCart', { count: nav.lines })} className={COUNT_PILL}>{nav.lines}</span>
                    )}
                  </button>
                ) : (
                  <NavLink
                    key={section.path}
                    to={section.path}
                    aria-current={nav.active(section) ? 'page' : undefined}
                    className={item(nav.active(section))}
                  >
                    {t(`shell.sections.${section.key}`)}
                    {section.path === '/promotions' && nav.deals > 0 && (
                      <span role="img" aria-label={t('shell.deals', { count: nav.deals })} className={COUNT_PILL}>{nav.deals}</span>
                    )}
                  </NavLink>
                )
              ))}
              <button type="button" onClick={onMore} className={item(nav.inMore)}>
                <MoreHorizontal aria-hidden="true" className="size-[18px]" />
                {t('shell.more')}
                {othersUnread > 0 && (
                  <span role="img" aria-label={t('shell.unread', { count: othersUnread })} className={COUNT_PILL}>{othersUnread}</span>
                )}
              </button>
            </nav>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label={t('shell.search')}
              aria-expanded={searching}
              onClick={() => setSearching((open) => !open)}
              className={cn(ICON_BUTTON, 'rounded-full', searching && 'border-accent text-ink')}
            >
              <Search className="size-[18px]" aria-hidden="true" />
            </button>
            <CartButton ready={ready} />
            <HeaderTools activated={activated} ready={ready} initialsOnly />
          </div>
        </div>
      </header>
      <ShopStatusPill ready={ready} />
    </>
  );
}

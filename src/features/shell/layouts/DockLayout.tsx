import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { openCart } from '../../cart/cartDrawer';
import { CART_TARGET } from '../../../ui/flyToCart';
import { cn } from '../../../ui/cn';
import { DesignShopButton, HeaderTools, SearchField, ShopStatusPill, useShopInfo } from './headerParts';
import { useNavModel } from './navModel';

/**
 * Шапка раскладки «док» («Радуга»): без меню и без панели — знак и имя
 * магазина, справа поиск, тема, уведомления и вошедший. Разделы живут
 * в доке снизу, график — пилюлей под шапкой.
 */
export function DockHeader({
  activated,
  ready,
  othersUnread,
  onOpenShops,
}: {
  activated: boolean;
  ready: boolean;
  othersUnread: number;
  onOpenShops: () => void;
}) {
  const { hours, closedToday, live } = useShopInfo(ready);
  return (
    <>
      <header data-testid="dock-header" className="sticky top-0 z-20 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-[1440px] items-center gap-4 px-[22px]">
          <DesignShopButton
            onOpen={onOpenShops}
            othersUnread={othersUnread}
            closedToday={closedToday}
            hours={hours}
            status={live}
            plain
            className="[&_.font-heading]:text-lg"
          />
          <div className="ml-auto flex items-center gap-2.5">
            <SearchField grow={false} />
            <HeaderTools activated={activated} ready={ready} />
          </div>
        </div>
      </header>
      <ShopStatusPill ready={ready} />
    </>
  );
}

/**
 * Док снизу по центру — как у рабочего стола: значки с подписями на
 * стеклянной полке. Выбранный раздел — градиентом фирменного цвета ко
 * второму. Корзина открывает выдвижную корзину, «Ещё» — лист всех разделов.
 * Только монитор: на телефоне его место занимает обычное нижнее меню.
 */
export function Dock({ ready, onMore, others }: { ready: boolean; onMore: () => void; others: number }) {
  const { t } = useTranslation();
  const nav = useNavModel(ready);
  const item = (active: boolean) => cn(
    'relative flex h-[62px] w-[86px] flex-col items-center justify-center gap-1 rounded-[18px] text-2xs font-bold transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    active ? 'text-white' : 'text-ink-muted hover:bg-ink/5 hover:text-ink',
  );
  const activeFill = { background: 'linear-gradient(135deg, var(--color-shop), color-mix(in srgb, var(--color-shop) 50%, var(--color-accent2)))' };
  const badge = 'absolute right-4 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sale px-1 text-[0.625rem] font-extrabold text-white';

  return (
    <nav
      aria-label={t('shell.sectionsRail')}
      data-testid="dock"
      className={cn(
        'qo-glass fixed bottom-[18px] left-1/2 z-30 hidden -translate-x-1/2 gap-1.5 rounded-[26px] p-2 lg:flex',
        'shadow-[0_20px_50px_-30px_rgb(0_0_0/0.5)]',
      )}
    >
      {nav.sections.map((section) => {
        const Icon = section.icon;
        const label = t(`shell.tabs.${section.key}`);
        if (nav.isCart(section)) {
          return (
            <button
              key={section.path}
              type="button"
              aria-haspopup="dialog"
              title={t(`shell.sections.${section.key}`)}
              onClick={openCart}
              {...{ [CART_TARGET]: '' }}
              className={item(false)}
            >
              <Icon aria-hidden="true" className="size-5" />
              {label}
              {nav.lines > 0 && (
                <span role="img" aria-label={t('shell.inCart', { count: nav.lines })} className={badge}>{nav.lines}</span>
              )}
            </button>
          );
        }
        const active = nav.active(section);
        return (
          <NavLink
            key={section.path}
            to={section.path}
            title={t(`shell.sections.${section.key}`)}
            aria-current={active ? 'page' : undefined}
            className={item(active)}
            style={active ? activeFill : undefined}
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
            {section.path === '/promotions' && nav.deals > 0 && (
              <span role="img" aria-label={t('shell.deals', { count: nav.deals })} className={badge}>{nav.deals}</span>
            )}
          </NavLink>
        );
      })}
      <button type="button" onClick={onMore} className={item(nav.inMore)} style={nav.inMore ? activeFill : undefined}>
        <MoreHorizontal aria-hidden="true" className="size-5" />
        {t('shell.tabs.more')}
        {others > 0 && (
          <span role="img" aria-label={t('shell.unread', { count: others })} className={badge}>{others}</span>
        )}
      </button>
    </nav>
  );
}

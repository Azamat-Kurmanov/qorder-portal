import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { useGetPortalNotifications, useGetPortalProfile } from '../../../api/generated';
import { Bump } from '../../../ui/Bump';
import { cn } from '../../../ui/cn';
import { CART_TARGET } from '../../../ui/flyToCart';
import { User, type IconComponent } from '../../../ui/icons';
import { toggleCart, useCartDrawer } from '../../cart/cartDrawer';
import { cartOf, useCart } from '../../cart/useCart';
import { HomeCart, HomeCatalog, HomeDelivery, HomeHouse, HomeMessages, HomeMore } from '../../home/homeIcons';
import { NotificationsBell } from '../../notifications/NotificationsBell';
import { messageCounts } from '../messageCounts';
import { ShopTile, useShops } from '../Shops';
import { InvitesPill } from '../Invitations';
import { HeaderOrderMode } from '../../catalog/OrderModeSwitch';
import { toTop } from '../toTop';
import { HelpGuide } from '../HelpGuide';

/**
 * Шапка монитора — по «Варианту Б» канвы (SimplePicWeb*): белая панель 76 точек.
 * Слева знак и имя магазина («сменить магазин» открывает «Мои магазины»), по центру
 * те же разделы, что в нижнем меню телефона, и «Все разделы», справа — имя вошедшего.
 * Корзина на мониторе — боковая панель, поэтому её пункт — кнопка, а не ссылка.
 */
export function ClientBar({ activated, ready, others, onOpenShops, current }: {
  activated: boolean;
  ready: boolean;
  others: number;
  onOpenShops: () => void;
  current: string;
}) {
  const { t } = useTranslation();
  const { list, current: shop } = useShops();
  const profile = useGetPortalProfile({ query: { enabled: ready } });
  const name = profile.data?.status === 200 ? profile.data.data.customerName : undefined;
  const notifications = useGetPortalNotifications({ query: { enabled: ready } });
  const unread = messageCounts(notifications.data?.status === 200 ? notifications.data.data : []).total;
  const lines = cartOf(useCart(ready).data)?.lines.length ?? 0;
  const drawer = useCartDrawer();
  const on = (...paths: string[]) => paths.some((path) => current === path || current.startsWith(`${path}/`));
  const wrap = useRef<HTMLDivElement>(null);
  const compact = useCompact(wrap);

  return (
    <header data-testid="client-bar" data-shell-header className="z-20 border-b-2 border-hairline bg-surface lg:sticky lg:top-0">
      {/* Края шапки — по краям содержимого страницы (76rem + поля 2rem, как у main): шире они
          разъезжались к краям окна, а карточки под ними стояли уже (просьба владельца 2026-11-06). */}
      <div className="mx-auto flex h-16 w-full max-w-[80rem] items-center gap-4 px-8">
        <Link to="/home" aria-label={t('shell.supplier')} className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {shop && <ShopTile supplier={{ name: shop.name, logoUrl: shop.logoUrl }} alt="" initials className="size-11 rounded-xl text-base" />}
        </Link>
        {/* Окно «Мои магазины» открывает только «Другие магазины», не само название (просьба владельца 2026-11-05). */}
        <div className="flex max-w-[10rem] shrink-0 flex-col leading-tight">
          <span className="truncate text-body font-extrabold text-ink">{shop?.name ?? t('shell.supplier')}</span>
          <button type="button" aria-haspopup="dialog" onClick={onOpenShops}
            className="cursor-pointer self-start truncate rounded border-0 bg-transparent p-0 text-left text-xs font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            {list.length > 1 ? `${t('home.otherShops')} ▾` : t('shell.supplierChoose')}
          </button>
          {/* Приглашение другого магазина — видно сразу; принять его можно в «Мои магазины». */}
          <InvitesPill onClick={onOpenShops} />
        </div>

        {/* Поиска в шапке нет: он стоит в самом каталоге, как в макете, — иначе меню сдвигалось под имя.
            Кнопки с подписями и постоянной ширины (раскрытие под курсором владелец отверг 2026-11-05: перескоки).
            Только если подписи не влезают в место между магазином и профилем — остаются значки. */}
        <div ref={wrap} className="flex min-w-0 flex-1 justify-center">
        <nav aria-label={t('shell.sectionsRail')} className="flex items-center gap-1 px-1.5 py-2.5">
          <Item compact={compact} to="/home" icon={HomeHouse} label={t('shell.tabs.home')} tip={t('shell.tips.home')} active={on('/home', '/orders')} />
          <Item compact={compact} to="/catalog" icon={HomeCatalog} label={t('shell.tabs.catalog')} tip={t('shell.tips.catalog')} active={on('/catalog')} />
          <Item compact={compact} to="/messages" icon={HomeMessages} label={t('shell.tabs.messages')} tip={t('shell.tips.messages')} count={unread}
            countLabel={t('shell.unread', { count: unread })} active={on('/messages', '/questions', '/reviews')} />
          <button
            type="button"
            aria-expanded={drawer.open}
            aria-haspopup="dialog"
            onClick={toggleCart}
            {...{ [CART_TARGET]: '' }}
            className={itemClass(drawer.open || on('/checkout'))}
          >
            <HomeCart aria-hidden="true" className="size-6 shrink-0 text-home-icon transition-transform duration-150 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none" />
            <span className={cn(compact && 'sr-only')}>{t('shell.tabs.checkout')}</span>
            {lines > 0 && <Count value={lines} label={t('shell.inCart', { count: lines })} />}
            <Tip text={t('shell.tips.checkout')} />
          </button>
          <Item compact={compact} to="/delivery" icon={HomeDelivery} label={t('shell.tabs.delivery')} tip={t('shell.tips.delivery')} active={on('/delivery')} />
          <Item compact={compact} to="/more" icon={HomeMore} label={t('shell.tabs.more')} tip={t('shell.tips.more')} active={on('/more')} />
        </nav>
        </div>

        {/* Режим заказа — в верхней панели, на любой странице (решение владельца 2026-11-05); запрос — только когда магазин известен. */}
        {activated && ready ? <HeaderOrderMode /> : null}
        {/* «Как пользоваться» — инструкция к открытому экрану; у экрана без инструкции кнопки нет. */}
        <HelpGuide className="size-11 rounded-full text-ink-muted hover:text-ink" />
        {/* ponytail: колокольчик остаётся, пока уведомления не встанут в «Все разделы» (этап 1), как в макете. */}
        {activated && <NotificationsBell active={ready} dot className="size-11 rounded-full text-ink-muted hover:text-ink" />}
        {/* Имя ведёт в профиль, а не в «Все разделы»: два входа в одно место путали. */}
        <Link
          to="/profile"
          aria-label={name ?? t('shell.profile')}
          onClick={toTop}
          className="group relative flex h-12 shrink-0 items-center gap-2 rounded-full border-2 border-hairline pl-1.5 pr-1.5 text-body 2xl:pr-4 font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
            <User aria-hidden="true" className="size-5" />
          </span>
          <span className="hidden max-w-[8rem] truncate 2xl:inline">{name ?? t('shell.profile')}</span>
          <Tip text={t('shell.tips.profile')} end />
          {others > 0 && (
            <span role="img" aria-label={t('shell.othersHaveNews')} className="absolute right-0 top-0 size-3 rounded-full bg-sale ring-2 ring-surface" />
          )}
        </Link>
      </div>
    </header>
  );
}

/**
 * Влезают ли подписи меню: меряем в браузере, а не угадываем ширину экрана — на ней сказываются
 * название магазина, язык и счётчики. Полную ширину запоминаем, пока подписи видны.
 */
function useCompact(wrap: RefObject<HTMLDivElement | null>): boolean {
  const [compact, setCompact] = useState(false);
  const full = useRef(0);
  useLayoutEffect(() => {
    const box = wrap.current;
    const nav = box?.firstElementChild as HTMLElement | null;
    if (!box || !nav || typeof ResizeObserver === 'undefined') return;
    const check = () => {
      // Ширина самого меню (оно не сжимается), а не scrollWidth: туда попали бы и подсказки под пунктами.
      if (!compact) full.current = nav.offsetWidth;
      setCompact(box.clientWidth < full.current);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(box);
    return () => observer.disconnect();
  }, [wrap, compact]);
  return compact;
}

function itemClass(active: boolean): string {
  return cn(
    // Толщина шрифта у выбранного та же: иначе пункт шире, и меню по центру «ездит» при переходах.
    // Отклик под курсором — только transform (подъём, увеличение, вдавливание): соседей он не сдвигает.
    'group relative flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl px-2.5 text-body font-extrabold',
    'transition-[transform,background-color,color,box-shadow] duration-150 ease-out motion-reduce:transition-none',
    'hover:-translate-y-0.5 hover:scale-[1.06] hover:shadow-[0_6px_16px_-6px_rgba(1,86,64,.35)] active:translate-y-0 active:scale-95',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    active ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:bg-accent-soft/60 hover:text-ink',
  );
}

function Item({ to, icon: Icon, label, tip, active, count = 0, countLabel, compact }: {
  compact: boolean;
  tip: string;
  to: string;
  icon: IconComponent;
  label: string;
  active: boolean;
  count?: number;
  countLabel?: string;
}) {
  return (
    <NavLink to={to} onClick={toTop} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
      <Icon aria-hidden="true" className="size-6 shrink-0 text-home-icon transition-transform duration-150 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none" />
      <span className={cn(compact && 'sr-only')}>{label}</span>
      {count > 0 && <Count value={count} label={countLabel ?? ''} />}
      <Tip text={tip} />
    </NavLink>
  );
}

/**
 * Подсказка под пунктом — крупная, на тёмной плашке со стрелкой, появляется сразу (просьба владельца 2026-11-05).
 * Своя, а не title: системная мелкая и не красится. Для чтения с экрана не нужна — пункт и так назван.
 */
function Tip({ text, end = false }: { text: string; end?: boolean }) {
  return (
    <span aria-hidden="true" className={cn(
      'pointer-events-none absolute top-full z-40 mt-2 translate-y-1 whitespace-nowrap',
      end ? 'right-0' : 'left-1/2 -translate-x-1/2',
      'rounded-2xl bg-ink px-4 py-2.5 text-lead font-bold leading-tight text-surface shadow-[0_12px_28px_-10px_rgba(0,0,0,.45)]',
      'opacity-0 transition-[opacity,transform] duration-100 ease-out motion-reduce:transition-none',
      'group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100',
      'before:absolute before:-top-1.5 before:size-3 before:rotate-45 before:rounded-[2px] before:bg-ink',
      end ? 'before:right-5' : 'before:left-1/2 before:-translate-x-1/2',
    )}>
      {text}
    </span>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sale px-1.5 text-xs font-extrabold text-on-sale">
      <Bump value={value}>{value}</Bump>
    </span>
  );
}

import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { useGetPortalProfile } from '../../../api/generated';
import { cn } from '../../../ui/cn';
import { ChevronDown, User } from '../../../ui/icons';
import { NotificationsBell } from '../../notifications/NotificationsBell';
import { HOME_SECTION, isActive, useMainSections } from '../sections';
import { ShopTile, useShops } from '../Shops';
import { initialsOf } from '../ViewerBadge';
import { CartButton, SearchField } from './headerParts';

/**
 * Шапка монитора без шаблона — по макетам ПК-К1…К5: одна белая панель
 * 72 точки. Знак магазина ведёт на витрину, имя открывает «Мои магазины»;
 * дальше поиск, главные разделы строкой, корзина с числом и суммой
 * и кружок вошедшего — он открывает «Ещё»: профиль, редкие разделы, язык,
 * тему, шрифт и звонок в магазин. Левой колонки нет: витрине — вся ширина.
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
  // «Главная» — первым пунктом, как в макете ПК-К2.1; корзина — своей кнопкой справа.
  const sections = [HOME_SECTION, ...useMainSections(ready).sections.filter((section) => section.path !== '/checkout')];
  const profile = useGetPortalProfile({ query: { enabled: ready } });
  const name = profile.data?.status === 200 ? profile.data.data.customerName : undefined;

  return (
    <header data-testid="client-bar" data-shell-header className="sticky top-0 z-20 bg-surface shadow-[0_4px_16px_rgba(58,48,30,.05)]">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-[1440px] items-center gap-3 px-8 xl:px-16">
        <Link to="/home" aria-label={t('shell.supplier')} className="shrink-0 rounded-[0.875rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {shop && <ShopTile supplier={{ name: shop.name, logoUrl: shop.logoUrl }} alt="" initials className="size-11 rounded-[0.875rem] text-base" />}
        </Link>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onOpenShops}
          className="flex w-[9rem] shrink-0 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent xl:w-[10rem]"
        >
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[0.9375rem] font-extrabold text-ink">{shop?.name ?? t('shell.supplier')}</span>
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-muted" />
          </span>
          <span className="truncate text-xs font-medium text-ink-muted">
            {list.length > 0 ? t('shell.switchShop', { count: list.length }) : t('shell.supplierChoose')}
          </span>
        </button>

        <SearchField grow={false} className="w-[10rem] rounded-[0.875rem] border-transparent xl:w-[11.5rem]" />

        <nav aria-label={t('shell.sectionsRail')} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = isActive(section, current);
            return (
              <NavLink
                key={section.path}
                to={section.path}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-sm font-bold',
                  'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  active ? 'bg-accent-soft font-extrabold text-accent-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon aria-hidden="true" className="size-[18px]" />
                {t(`shell.tabs.${section.key}`)}
              </NavLink>
            );
          })}
        </nav>

        <CartButton ready={ready} className="h-12 rounded-[0.875rem] bg-sale text-white shadow-none hover:bg-sale-ink" />
        {activated && (
          <NotificationsBell active={ready} dot className="size-11 rounded-full text-ink-muted hover:text-ink" />
        )}
        <Link
          to="/more"
          aria-label={t('shell.tabs.more')}
          title={name}
          className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-extrabold text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {name ? initialsOf(name) : <User aria-hidden="true" className="size-5" />}
          {others > 0 && (
            <span role="img" aria-label={t('shell.othersHaveNews')} className="absolute right-0 top-0 size-3 rounded-full bg-sale ring-2 ring-surface" />
          )}
        </Link>
      </div>
    </header>
  );
}
